import { skuWrite } from './product-sku-helper.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { openDatabase } from './pg-test-db.mjs';
import { seed } from '../server/seed.mjs';
import { Service } from '../server/service.mjs';
import { createAccount, authenticate, issueSession, digest } from '../server/security.mjs';
import { createHttpServer } from '../server/http.mjs';
import { backupData, restoreData } from './pg-test-db.mjs';
const password = () => randomUUID() + randomUUID();
async function fixture(path = ':memory:') {
    const db = (await openDatabase(path));
    (await seed(db));
    const service = new Service(db);
    const admin = (await createAccount(db, { username: 'test_admin', password: password(), roles: ['admin'] }));
    const reception = (await createAccount(db, { username: 'test_reception', password: password(), roles: ['reception'] }));
    const content = (await createAccount(db, { username: 'test_content', password: password(), roles: ['content'] }));
    const visitor = async () => { const id = randomUUID(); (await db.execute("INSERT INTO visitors VALUES ($1,NULL,$2)", [id, new Date().toISOString()])); return { id }; };
    return { db, service, admin, reception, content, a: (await visitor()), b: (await visitor()) };
}
const request = (extra = {}) => ({ packageId: 'package-1', date: '2099-10-20', contactName: '虚拟测试访客', phone: '13800000000', adults: 1, children: 1, note: '仅机制验证', consent: true, ...extra });
const book = async (f, owner = f.a, extra = {}) => (await f.service.createBooking(owner, (await request(extra)), randomUUID()));
const slot = async (f, capacity = 4, extra = {}) => (await f.service.saveSlot(f.admin, { date: '2099-10-20', start: '09:00', end: '11:00', capacity, packageIds: ['package-1', 'package-2'], note: '测试参数，不用于正式接待', ...extra }));
const confirm = async (f, id, s, actor = f.admin) => (await f.service.handleBooking(actor, id, { action: 'confirm', version: 1, slotId: s.id, assignee: actor.id, note: '测试已联系并确认' }));
const fault = async (fn, code) => (await assert.rejects(async()=>fn(), e => code ? e.code === code : e.status >= 400));
test('本地业务与状态规则', async (t) => {
    const f = (await fixture());
    t.after(async () => (await f.db.close()));
    await t.test('五套餐原稿价格与时长完整保留；未发布视频标题不冒充可播放内容', async () => {
        const p = (await f.service.listContent({ kind: 'package' }));
        assert.equal(p.length, 5);
        assert.deepEqual(p.map(c => [c.referenceParentPrice, c.referenceSinglePrice]), [[118, 88], [158, 118], [138, 98], [118, 88], [128, 88]]);
        assert.equal(p[0].durationNote, '2小时');
        assert.equal((await f.service.listContent({ kind: 'lesson' })).length, 0);
        assert.equal((await f.service.listContent({ kind: 'lesson' }, true)).length, 14);
        assert.equal((await f.service.listContent({ kind: 'product', category: 'gift' })).length, 20);
        assert.equal((await f.service.content('site')).phone, '');
    });
    await t.test('没有媒体文件不能发布视频；草稿允许后续维护', async () => {
        const prev = (await f.service.content('lesson-1', false));
        const { id, kind, name, sort, version, ...data } = prev;
        (await fault(async () => (await skuWrite(f.service, f.admin, { kind, name, sort, version, data, state: 'published' }, id))));
        assert.equal((await f.service.content(id, false)).state, 'draft');
    });
    await t.test('拒绝错误联系信息、过去或无效日期、零人、负数和缺少授权', async () => {
        for (const bad of [{ phone: '123' }, { contactName: '' }, { date: '2020-01-01' }, { date: '2099-02-30' }, { adults: 0, children: 0 }, { adults: -1 }, { consent: false }])
            (await fault(async () => (await book(f, f.a, bad))));
        assert.equal((await f.service.myBookings(f.a)).length, 0);
    });
    await t.test('重复提交返回同一编号；改变内容不能复用保护编号', async () => {
        const key = randomUUID(), body = (await request());
        const a = (await f.service.createBooking(f.a, body, key));
        const b = (await f.service.createBooking(f.a, body, key));
        assert.equal(a.id, b.id);
        (await fault(async () => (await f.service.createBooking(f.a, (await request({ note: '已改变' })), key)), 'IDEMPOTENCY_CONFLICT'));
        assert.equal((await f.service.myBookings(f.a)).length, 1);
    });
    await t.test('另一游客不能查询或撤回本人申请，联系电话不是身份依据', async () => {
        const row = (await f.service.myBookings(f.a))[0];
        (await fault(async () => (await f.service.getBooking(row.id, f.b)), 'NOT_FOUND'));
        (await fault(async () => (await f.service.withdraw(f.b, row.id, { reason: '越权' })), 'NOT_FOUND'));
        assert.equal((await f.service.myBookings(f.b)).length, 0);
    });
    await t.test('待确认不占用容量；成人儿童各计实际人数', async () => {
        const s = (await slot(f, 2));
        assert.equal((await f.service.slots()).find(x => x.id === s.id).confirmed_count, 0);
        const b = (await book(f, f.b));
        (await confirm(f, b.id, s));
        assert.equal((await f.service.slots()).find(x => x.id === s.id).confirmed_count, 2);
        const extra = (await book(f));
        (await fault(async () => (await confirm(f, extra.id, s)), 'CAPACITY_FULL'));
        assert.equal((await f.service.getBooking(extra.id, f.a)).state, 'pending');
    });
    await t.test('内容人员不能读取或处理预约，接待角色可以确认', async () => {
        (await fault(async () => (await f.service.adminRecords(f.content, 'bookings')), 'FORBIDDEN'));
        const s = (await slot(f, 2)), b = (await book(f));
        (await fault(async () => (await confirm(f, b.id, s, f.content)), 'FORBIDDEN'));
        assert.equal((await confirm(f, b.id, s, f.reception)).state, 'confirmed');
    });
    await t.test('无套餐意向的团体申请可人工沟通，不套家庭票价', async () => {
        const b = (await book(f, f.a, { group: true, packageId: null, team: '虚拟测试团队', total: 7 }));
        const r = (await f.service.getBooking(b.id, f.a));
        assert.equal(r.headcount, 7);
        assert.equal(r.snapshot.id, 'group-general');
        assert.equal(r.request.adults, undefined);
        assert.equal(r.request.price, undefined);
    });
    await t.test('团体未指定套餐仍可选择意向时段；已确认场次不能被编辑破坏历史安排', async () => {
        const s = (await slot(f, 8)), b = (await book(f, f.a, { group: true, packageId: null, team: '虚拟测试团队', total: 3, slotId: s.id }));
        assert.equal((await f.service.getBooking(b.id, f.a)).request.slotId, s.id);
        (await confirm(f, b.id, s));
        (await fault(async () => (await f.service.saveSlot(f.admin, { ...s, version: 1, start: '10:00', packageIds: s.package_ids }, s.id)), 'SLOT_HAS_BOOKINGS'));
        const changed = (await f.service.saveSlot(f.admin, { ...s, version: 1, capacity: 9, packageIds: s.package_ids }, s.id));
        assert.equal(changed.capacity, 9);
        assert.equal((await f.service.getBooking(b.id, f.a)).confirmed.start, '09:00');
    });
    await t.test('已确认取消申请不直接改变接待；批准后释放容量', async () => {
        const s = (await slot(f, 2)), b = (await book(f));
        const r = (await confirm(f, b.id, s));
        const c = (await f.service.requestChange(f.a, b.id, { type: 'cancel', reason: '测试取消' }));
        assert.equal(c.state, 'confirmed');
        assert.equal((await f.service.slots()).find(x => x.id === s.id).confirmed_count, 2);
        const result = (await f.service.handleBooking(f.admin, b.id, { action: 'change_approve', version: r.version, changeId: c.changes[0].id, note: '测试批准取消' }));
        assert.equal(result.state, 'cancelled');
        assert.equal((await f.service.slots()).find(x => x.id === s.id).confirmed_count, 0);
    });
    await t.test('改期容量不足整体回滚，原日期人数和变更申请保持不变', async () => {
        const source = (await slot(f, 3)), target = (await slot(f, 1, { date: '2099-10-21' })), b = (await book(f));
        const r = (await confirm(f, b.id, source));
        const c = (await f.service.requestChange(f.a, b.id, { type: 'reschedule', reason: '测试改期', date: '2099-10-21', adults: 1, children: 1 }));
        (await fault(async () => (await f.service.handleBooking(f.admin, b.id, { action: 'change_approve', version: r.version, changeId: c.changes[0].id, slotId: target.id, note: '测试批准' })), 'CAPACITY_FULL'));
        const after = (await f.service.getBooking(b.id, f.a));
        assert.equal(after.confirmed.date, '2099-10-20');
        assert.equal(after.headcount, 2);
        assert.equal(after.version, r.version);
        assert.equal(after.changes[0].state, 'pending');
        const bigger = (await f.service.saveSlot(f.admin, { ...target, version: 1, capacity: 2, packageIds: target.package_ids }, target.id));
        const moved = (await f.service.handleBooking(f.admin, b.id, { action: 'change_approve', version: r.version, changeId: c.changes[0].id, slotId: bigger.id, note: '已核对改期与容量' }));
        assert.equal(moved.confirmed.date, '2099-10-21');
        assert.equal(moved.changes[0].result.before.date, '2099-10-20');
    });
    await t.test('旧版本不能覆盖新处理；完成需先登记到访，结束不可重确认', async () => {
        const b = (await book(f)), s = (await slot(f, 2));
        const r = (await confirm(f, b.id, s));
        (await fault(async () => (await f.service.handleBooking(f.admin, b.id, { action: 'cancel', version: 1, note: '旧请求' })), 'VERSION_CONFLICT'));
        (await fault(async () => (await f.service.handleBooking(f.admin, b.id, { action: 'complete', version: r.version }))));
        const arrived = (await f.service.handleBooking(f.admin, b.id, { action: 'arrive', version: r.version }));
        const completed = (await f.service.handleBooking(f.admin, b.id, { action: 'complete', version: arrived.version, note: '测试接待完成' }));
        assert.equal(completed.state, 'completed');
        (await fault(async () => (await f.service.handleBooking(f.admin, b.id, { action: 'confirm', version: completed.version, slotId: s.id, note: '重复确认' }))));
    });
    await t.test('拒绝、撤回和人工未到访均记录原因', async () => {
        const b = (await book(f)), row = (await f.service.withdraw(f.a, b.id, { reason: '测试撤回' }));
        assert.equal(row.state, 'cancelled');
        const rejected = (await book(f));
        assert.equal((await f.service.handleBooking(f.admin, rejected.id, { action: 'reject', version: 1, note: '测试无法接待' })).state, 'rejected');
        const missed = (await book(f)), s = (await slot(f));
        const confirmed = (await confirm(f, missed.id, s));
        assert.equal((await f.service.handleBooking(f.admin, missed.id, { action: 'no_show', version: confirmed.version, note: '已人工核实未到访' })).state, 'no_show');
    });
    await t.test('套餐更新、改价、下架不破坏预约快照', async () => {
        const b = (await book(f));
        const original = (await f.service.getBooking(b.id, f.a)).snapshot;
        const pkg = (await f.service.content('package-1'));
        const { id, kind, name, state, sort, version, ...data } = pkg;
        (await skuWrite(f.service, f.admin, { kind, name: '测试新名称', state: 'archived', sort, version, data: { ...data, referenceParentPrice: 999 } }, id));
        const historical = (await f.service.getBooking(b.id, f.a)).snapshot;
        assert.equal(historical.name, original.name);
        assert.equal(historical.referenceParentPrice, 118);
        (await fault(async () => (await f.service.content(id)), 'CONTENT_UNAVAILABLE'));
    });
    await t.test('咨询自动保留对象和规格；本人可查询跟进及结束结果', async () => {
        const old = (await f.service.content('violin-L201', false));
        const product = (await skuWrite(f.service, f.admin, { kind: old.kind, name: old.name, state: old.state, version: old.version, data: old }, old.id));
        const payload = { contentId: product.id, skuId: product.skus.find(s => s.current && s.enabled).id, source: '提琴详情', contactName: '虚拟咨询访客', phone: '13800000000', message: '测试了解规格', consent: true };
        const key = randomUUID();
        const r = (await f.service.createConsultation(f.a, payload, key));
        assert.equal((await f.service.createConsultation(f.a, payload, key)).id, r.id);
        (await fault(async () => (await f.service.getConsultation(r.id, f.b)), 'NOT_FOUND'));
        const a = (await f.service.handleConsultation(f.reception, r.id, { action: 'followup', version: 1, note: '内部测试联系备注' }));
        assert.equal(a.state, 'following');
        const mine = (await f.service.getConsultation(r.id, f.a));
        assert.equal(mine.followups, undefined);
        assert.equal(mine.snapshot.sku.specLabel, '4/4');
        const c = (await f.service.handleConsultation(f.reception, r.id, { action: 'close', version: a.version, note: '测试咨询已解答' }));
        assert.equal(c.state, 'closed');
        assert.equal((await f.service.getConsultation(r.id, f.a)).public_note, '测试咨询已解答');
    });
    await t.test('停用人员不能继续使用旧会话；无效负责人不得指派', async () => {
        const session = (await issueSession(f.db, f.reception.id, 'admin'));
        assert.equal((await authenticate(f.db, session.token, 'admin')).id, f.reception.id);
        (await f.db.execute("UPDATE accounts SET active=false WHERE id=$1", [f.reception.id]));
        (await fault(async () => (await authenticate(f.db, session.token, 'admin')), 'ACCOUNT_DISABLED'));
        const pending = (await f.service.myBookings(f.a)).find(b => b.state === 'pending');
        (await fault(async () => (await f.service.handleBooking(f.admin, pending.id, { action: 'assign', version: pending.version, assignee: f.reception.id }))));
    });
});
test('跨两个工作线程同时确认同一场次，不超容量', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'hq-concurrency-')), path = join(directory, 'fixture.pg');
    const f = (await fixture(path));
    try {
        const s = (await slot(f, 3)), one = (await book(f)), two = (await book(f, f.b));
        const barrier = new SharedArrayBuffer(4);
        const spawn = (bookingId, actor) => new Promise((resolveResult, reject) => {
            const worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads');(async()=>{const {openDatabase}=await import(workerData.dbModule);const {Service}=await import(workerData.serviceModule);const db=openDatabase(workerData.config);parentPort.postMessage({ready:true});Atomics.wait(new Int32Array(workerData.barrier),0,0);try{const r=await new Service(db).handleBooking(workerData.actor,workerData.bookingId,{action:'confirm',version:1,slotId:workerData.slotId,note:'并发测试确认',assignee:workerData.actor.id});parentPort.postMessage({state:r.state});}catch(e){parentPort.postMessage({code:e.code});}finally{await db.close();}})();`, { eval: true, workerData: { config:{connectionString:f.db.connectionString,schema:f.db.schema}, barrier, actor, bookingId, slotId: s.id, dbModule: new URL('../server/db.mjs', import.meta.url).href, serviceModule: new URL('../server/service.mjs', import.meta.url).href } });
            worker.on('message', m => {
                if (m.ready) {
                    ready++;
                    if (ready === 2) {
                        Atomics.store(new Int32Array(barrier), 0, 1);
                        Atomics.notify(new Int32Array(barrier), 0, 2);
                    }
                }
                else
                    resolveResult(m);
            });
            worker.on('error', reject);
        });
        let ready = 0;
        const results = await Promise.all([spawn(one.id, f.admin), spawn(two.id, f.reception)]);
        assert.equal(results.filter(r => r.state === 'confirmed').length, 1);
        assert.equal(results.filter(r => r.code === 'CAPACITY_FULL').length, 1);
        assert.equal((await f.service.slots()).find(x => x.id === s.id).confirmed_count, 2);
    }
    finally {
        (await f.db.close());
        rmSync(directory, { recursive: true, force: true });
    }
});
test('重启持久化与完整备份恢复，损坏备份不覆盖已有数据', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hq-restore-')), source = join(dir, 'source');
    mkdirSync(source);
    const f = (await fixture(join(source, 'fixture.pg')));
    const b = (await book(f)), s = (await slot(f));
    (await confirm(f, b.id, s));
    const owner = f.a.id;
    (await issueSession(f.db, owner, 'visitor'));
    (await f.db.close());
    const reopened = (await openDatabase(join(source, 'fixture.pg')));
    assert.equal((await new Service(reopened).getBooking(b.id, { id: owner })).state, 'confirmed');
    (await reopened.close());
    try {
        const backup = join(dir, 'backup'), restored = join(dir, 'restored');
        (await backupData(source, backup));
        (await restoreData(backup, restored));
        const d = (await openDatabase(join(restored, 'fixture.pg')));
        assert.equal((await new Service(d).getBooking(b.id, { id: owner })).state, 'confirmed');
        assert.equal((await d.maybeOne("SELECT COUNT(*) AS n FROM sessions", [])).n, 0);
        (await d.close());
        (await assert.rejects(async () => (await restoreData(backup, source)), /禁止覆盖/));
        writeFileSync(join(backup, 'database.dump'), 'broken');
        (await assert.rejects(async () => (await restoreData(backup, join(dir, 'bad'))), /校验失败/));
        assert.equal(existsSync(join(dir, 'bad')), false);
    }
    finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
test('HTTP身份、权限、发布媒体和异常路径', async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'hq-http-')), f = (await fixture(join(dir, 'fixture.pg')));
    const pass = password();
    const httpAdmin = (await createAccount(f.db, { username: 'http_admin', password: pass, roles: ['admin'] }));
    const { server } = createHttpServer({ devAuth:true, db: f.db, root: resolve('.'), uploads: join(dir, 'uploads') });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    t.after(async () => { await new Promise(async (r) => (await server.close(r))); (await f.db.close()); rmSync(dir, { recursive: true, force: true }); });
    const call = async (path, options = {}) => { const r = await fetch(base + path, { ...options, headers: { 'Content-Type': 'application/json', 'X-HQ-Action': '1', ...options.headers } }); return { status: r.status, body: await r.json(), headers: r.headers }; };
    const login = await call('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: 'http_admin', password: pass }) });
    assert.equal(login.status, 200);
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const adminCall = async (path, options = {}) => (await call(path, { ...options, headers: { Cookie: cookie, ...options.headers } }));
    await t.test('管理会话采用HttpOnly；匿名不能访问后台或名单', async () => { assert.match(login.headers.get('set-cookie'), /HttpOnly/); assert.match(login.headers.get('set-cookie'), /SameSite=Strict/); assert.equal((await call('/api/admin/bookings')).status, 401); assert.equal((await call('/api/visitor/bookings')).status, 401); assert.equal((await adminCall('/api/admin/export')).status, 403); });
    await t.test('拒绝跨站修改及缺少请求校验头的操作', async () => { assert.equal((await adminCall('/api/admin/logout', { method: 'POST', headers: { Origin: 'https://untrusted.example' }, body: '{}' })).status, 403); const r = await fetch(base + '/api/admin/logout', { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(r.status, 403); });
    await t.test('游客身份由服务端签发，伪造任意ID或手机号不能读取记录', async () => { const identity = await call('/api/auth/development', { method: 'POST' }); assert.equal(identity.status, 201); assert.ok(identity.body.token); assert.equal((await call('/api/visitor/bookings', { headers: { Authorization: 'Bearer fake-visitor-id' } })).status, 401); });
    await t.test('真实微信配置缺失明确失败，不降级伪造openid', async () => { assert.equal((await call('/api/auth/wechat', { method: 'POST', body: JSON.stringify({ code: 'test-code' }) })).status, 503); });
    let uploaded;
    await t.test('真实图片文件上传并持久保存；未发布时匿名不可访问', async () => {
        const bytes = readFileSync('images/yorray-logo.png');
        const r = await fetch(base + '/api/admin/media', { method: 'POST', headers: { Cookie: cookie, 'X-HQ-Action': '1', 'Content-Type': 'image/png', 'X-File-Name': encodeURIComponent('测试标志.png'), 'X-Media-Rights': encodeURIComponent('原项目测试素材，仅机制验证') }, body: bytes });
        assert.equal(r.status, 201);
        uploaded = await r.json();
        const m = (await f.db.maybeOne("SELECT * FROM media WHERE id=$1", [uploaded.id]));
        assert.equal(readFileSync(join(dir, 'uploads', m.object_key)).length, bytes.length);
        assert.equal(m.sha256, digest(bytes));
        assert.equal((await fetch(base + '/api/media/' + uploaded.id)).status, 410);
    });
    await t.test('发布后匿名可读及拖动Range，下架后旧媒体地址和详情失效', async () => {
        const c = (await f.service.content('violin-L201', false)), { id, kind, name, sort, version, ...data } = c;
        const live = (await skuWrite(f.service, f.admin, { kind, name, sort, version, state: 'published', data: { ...data, images: [uploaded.url] } }, id));
        let r = await fetch(base + uploaded.url, { headers: { Range: 'bytes=0-15' } });
        assert.equal(r.status, 206);
        assert.equal((await r.arrayBuffer()).byteLength, 16);
        assert.equal(r.headers.get('cache-control'), 'no-store');
        assert.equal(r.headers.get('cross-origin-resource-policy'), 'cross-origin');
        assert.equal(r.headers.get('access-control-allow-origin'), '*');
        r = await fetch(base + uploaded.url, { headers: { Range: 'bytes=999999999-' } });
        assert.equal(r.status, 416);
        (await skuWrite(f.service, f.admin, { kind, name, sort, version: live.version, state: 'archived', data: { ...data, images: [uploaded.url] } }, id));
        assert.equal((await fetch(base + uploaded.url)).status, 410);
        assert.equal((await call('/api/public/content/' + id)).status, 404);
    });
    await t.test('假扩展名 / 错误容器签名被拒绝且不留下媒体记录', async () => {
        const n = (await f.db.maybeOne("SELECT count(*) AS n FROM media", [])).n;
        const r = await fetch(base + '/api/admin/media', { method: 'POST', headers: { Cookie: cookie, 'X-HQ-Action': '1', 'Content-Type': 'video/mp4', 'X-File-Name': 'bad.mp4', 'X-Media-Rights': 'synthetic-test' }, body: Buffer.from('not a video') });
        assert.equal(r.status, 415);
        assert.equal((await f.db.maybeOne("SELECT count(*) AS n FROM media", [])).n, n);
    });
    await t.test('规格独立图片的公开引用与校验，不受公共图库为空影响', async () => {
        const c = (await f.service.content('violin-L201', false)), { id, kind, name, sort, version, ...data } = c;
        const live = (await skuWrite(f.service, f.admin, { kind, name, sort, version, state: 'published', data: { ...data, images: [], specs: [{ name: '4/4测试', description: '虚拟规格', price: 120, images: [uploaded.url] }] } }, id));
        assert.equal((await fetch(base + uploaded.url)).status, 200);
        (await fault(async () => (await skuWrite(f.service, f.admin, { kind, name, sort, version: live.version, state: 'published', data: { ...data, images: [], specs: [{ name: 'bad', description: 'bad', images: ['https://unknown.example/test.png'] }] } }, id))));
        (await skuWrite(f.service, f.admin, { kind, name, sort, version: live.version, state: 'archived', data: { ...data, images: [] } }, id));
        assert.equal((await fetch(base + uploaded.url)).status, 410);
    });
    await t.test('独立导出授权、CSV公式保护与导出审计', async () => {
        const operator = (await createAccount(f.db, { username: 'export_test', password: password(), roles: ['reception'], canExport: true }));
        const token = (await issueSession(f.db, operator.id, 'admin'));
        (await book(f, f.a, { contactName: '=SUM(1,1)' }));
        const r = await fetch(base + '/api/admin/export?kind=bookings', { headers: { Cookie: `hq_admin=${token.token}` } });
        assert.equal(r.status, 200);
        const csv = await r.text();
        assert.ok(csv.includes("'=SUM(1,1)"));
        assert.ok((await f.db.maybeOne("SELECT COUNT(*) AS n FROM audit WHERE action='records.export'", [])).n > 0);
    });
    await t.test('媒体与数据库同步备份、恢复并校验', async () => {
        const backup = join(dir, 'backup'), target = join(dir, 'restored');
        const manifest = (await backupData(dir, backup));
        assert.equal(manifest.media.length, 1);
        (await restoreData(backup, target));
        const restored = (await openDatabase(join(target, 'fixture.pg')));
        assert.equal((await restored.maybeOne("SELECT COUNT(*) AS n FROM media", [])).n, 1);
        (await restored.close());
    });
    await t.test('内容岗位不得导出联系人或处理预约；接待岗位可读取套餐基本项', async () => {
        const cp = password();
        (await createAccount(f.db, { username: 'restricted_content', password: cp, roles: ['content'] }));
        const l = await call('/api/admin/login', { method: 'POST', body: JSON.stringify({ username: 'restricted_content', password: cp }) });
        const ck = l.headers.get('set-cookie').split(';')[0];
        assert.equal((await call('/api/admin/bookings', { headers: { Cookie: ck } })).status, 403);
        assert.equal((await call('/api/admin/export', { headers: { Cookie: ck } })).status, 403);
        const token = (await issueSession(f.db, f.reception.id, 'admin'));
        assert.equal((await call('/api/admin/packages', { headers: { Cookie: `hq_admin=${token.token}` } })).status, 200);
    });
    await t.test('停用账号立即使旧会话失效，并保留审计', async () => {
        (await f.db.execute("UPDATE accounts SET active=false WHERE id=$1", [httpAdmin.id]));
        assert.equal((await adminCall('/api/admin/me')).status, 401);
        const staffToken = (await issueSession(f.db, f.reception.id, 'admin'));
        const historicalStaff = await call('/api/admin/staff', { headers: { Cookie: `hq_admin=${staffToken.token}` } });
        assert.equal(historicalStaff.body.find(a => a.id === httpAdmin.id).active, false);
        assert.equal(historicalStaff.body.find(a => a.id === httpAdmin.id).password_hash, undefined);
        assert.ok((await f.db.maybeOne("SELECT COUNT(*) AS n FROM audit WHERE action='account.login'", [])).n > 0);
    });
});
