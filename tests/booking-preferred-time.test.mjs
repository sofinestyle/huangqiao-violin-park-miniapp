import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './pg-test-db.mjs';
import { seed } from '../server/seed.mjs';
import { Service } from '../server/service.mjs';
import { createHttpServer } from '../server/http.mjs';
import { issueSession } from '../server/security.mjs';
import { resolve } from 'node:path';
async function fixture(t) {
    const db = (await openDatabase(':memory:'));
    (await seed(db));
    t.after(async () => (await db.close()));
    const service = new Service(db);
    const visitor = { id: randomUUID() };
    (await db.execute("INSERT INTO visitors VALUES ($1,NULL,$2)", [visitor.id, new Date().toISOString()]));
    return { db, service, visitor, actor: { id: 'preferred-time-test', roles: ['admin'] } };
}
const request = (extra = {}) => ({ packageId: 'package-1', date: '2099-10-20', contactName: '虚拟测试访客', phone: '13800000000', adults: 1, children: 0, note: '仅隔离验证', consent: true, ...extra });
test('自由时段通过HTTP真实保存、本人及后台读取，修改时段影响幂等，不占容量', async (t) => {
    const f = (await fixture(t));
    const { server } = createHttpServer({ db: f.db, root: resolve('.'), uploads: resolve('.qa/unused-preferred-time') });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise(async (r) => (await server.close(r))));
    const token = (await issueSession(f.db, f.visitor.id, 'visitor')).token, key = randomUUID(), base = 'http://127.0.0.1:' + server.address().port;
    const send = body => fetch(base + '/api/visitor/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, 'Idempotency-Key': key }, body: JSON.stringify(body) });
    const body = (await request({ preferredTime: '  上午9:30—11:30  ' }));
    let response = await send(body);
    assert.equal(response.status, 201);
    const saved = await response.json();
    response = await fetch(base + '/api/visitor/bookings/' + saved.id, { headers: { Authorization: 'Bearer ' + token } });
    assert.equal(response.status, 200);
    const row = await response.json();
    assert.equal(row.request.preferredTime, '上午9:30—11:30');
    assert.equal(row.request.slotId, null);
    assert.equal(row.state, 'pending');
    assert.equal(row.slot_id, null);
    assert.equal((await f.service.adminRecords(f.actor, 'bookings')).find(x => x.id === row.id).request.preferredTime, '上午9:30—11:30');
    response = await send(body);
    assert.equal((await response.json()).id, saved.id);
    response = await send({ ...body, preferredTime: '下午' });
    assert.equal(response.status, 409);
    assert.equal((await f.db.maybeOne("select count(*) n from bookings", [])).n, 1);
});
test('旧请求及可选空时段兼容，团体仍要求独立需求说明', async (t) => {
    const f = (await fixture(t));
    for (const preferredTime of [undefined, null, '', '   ']) {
        const b = (await f.service.createBooking(f.visitor, (await request({ preferredTime })), randomUUID()));
        assert.equal((await f.service.getBooking(b.id, f.visitor)).request.preferredTime, undefined);
    }
    const data = (await request({ group: true, packageId: null, team: '虚拟团队', total: 3, preferredTime: '下午，具体时间电话联系' }));
    const b = (await f.service.createBooking(f.visitor, data, randomUUID()));
    assert.equal((await f.service.getBooking(b.id, f.visitor)).request.preferredTime, data.preferredTime);
    (await assert.rejects(async () => (await f.service.createBooking(f.visitor, { ...data, note: '' }, randomUUID())), e => e.status === 400));
});
test('非法或过长时段被拒绝且不产生记录', async (t) => {
    const f = (await fixture(t));
    for (const preferredTime of [123, {}, [], true, '时'.repeat(101)])
        (await assert.rejects(async () => (await f.service.createBooking(f.visitor, (await request({ preferredTime })), randomUUID())), e => e.status === 400));
    assert.equal((await f.db.maybeOne("select count(*) n from bookings", [])).n, 0);
});
