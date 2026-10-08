import { skuWrite } from './product-sku-helper.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './pg-test-db.mjs';
import { seed } from '../server/seed.mjs';
import { Service } from '../server/service.mjs';
import { createAccount } from '../server/security.mjs';
import { createHttpServer } from '../server/http.mjs';
export async function fixture() {
    const root = new URL('../', import.meta.url).pathname, dir = mkdtempSync(join(tmpdir(), 'admin-business-'));
    const db = (await openDatabase(join(dir, 'fixture.pg')));
    (await seed(db));
    const service = new Service(db), accounts = {}, passwords = {};
    for (const role of ['admin', 'reception', 'content']) {
        passwords[role] = randomUUID();
        accounts[role] = (await createAccount(db, { username: 'qa_' + role, password: passwords[role], roles: [role], canExport: role === 'admin' }));
    }
    const actor = accounts.admin, records = {}, sessions = {};
    const saveSlot = async (extra) => (await service.saveSlot(actor, { date: '2099-11-01', start: '09:00', end: '11:00', capacity: 40, externalCount: 8, packageIds: ['package-1', 'package-2'], note: '隔离验证接待安排，不代表正式配置。', enrollment: { state: 'published', title: '隔离验证 · 提琴工艺体验', packageId: 'package-1', meetingPoint: '隔离集合点', description: '仅验证现有机制', feeNote: '隔离测试说明', registrationNote: '人工确认后安排' }, ...extra }));
    sessions.normal = (await saveSlot({}));
    sessions.next = (await saveSlot({ date: '2099-11-02', start: '13:30', end: '15:30', externalCount: 0, enrollment: { state: 'draft', title: '隔离验证 · 后续接待' } }));
    sessions.paused = (await saveSlot({ date: '2099-11-03', paused: true, externalCount: 0, enrollment: { state: 'archived', title: '隔离验证 · 暂停活动' } }));
    sessions.full = (await saveSlot({ date: '2099-11-04', capacity: 20, externalCount: 20, enrollment: { state: 'published', title: '隔离验证 · 已满活动', packageId: 'package-1', meetingPoint: '隔离集合点' } }));
    sessions.large = (await saveSlot({ date: '2099-11-05', capacity: 10000, externalCount: 0, enrollment: { state: 'draft', title: '隔离长活动名称用于桌面排版边界检查'.repeat(3) } }));
    const visitor = { id: randomUUID() };
    (await db.execute("INSERT INTO visitors VALUES ($1,NULL,$2)", [visitor.id, new Date().toISOString()]));
    const book = async (extra = {}) => { const b = (await service.createBooking(visitor, { packageId: 'package-1', date: '2099-11-01', contactName: '验证访客甲', phone: '13800000000', adults: 2, children: 1, note: '隔离验证需求；不作实际预约。', consent: true, ...extra }, randomUUID())); return (await service.getBooking(b.id, null, true)); };
    const act = async (r, action, extra = {}) => (await service.handleBooking(actor, r.id, { action, version: r.version, note: '隔离验证操作记录，不作实际接待。', slotId: sessions.normal.id, assignee: accounts.reception.id, ...extra }));
    records.pending = (await book({ preferredTime: '上午，具体安排待联系确认' }));
    records.join = (await book({ enrollmentId: sessions.normal.id, slotId: sessions.normal.id, contactName: '验证跟团访客', adults: 1, children: 0 }));
    records.confirmed = (await act((await book({ contactName: '验证已确认访客' })), 'confirm'));
    records.completed = (await act((await act((await act((await book({ contactName: '验证已完成访客', adults: 1, children: 0 })), 'confirm')), 'arrive')), 'complete'));
    records.noShow = (await act((await act((await book({ contactName: '验证未到访访客', adults: 1, children: 0 })), 'confirm')), 'no_show'));
    records.cancelled = (await act((await act((await book({ contactName: '验证已取消访客', adults: 1, children: 0 })), 'confirm')), 'cancel'));
    records.rejected = (await act((await book({ contactName: '验证无法接待访客', adults: 1, children: 0 })), 'reject'));
    records.change = (await act((await book({ contactName: '验证变更访客', adults: 1, children: 0 })), 'confirm'));
    (await service.requestChange(visitor, records.change.id, { type: 'reschedule', reason: '隔离改期验证', date: '2099-11-02', adults: 2, children: 0 }));
    records.change = (await service.getBooking(records.change.id, null, true));
    records.long = (await book({ group: true, packageId: null, team: '隔离长团队名称用于桌面边界检查'.repeat(3), contactName: '隔离长联系人名称'.repeat(4), total: 9999, date: '2099-11-05', note: '隔离团体需求长说明。'.repeat(40) }));
    const consult = async (extra = {}) => {
        const contentId = extra.contentId || 'violin-L201';
        let product = (await service.content(contentId, false));
        if (product.kind === 'product' && product.variantModelVersion !== 2)
            product = (await skuWrite(service, actor, { kind: product.kind, name: product.name, state: product.state, sort: product.sort, version: product.version, data: product }, contentId));
        const c = (await service.createConsultation(visitor, { contentId, skuId: product.skus?.find(s => s.current && s.enabled)?.id, source: '乐器规格咨询', contactName: '验证咨询访客', phone: '13800000000', message: '希望了解产品规格与线下咨询安排。仅隔离验证。', consent: true, ...extra }, randomUUID()));
        return (await service.getConsultation(c.id, null, true));
    };
    records.consultPending = (await consult({ contactName: '验证咨询待处理' }));
    records.consultFollowing = (await consult({ contactName: '验证咨询跟进' }));
    records.consultFollowing = (await service.handleConsultation(actor, records.consultFollowing.id, { action: 'followup', version: records.consultFollowing.version, note: '隔离验证：已联系，待进一步跟进。' }));
    records.consultClosed = (await consult({ contactName: '验证咨询已结束' }));
    records.consultClosed = (await service.handleConsultation(actor, records.consultClosed.id, { action: 'close', version: records.consultClosed.version, note: '隔离验证：沟通结果已记录。' }));
    records.consultLong = (await consult({ contactName: '隔离长咨询联系人'.repeat(3), message: '这是一段隔离长咨询内容，用于检查摘要、换行及完整详情阅读，不代表实际客户问题。\n'.repeat(20) }));
    const { server } = createHttpServer({ devAuth:true, db, uploads: join(dir, 'uploads'), root, devAuth: true });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    const base = 'http://127.0.0.1:' + server.address().port;
    return { root, dir, db, service, server, accounts, passwords, sessions, records, visitor, actor, book, consult, act, base, url: base + '/admin/', close: async () => { await new Promise(async (r) => (await server.close(r))); (await db.close()); rmSync(dir, { recursive: true, force: true }); } };
}
