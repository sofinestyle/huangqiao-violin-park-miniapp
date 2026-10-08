import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { openDatabase } from './pg-test-db.mjs';
import { seed } from '../server/seed.mjs';
import { Service } from '../server/service.mjs';
import { createAccount, issueSession } from '../server/security.mjs';
import { createHttpServer } from '../server/http.mjs';
import { backupData, restoreData } from './pg-test-db.mjs';
async function fixture(t, path = ':memory:') {
    const db = (await openDatabase(path));
    (await seed(db));
    t.after(async () => (await db.close()));
    const service = new Service(db);
    const admin = (await createAccount(db, { username: 'enroll_admin', password: randomUUID() + randomUUID(), roles: ['admin'] }));
    const reception = (await createAccount(db, { username: 'enroll_staff', password: randomUUID() + randomUUID(), roles: ['reception'] }));
    const visitor = async () => { const id = randomUUID(); (await db.execute("INSERT INTO visitors VALUES ($1,NULL,$2)", [id, new Date().toISOString()])); return { id }; };
    return { db, service, admin, reception, a: (await visitor()), b: (await visitor()) };
}
const input = (extra = {}) => ({ date: '2099-11-01', start: '09:00', end: '11:00', capacity: 6, externalCount: 4, packageIds: ['package-1'], note: '内部接待备注不公开', enrollment: { state: 'published', title: '虚拟成团活动', packageId: 'package-1', meetingPoint: '隔离验证集合点', description: '机制验证', feeNote: '费用待联系确认', registrationNote: '隔离样例，不作接待' }, ...extra });
const save = async (f, extra = {}) => (await f.service.saveSlot(f.admin, input(extra)));
const update = async (f, s, extra = {}) => (await f.service.saveSlot(f.admin, { ...s, externalCount: s.external_count, packageIds: s.package_ids, ...extra }, s.id));
const request = (s, extra = {}) => ({ enrollmentId: s.id, slotId: s.id, packageId: 'package-1', date: s.date, adults: 1, children: 0, contactName: '虚拟报名访客', phone: '13800000000', note: '仅隔离验证', consent: true, ...extra });
const apply = async (f, s, owner = f.a, extra = {}, key = randomUUID()) => (await f.service.createBooking(owner, (await request(s, extra)), key));
const confirm = async (f, b, s, actor = f.admin) => (await f.service.handleBooking(actor, b.id, { action: 'confirm', version: b.version || 1, slotId: s.id, assignee: actor.id, note: '隔离测试已联系并确认' }));
const fault = async (fn, code) => (await assert.rejects(async()=>fn(), e => code ? e.code === code : e.status >= 400));
test('旧场次迁移保留原值，默认不作为成团活动发布，重复打开不重做迁移', async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'hq-enroll-migrate-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const path = join(dir, 'old.sqlite');
    let db=await openDatabase(path);
    await db.execute('INSERT INTO slots(id,date,start,"end",capacity,package_ids,paused,note,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',['old-slot','2099-11-01','09:00','11:00',9,'["package-1"]',false,'原接待备注',7]);
    const slot = (await new Service(db).slots())[0];
    assert.equal(slot.id, 'old-slot');
    assert.equal(slot.version, 7);
    assert.equal(slot.capacity, 9);
    assert.equal(slot.note, '原接待备注');
    assert.equal(slot.external_count, 0);
    assert.equal(slot.enrollment.state, 'draft');
    assert.deepEqual((await new Service(db).enrollments()), []);
    (await db.close());
    db = (await openDatabase(path));
    assert.equal((await db.maybeOne("SELECT COUNT(*) AS n FROM migrations WHERE version=1", [])).n, 1);
    (await db.close());
});
test('发布需实际成团人数、公开集合地点和已发布套餐；接待权限与公开字段隔离', async (t) => {
    const f = (await fixture(t));
    (await fault(async () => (await f.service.saveSlot({ id: 'content', roles: ['content'] }, input())), 'FORBIDDEN'));
    (await fault(async () => (await save(f, { externalCount: 0 }))));
    (await fault(async () => (await save(f, { externalCount: 7 })), 'CAPACITY_FULL'));
    (await fault(async () => (await save(f, { externalCount: -1 }))));
    (await fault(async () => (await save(f, { enrollment: { ...input().enrollment, meetingPoint: '' } }))));
    (await fault(async () => (await save(f, { enrollment: { ...input().enrollment, packageId: 'package-2' } }))));
    const draft = (await save(f, { enrollment: { state: 'draft' } }));
    assert.equal((await f.service.enrollments()).length, 0);
    const s = (await save(f));
    const e = (await f.service.enrollment(s.id));
    assert.equal(e.remaining, 2);
    assert.equal(e.canApply, true);
    assert.equal(e.packageName, (await f.service.content('package-1')).name);
    for (const key of ['note', 'external_count', 'contactName', 'phone', 'assignee', 'package_ids'])
        assert.equal(Object.hasOwn(e, key), false);
    const pkg = (await f.service.content('package-1'));
    (await f.service.saveContent(f.admin, { version: pkg.version, name: pkg.name, state: 'archived', data: pkg }, pkg.id));
    assert.deepEqual((await f.service.enrollments()), []);
    (await fault(async () => (await f.service.enrollment(s.id)), 'ENROLLMENT_UNAVAILABLE'));
    assert.equal(draft.enrollment.state, 'draft');
});
test('报名真实保存为待确认，重试幂等，历史活动快照与本人归属保留', async (t) => {
    const f = (await fixture(t)), s = (await save(f)), key = randomUUID();
    const b = (await apply(f, s, f.a, {}, key));
    assert.deepEqual((await apply(f, s, f.a, {}, key)), b);
    assert.equal((await f.db.maybeOne("SELECT COUNT(*) AS n FROM bookings", [])).n, 1);
    assert.equal(b.state, 'pending');
    assert.equal((await f.service.slots())[0].remaining, 2);
    assert.equal((await f.service.slots())[0].confirmed_count, 0);
    const record = (await f.service.getBooking(b.id, f.a));
    assert.equal(record.request.enrollment.title, '虚拟成团活动');
    assert.equal(Object.hasOwn(record, 'owner'), false);
    (await fault(async () => (await f.service.getBooking(b.id, f.b)), 'NOT_FOUND'));
    const edited = (await update(f, s, { enrollment: { ...s.enrollment, title: '后续更名', feeNote: '后续维护费用说明' } }));
    assert.equal((await f.service.enrollment(s.id)).title, '后续更名');
    assert.equal((await f.service.getBooking(b.id, f.a)).request.enrollment.feeNote, '费用待联系确认');
    assert.equal((await f.service.getBooking(b.id, f.a)).request.enrollment.title, '虚拟成团活动');
    (await fault(async () => (await update(f, edited, { date: '2099-11-02' })), 'SLOT_HAS_BOOKINGS'));
    (await fault(async () => (await update(f, edited, { enrollment: { ...edited.enrollment, packageId: 'package-2' } })), 'SLOT_HAS_BOOKINGS'));
    assert.equal((await f.service.adminRecords(f.admin, 'bookings', { enrollment: '1', q: '虚拟成团' })).length, 1);
});
test('服务端拒绝篡改套餐、日期、时段、团体模式和超出当前可确认人数的报名', async (t) => {
    const f = (await fixture(t)), s = (await save(f));
    for (const extra of [{ packageId: 'package-2' }, { date: '2099-11-02' }, { slotId: randomUUID() }, { preferredTime: '改成下午' }, { group: true, team: '虚拟团队', total: 1 }])
        (await fault(async () => (await apply(f, s, f.a, extra))));
    (await fault(async () => (await apply(f, s, f.a, { adults: 3 })), 'CAPACITY_FULL'));
    assert.equal((await f.db.maybeOne("SELECT COUNT(*) AS n FROM bookings", [])).n, 0);
    const archived = (await update(f, s, { enrollment: { ...s.enrollment, state: 'archived' } }));
    (await fault(async () => (await apply(f, archived)), 'ENROLLMENT_UNAVAILABLE'));
});
test('人工确认计入系统外人数，满额、暂停、取消与场次绑定保持一致', async (t) => {
    const f = (await fixture(t)), s = (await save(f, { capacity: 5 }));
    const one = (await apply(f, s)), two = (await apply(f, s, f.b));
    const other = (await save(f, { enrollment: { state: 'draft' }, date: '2099-11-02' }));
    (await fault(async () => (await confirm(f, one, other)), 'ENROLLMENT_SLOT_MISMATCH'));
    const confirmed = (await confirm(f, one, s));
    assert.equal(confirmed.state, 'confirmed');
    assert.equal((await f.service.enrollment(s.id)).remaining, 0);
    assert.equal((await f.service.enrollment(s.id)).canApply, false);
    assert.equal((await f.service.enrollment(s.id)).availabilityLabel, '已满员');
    (await fault(async () => (await confirm(f, two, s)), 'CAPACITY_FULL'));
    const current = (await f.service.slots()).find(x => x.id === s.id);
    (await fault(async () => (await update(f, current, { externalCount: 5 })), 'CAPACITY_FULL'));
    (await f.service.handleBooking(f.admin, one.id, { action: 'cancel', version: confirmed.version, note: '隔离取消验证' }));
    assert.equal((await f.service.enrollment(s.id)).remaining, 1);
    const paused = (await update(f, current, { paused: true }));
    assert.equal((await f.service.enrollments()).some(e => e.id === s.id), false);
    (await fault(async () => (await confirm(f, two, paused)), 'SLOT_UNAVAILABLE'));
    const resumed = (await update(f, paused, { paused: false, enrollment: { ...paused.enrollment, state: 'archived' } }));
    assert.equal((await f.service.enrollments()).some(e => e.id === s.id), false);
    assert.equal((await confirm(f, two, resumed)).state, 'confirmed');
    assert.equal((await f.service.slots()).find(x => x.id === s.id).occupied_count, 5);
});
test('两工作人员并发确认跟团报名，系统外人数也受同一事务保护', async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'hq-enroll-concurrency-'));
    const path = join(dir, 'fixture.pg');
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const f = (await fixture(t, path)), s = (await save(f, { capacity: 5 })), one = (await apply(f, s)), two = (await apply(f, s, f.b));
    const barrier = new SharedArrayBuffer(4);
    let ready = 0;
    const spawn = (bookingId, actor) => new Promise((resolveResult, reject) => {
        const worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads');(async()=>{const {openDatabase}=await import(workerData.dbModule);const {Service}=await import(workerData.serviceModule);const db=openDatabase(workerData.config);parentPort.postMessage({ready:true});Atomics.wait(new Int32Array(workerData.barrier),0,0);try{const r=await new Service(db).handleBooking(workerData.actor,workerData.bookingId,{action:'confirm',version:1,slotId:workerData.slotId,note:'并发跟团确认',assignee:workerData.actor.id});parentPort.postMessage({state:r.state});}catch(e){parentPort.postMessage({code:e.code});}finally{await db.close();}})();`, { eval: true, workerData: { config:{connectionString:f.db.connectionString,schema:f.db.schema}, barrier, actor, bookingId, slotId: s.id, dbModule: new URL('../server/db.mjs', import.meta.url).href, serviceModule: new URL('../server/service.mjs', import.meta.url).href } });
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
    const results = await Promise.all([spawn(one.id, f.admin), spawn(two.id, f.reception)]);
    assert.equal(results.filter(r => r.state === 'confirmed').length, 1);
    assert.equal(results.filter(r => r.code === 'CAPACITY_FULL').length, 1);
    assert.equal((await f.service.slots())[0].occupied_count, 5);
});
test('HTTP匿名查看活动、游客身份提交、后台确认、停报与本人查询闭环', async (t) => {
    const f = (await fixture(t)), s = (await save(f));
    const { server } = createHttpServer({ db: f.db, root: resolve('.'), uploads: join(tmpdir(), 'unused-enrollment-media') });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise(async (r) => (await server.close(r))));
    const base = 'http://127.0.0.1:' + server.address().port;
    const token = (await issueSession(f.db, f.a.id, 'visitor')), staff = (await issueSession(f.db, f.admin.id, 'admin'));
    let r = await fetch(base + '/api/public/slots');
    assert.equal(Object.hasOwn((await r.json())[0], 'note'), false);
    r = await fetch(base + '/api/public/enrollments');
    assert.equal(r.status, 200);
    assert.equal((await r.json()).length, 1);
    r = await fetch(base + '/api/public/enrollments/' + s.id);
    assert.equal((await r.json()).remaining, 2);
    r = await fetch(base + '/api/visitor/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() }, body: JSON.stringify((await request(s))) });
    assert.equal(r.status, 401);
    r = await fetch(base + '/api/visitor/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token.token, 'Idempotency-Key': randomUUID() }, body: JSON.stringify((await request(s))) });
    assert.equal(r.status, 201);
    const b = await r.json();
    assert.equal(b.state, 'pending');
    r = await fetch(base + '/api/admin/bookings/' + b.id, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HQ-Action': '1', Cookie: 'hq_admin=' + staff.token }, body: JSON.stringify({ action: 'confirm', version: 1, slotId: s.id, note: 'HTTP隔离确认' }) });
    assert.equal(r.status, 200);
    r = await fetch(base + '/api/visitor/bookings/' + b.id, { headers: { Authorization: 'Bearer ' + token.token } });
    const record = await r.json();
    assert.equal(record.state, 'confirmed');
    assert.equal(record.confirmed.date, s.date);
    assert.equal(record.request.enrollment.id, s.id);
    const current = (await f.service.slots())[0];
    (await update(f, current, { enrollment: { ...current.enrollment, state: 'archived' } }));
    assert.equal((await fetch(base + '/api/public/enrollments/' + s.id)).status, 404);
    r = await fetch(base + '/api/visitor/bookings/' + b.id, { headers: { Authorization: 'Bearer ' + token.token } });
    assert.equal((await r.json()).request.enrollment.title, '虚拟成团活动');
});
test('报名配置、系统外人数与历史申请备份恢复，恢复不保留旧会话', async (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'hq-enroll-restore-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const source = join(dir, 'source');
    mkdirSync(source);
    const f = (await fixture(t, join(source, 'fixture.pg'))), s = (await save(f)), b = (await apply(f, s));
    (await confirm(f, b, s));
    (await issueSession(f.db, f.a.id, 'visitor'));
    const backup = join(dir, 'backup'), target = join(dir, 'restored');
    (await backupData(source, backup));
    (await restoreData(backup, target));
    const restored = (await openDatabase(join(target, 'fixture.pg')));
    try {
        const service = new Service(restored);
        assert.equal((await service.enrollment(s.id)).remaining, 1);
        assert.equal((await service.slots())[0].external_count, 4);
        assert.equal((await service.getBooking(b.id, f.a)).request.enrollment.title, '虚拟成团活动');
        assert.equal((await restored.maybeOne("SELECT COUNT(*) AS n FROM sessions", [])).n, 0);
    }
    finally {
        (await restored.close());
    }
});
