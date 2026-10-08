import { decode } from '../server/db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { openDatabase } from './pg-test-db.mjs';
import { Service } from '../server/service.mjs';
import { seed } from '../server/seed.mjs';
import { productPayload, option } from '../server/sku-seed.mjs';
import { listMedia } from '../server/media.mjs';
import { createAccount, issueSession } from '../server/security.mjs';
import { createHttpServer } from '../server/http.mjs';
import { auditActionLabel } from '../admin/src/audit-actions.mjs';
import { retireDefinition, historicalDefinition, persistedDefinition } from '../admin/src/sku-delete.mjs';
import { planSkus } from '../shared/sku-model.mjs';
const actor = { id: 'isolated-delete', roles: ['admin'] };
async function fixture(t) { const dir = mkdtempSync(join(tmpdir(), 'content-delete-')), db = (await openDatabase(join(dir, 'fixture.pg'))), service = new Service(db); (await seed(db)); t.after(async () => { (await db.close()); rmSync(dir, { recursive: true, force: true }); }); return { db, dir, s: service }; }
async function create(s, kind = 'product', state = 'draft', extra = {}) { const payload = kind === 'product' ? productPayload('隔离删除产品', [option('尺寸', ['4/4', '3/4'])], extra) : { kind, name: '隔离删除' + kind, data: { isTest: true, images: [], ...extra } }; payload.state = state; return (await s.saveContent(actor, payload)); }
async function state(s, p, value) { const { id, kind, name, sort, version, skus, specs, state, ...data } = (await s.content(p.id, false)); return (await s.saveContent(actor, { kind, name, sort, version, state: value, data, ...(skus ? { skus: skus.filter(s => s.current) } : {}) }, id)); }
async function visitor(db) { const id = randomUUID(); (await db.execute("INSERT INTO visitors VALUES ($1,NULL,$2)", [id, 'now'])); return { id }; }
async function consultation(s, db, p) { return (await s.createConsultation((await visitor(db)), { contentId: p.id, skuId: p.skus?.find(s => s.current && s.enabled)?.id, contactName: '合成访客', phone: '13800000000', message: '隔离测试', consent: true }, randomUUID())); }
async function booking(s, db, p, extra = {}) { return (await s.createBooking((await visitor(db)), { packageId: p.id, date: '2099-11-01', contactName: '合成访客', phone: '13800000000', adults: 1, children: 0, consent: true, ...extra }, randomUUID())); }
async function slot(s, p, extra = {}) { return (await s.saveSlot(actor, { date: '2099-11-01', start: '09:00', end: '11:00', capacity: 20, packageIds: [p.id], note: '隔离', enrollment: { state: 'draft' }, ...extra })); }
const rejects = async (fn, code) => (await assert.rejects(async()=>fn(), e => e.code === code));
for (const [kind, category, stateName] of [['product', 'violin', 'draft'], ['product', 'violin', 'archived'], ['product', 'gift', 'draft'], ['package', null, 'draft'], ['lesson', null, 'draft']])
    test(`CD safe delete ${kind}/${category}/${stateName}, audit survives`, async (t) => { const { s, db } = (await fixture(t)), p = (await create(s, kind, stateName, category ? { category } : {})); assert.equal((await s.contentDeleteCheck(actor, p.id)).allowed, true); assert.deepEqual((await s.deleteContent(actor, p.id, p.version)), { ok: true, id: p.id }); assert.equal((await db.maybeOne("SELECT count(*) n FROM content WHERE id=$1", [p.id])).n, 0); assert.equal((await db.maybeOne("SELECT count(*) n FROM product_skus WHERE product_id=$1", [p.id])).n, 0); const log = (await db.maybeOne("SELECT * FROM audit WHERE action='content.delete' AND object=$1", [p.id])); assert.deepEqual(decode(log.detail), { id: p.id, kind: p.kind, name: p.name, state: stateName }); assert.equal(auditActionLabel(log.action), '删除内容'); assert.ok((await db.maybeOne("SELECT 1 FROM audit WHERE action='content.create' AND object=$1", [p.id]))); });
test('CD published, unsupported, missing and invalid version fail without deletion', async (t) => { const { s } = (await fixture(t)), p = (await create(s, 'product', 'published')); (await rejects(async () => (await s.deleteContent(actor, p.id, p.version)), 'CONTENT_DELETE_REQUIRES_UNPUBLISHED')); const spot = (await s.listContent({ kind: 'spot' }, true))[0]; const archived = (await state(s, spot, 'archived')); (await rejects(async () => (await s.deleteContent(actor, archived.id, archived.version)), 'CONTENT_DELETE_UNSUPPORTED')); (await rejects(async () => (await s.deleteContent(actor, 'missing', 1)), 'CONTENT_NOT_FOUND')); (await rejects(async () => (await s.deleteContent(actor, p.id, '1')), 'INVALID_VERSION')); });
test('CD consultation snapshot blocks product, gift, lesson and package including closed history', async (t) => {
    const { s, db } = (await fixture(t));
    for (const [kind, extra] of [['product', {}], ['product', { category: 'gift' }], ['lesson', {}], ['package', {}]]) {
        let p = (await create(s, kind, 'published', extra));
        const c = (await consultation(s, db, p));
        (await db.execute("UPDATE consultations SET state='closed' WHERE id=$1", [c.id]));
        p = (await state(s, p, 'archived'));
        const before = (await db.maybeOne("SELECT * FROM consultations WHERE id=$1", [c.id]));
        const check = (await s.contentDeleteCheck(actor, p.id));
        assert.equal(check.references.consultations, 1);
        (await rejects(async () => (await s.deleteContent(actor, p.id, p.version)), 'CONTENT_DELETE_REFERENCED'));
        assert.deepEqual((await db.maybeOne("SELECT * FROM consultations WHERE id=$1", [c.id])), before);
        assert.ok(!JSON.stringify(check).includes('13800000000'));
    }
});
test('CD package slots protects package_ids and enrollment.packageId independently', async (t) => {
    const { s, db } = (await fixture(t));
    let a = (await create(s, 'package', 'published')), b = (await create(s, 'package', 'published'));
    const row = (await slot(s, a, { enrollment: { state: 'draft', packageId: b.id } }));
    for (let p of [a, b]) {
        p = (await state(s, p, 'archived'));
        assert.equal((await s.contentDeleteCheck(actor, p.id)).references.sessions, 1);
        (await rejects(async () => (await s.deleteContent(actor, p.id, p.version)), 'CONTENT_DELETE_REFERENCED'));
    }
    assert.ok((await db.maybeOne("SELECT 1 FROM slots WHERE id=$1", [row.id])));
});
test('CD booking protects direct snapshot and all indirect enrollment/slot paths', async (t) => {
    const { s, db } = (await fixture(t));
    let p = (await create(s, 'package', 'published'));
    const b = (await booking(s, db, p));
    (await db.execute("UPDATE bookings SET state='cancelled' WHERE id=$1", [b.id]));
    p = (await state(s, p, 'archived'));
    assert.equal((await s.contentDeleteCheck(actor, p.id)).references.bookings, 1);
    (await rejects(async () => (await s.deleteContent(actor, p.id, p.version)), 'CONTENT_DELETE_REFERENCED'));
    const sl = (await slot(s, p));
    for (const [request, slotId] of [[{ enrollment: { packageId: p.id } }, null], [{ slotId: sl.id }, null], [{ enrollment: { id: sl.id } }, null], [{}, sl.id]]) {
        (await db.execute("UPDATE bookings SET snapshot=$1,request=$2,slot_id=$3 WHERE id=$4", ['{}', JSON.stringify(request), slotId, b.id]));
        assert.equal((await s.contentDeleteCheck(actor, p.id)).references.bookings, 1);
        (await rejects(async () => (await s.deleteContent(actor, p.id, p.version)), 'CONTENT_DELETE_REFERENCED'));
    }
});
test('CD latest state, new references and stale version are checked after preflight', async (t) => { const { s, db } = (await fixture(t)); let p = (await create(s)); const check = (await s.contentDeleteCheck(actor, p.id)); p = (await state(s, p, 'published')); (await rejects(async () => (await s.deleteContent(actor, p.id, check.version)), 'CONTENT_DELETE_REQUIRES_UNPUBLISHED')); p = (await state(s, p, 'archived')); const stale = p.version; p = (await state(s, p, 'draft')); (await rejects(async () => (await s.deleteContent(actor, p.id, stale)), 'VERSION_CONFLICT')); assert.equal((await s.contentDeleteCheck(actor, p.id)).allowed, true); p = (await state(s, p, 'published')); (await consultation(s, db, p)); p = (await state(s, p, 'archived')); (await rejects(async () => (await s.deleteContent(actor, p.id, p.version)), 'CONTENT_DELETE_REFERENCED')); let pkg = (await create(s, 'package', 'draft')); assert.equal((await s.contentDeleteCheck(actor, pkg.id)).allowed, true); (await slot(s, pkg)); (await rejects(async () => (await s.deleteContent(actor, pkg.id, pkg.version)), 'CONTENT_DELETE_REFERENCED')); let pending = (await create(s, 'package', 'draft')); assert.equal((await s.contentDeleteCheck(actor, pending.id)).allowed, true); pending = (await state(s, pending, 'published')); (await booking(s, db, pending)); pending = (await state(s, pending, 'archived')); (await rejects(async () => (await s.deleteContent(actor, pending.id, pending.version)), 'CONTENT_DELETE_REFERENCED')); });
test('CD audit failure rolls back both content and SKU deletion; schema unchanged', async (t) => { const { s, db } = (await fixture(t)), p = (await create(s)), schema = (await db.many("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=current_schema() ORDER BY table_name,ordinal_position", [])), rows = (await db.many("SELECT * FROM product_skus WHERE product_id=$1", [p.id])); await db.query("CREATE FUNCTION fail_delete_audit_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated failure'; END $$; CREATE TRIGGER fail_delete_audit BEFORE INSERT ON audit FOR EACH ROW WHEN (NEW.action='content.delete') EXECUTE FUNCTION fail_delete_audit_fn()"); (await assert.rejects(async () => (await s.deleteContent(actor, p.id, p.version)))); assert.equal((await s.content(p.id, false)).id, p.id); assert.deepEqual((await db.many("SELECT * FROM product_skus WHERE product_id=$1", [p.id])), rows); await db.query('DROP TRIGGER fail_delete_audit ON audit; DROP FUNCTION fail_delete_audit_fn()'); assert.deepEqual((await db.many("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=current_schema() ORDER BY table_name,ordinal_position", [])), schema); });
test('CD media records/files survive all content deletes and usedBy recomputes including SKU', async (t) => {
    const { s, db, dir } = (await fixture(t));
    const media = async (mime) => { const id = randomUUID(); writeFileSync(join(dir, id), 'isolated media bytes'); (await db.execute("INSERT INTO media VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [id, 'synthetic', mime, 20, 'hash', id, 'isolated', 1, 'now'])); return id; };
    const img = (await media('image/png')), skuImage = (await media('image/png')), video = (await media('video/mp4')), url = '/api/media/' + img;
    let a = (await create(s, 'product', 'draft', { images: [url] })), b = (await create(s, 'product', 'draft', { images: [url] })), pkg = (await create(s, 'package', 'draft', { images: [url] })), lesson = (await create(s, 'lesson', 'draft', { images: [url], type: 'video', mediaId: video }));
    (await db.execute("UPDATE product_skus SET images=$1 WHERE product_id=$2", [JSON.stringify(['/api/media/' + skuImage]), a.id]));
    assert.equal((await listMedia(db)).find(m => m.id === skuImage).usedBy.length, 1);
    assert.equal((await listMedia(db)).find(m => m.id === img).usedBy.length, 4);
    (await s.deleteContent(actor, a.id, a.version));
    assert.equal((await listMedia(db)).find(m => m.id === skuImage).usedBy.length, 0);
    assert.equal((await listMedia(db)).find(m => m.id === img).usedBy.length, 3);
    for (const p of [b, pkg, lesson])
        (await s.deleteContent(actor, p.id, p.version));
    assert.ok((await listMedia(db)).every(m => m.usedBy.length === 0));
    assert.equal((await listMedia(db)).length, 3);
    assert.ok([img, skuImage, video].every(id => existsSync(join(dir, id))));
});
test('CD HTTP permission matrix and private-free error contracts', async (t) => {
    const { s, db, dir } = (await fixture(t)), { server } = createHttpServer({ devAuth:true, db, uploads: dir, root: new URL('../', import.meta.url).pathname });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise(async (r) => (await server.close(r))));
    const base = 'http://127.0.0.1:' + server.address().port;
    const tokens = {};
    for (const role of ['admin', 'content', 'reception']) {
        const a = (await createAccount(db, { username: 'cd_' + role, password: randomUUID(), roles: [role] }));
        tokens[role] = (await issueSession(db, a.id, 'admin')).token;
    }
    const call = (path, role, method = 'GET', body) => fetch(base + '/api/admin/content/' + path, { method, headers: { 'Content-Type': 'application/json', 'X-HQ-Action': '1', ...(tokens[role] ? { Cookie: 'hq_admin=' + tokens[role] } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    for (const [role, status] of [['admin', 200], ['content', 200], ['reception', 403], ['anonymous', 401]]) {
        const p = (await create(s));
        assert.equal((await call(p.id + '/delete-check', role)).status, status);
        const r = await call(p.id, role, 'DELETE', { version: p.version });
        assert.equal(r.status, status);
    }
    let p = (await create(s, 'lesson', 'published'));
    (await consultation(s, db, p));
    p = (await state(s, p, 'archived'));
    const r = await call(p.id, 'admin', 'DELETE', { version: p.version }), json = await r.json();
    assert.equal(r.status, 409);
    assert.equal(json.code, 'CONTENT_DELETE_REFERENCED');
    assert.equal(json.references.consultations, 1);
    assert.ok(!JSON.stringify(json).includes('13800000000'));
    assert.equal((await call('missing', 'admin', 'DELETE', { version: 1 })).status, 404);
});
test('CD draft definitions remove physically; persisted definitions retire without mutation', () => { const o = option('颜色', ['自然色', '棕色']), base = structuredClone([o]), extra = option('套装', ['基础']); assert.equal(persistedDefinition(base, extra.id), false); assert.equal(retireDefinition([o, extra], base, extra.id).length, 1); const added = { id: randomUUID(), label: '新值', sort: 3, enabled: true }; const withNew = [{ ...o, values: [...o.values, added] }]; assert.equal(retireDefinition(withNew, base, o.id, added.id)[0].values.length, 2); const retired = retireDefinition([o], base, o.id, o.values[1].id); assert.equal(retired[0].values[1].enabled, false); assert.equal(base[0].values[1].enabled, true); assert.equal(retireDefinition([o], base, o.id)[0].enabled, false); });
test('CD same-name history recovery detects trim/case and retains old definition identity', () => { const o = option('Color', ['Natural', 'Brown']); o.values[1].enabled = false; const added = { id: randomUUID(), label: ' brown ', sort: 2, enabled: true }; o.values.push(added); assert.equal(historicalDefinition([o], o.id, added.id).id, o.values[1].id); const retired = { ...o, enabled: false }, newO = option(' COLOR ', ['x']); assert.equal(historicalDefinition([retired, newO], newO.id).id, retired.id); });
