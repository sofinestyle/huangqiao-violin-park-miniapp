import { decode } from '../server/db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './pg-test-db.mjs';
import { Service } from '../server/service.mjs';
import { productPayload, option, seedSkuProducts } from '../server/sku-seed.mjs';
import { planSkus, combinationKey } from '../shared/sku-model.mjs';
import {migrate} from '../server/db.mjs';
import { backupData, restoreData } from './pg-test-db.mjs';
import { resetSkuDev } from '../scripts/reset-sku-dev.mjs';
import { createHttpServer } from '../server/http.mjs';
import { createAccount, issueSession } from '../server/security.mjs';
import { listMedia } from '../server/media.mjs';
const actor = { id: 'synthetic-sku-admin', roles: ['admin'] };
async function fixture(t) { const db = (await openDatabase(':memory:')); t.after(async () => (await db.close())); return { db, service: new Service(db) }; }
export function editPayload(p, change = {}) {
    const { id, kind, name, state, sort, version, skus, specs, ...data } = p;
    Object.assign(data, change);
    const plan = planSkus(data.variantMode, data.options, p.variantMode, skus);
    if (plan.error)
        throw new Error(plan.error);
    return { kind, name, state, sort, version, data, skus: plan.current.map(({ id, sku_code, option_values, reference_price, images, enabled, sort_order }) => ({ ...(id ? { id } : {}), sku_code, option_values, reference_price, images, enabled, sort_order })) };
}
const matrix = (dims = [5, 2]) => dims.map((n, i) => option(['尺寸', '颜色', '套装'][i], Array.from({ length: n }, (_, j) => `值${j + 1}`), i));
const save = async (s, p) => (await s.saveContent(actor, editPayload(p), p.id));
const invalid = async (fn, pattern) => (await assert.rejects(async()=>fn(), pattern || /./));
test('SKU simple creation edit null and zero inheritance; code trim and identity stable', async (t) => { const { service: s } = (await fixture(t)), p = (await s.saveContent(actor, productPayload('合成simple'))); assert.equal(p.skus.length, 1); const q = editPayload(p); q.skus[0].reference_price = 0; q.skus[0].sku_code = ' new_CODE '; const next = (await s.saveContent(actor, q, p.id)); assert.equal(next.skus[0].id, p.skus[0].id); assert.equal(next.skus[0].sku_code, 'new_CODE'); assert.equal(next.skus[0].effectiveReferencePrice, 0); const r = editPayload(next); r.skus[0].reference_price = null; assert.equal((await s.saveContent(actor, r, p.id)).skus[0].effectiveReferencePrice, 450); });
for (const [count, dims] of [[10, [5, 2]], [20, [5, 2, 2]], [12, [4, 3]], [50, [10, 5]]])
    test(`SKU ${count} combination creation and bounded read/save`, async (t) => {
        const { service: s } = (await fixture(t)), start = performance.now();
        const p = (await s.saveContent(actor, productPayload('合成' + count, matrix(dims))));
        assert.equal(p.skus.length, count);
        assert.equal((await save(s, p)).skus.length, count);
        if (count === 50)
            console.log('SKU50 read/save ms', Math.round(performance.now() - start));
    });
test('SKU rejects 51 combinations, 4 dimensions, 21 active values, no dimension and empty values', async (t) => {
    const { service: s } = (await fixture(t));
    for (const dims of [[17, 3], [2, 2, 2, 2], [21]]) {
        const opts = dims.map((n, i) => option('维' + i, Array.from({ length: n }, (_, j) => '' + j), i));
        (await invalid(async () => (await s.saveContent(actor, productPayload('invalid', opts)))));
    }
    const p = productPayload('invalid');
    p.data.variantMode = 'options';
    (await invalid(async () => (await s.saveContent(actor, p))));
    p.data.options = [option('颜色', [])];
    (await invalid(async () => (await s.saveContent(actor, p))));
});
test('SKU labels trim, case-insensitive duplicate names/values and invalid IDs rejected', async (t) => {
    const { service: s } = (await fixture(t));
    for (const opts of [[option('Color', ['a']), option(' color ', ['b'], 1)], [option('尺寸', ['A', ' a '])]])
        (await invalid(async () => (await s.saveContent(actor, productPayload('invalid', opts)))));
    const p = productPayload('invalid', matrix());
    p.data.options[0].id = 'index0';
    (await invalid(async () => (await s.saveContent(actor, p))));
    p.data.options[0].id = p.data.options[1].id;
    (await invalid(async () => (await s.saveContent(actor, p))));
});
test('SKU codes global case-insensitive unique including inactive; format and empty validation', async (t) => {
    const { service: s } = (await fixture(t));
    const p = productPayload('one');
    p.skus[0].sku_code = 'ABC';
    (await s.saveContent(actor, p));
    for (const code of [' abc ', '', 'bad/编码', 'x'.repeat(65)]) {
        const q = productPayload('two');
        q.skus[0].sku_code = code;
        (await invalid(async () => (await s.saveContent(actor, q))));
    }
    const q = productPayload('multi', matrix());
    q.skus[1].sku_code = q.skus[0].sku_code;
    (await invalid(async () => (await s.saveContent(actor, q))));
});
test('SKU rejects duplicate and incomplete combination and foreign SKU identity', async (t) => { const { service: s } = (await fixture(t)), a = (await s.saveContent(actor, productPayload('a'))), p = productPayload('multi', matrix()); p.skus[0].id = a.skus[0].id; (await invalid(async () => (await s.saveContent(actor, p)))); delete p.skus[0].id; p.skus[1].option_values = p.skus[0].option_values; (await invalid(async () => (await s.saveContent(actor, p)))); p.skus[0].option_values = {}; (await invalid(async () => (await s.saveContent(actor, p)))); });
test('SKU option/value rename and reorder retain IDs and codes', async (t) => {
    const { service: s } = (await fixture(t)), p = (await s.saveContent(actor, productPayload('multi', matrix()))), opts = structuredClone(p.options);
    opts[0].name = '琴体尺寸';
    opts[1].values[0].label = '复古棕';
    opts[0].values[0].sort = 8;
    const next = (await s.saveContent(actor, editPayload(p, { options: opts }), p.id));
    assert.deepEqual(next.skus.map(x => x.id).sort(), p.skus.map(x => x.id).sort());
    for (const row of next.skus)
        assert.equal(row.sku_code, p.skus.find(x => x.id === row.id).sku_code);
});
test('SKU dimension extension 10 to 20 preserves original 10 IDs and overrides', async (t) => {
    const { service: s } = (await fixture(t));
    let p = (await s.saveContent(actor, productPayload('multi', matrix())));
    let q = editPayload(p);
    q.skus[0].reference_price = 480;
    p = (await s.saveContent(actor, q, p.id));
    const next = (await s.saveContent(actor, editPayload(p, { options: [...p.options, option('套装', ['标准', '高级'], 2)] }), p.id));
    assert.equal(next.skus.length, 20);
    for (const old of p.skus) {
        const row = next.skus.find(s => s.id === old.id);
        assert.ok(row);
        assert.equal(row.sku_code, old.sku_code);
        assert.equal(row.reference_price, old.reference_price);
    }
});
test('SKU value disable/restore keeps identity and individual manual disable', async (t) => { const { service: s, db } = (await fixture(t)); let p = (await s.saveContent(actor, productPayload('multi', matrix()))); let q = editPayload(p); q.skus[0].enabled = false; p = (await s.saveContent(actor, q, p.id)); const opts = structuredClone(p.options); opts[1].values[1].enabled = false; p = (await s.saveContent(actor, editPayload(p, { options: opts }), p.id)); assert.equal(p.skus.filter(s => s.enabled).length, 4); assert.equal((await db.maybeOne("SELECT count(*) n FROM product_skus", [])).n, 10); const ids = p.skus.map(s => s.id).sort(); opts[1].values[1].enabled = true; p = (await s.saveContent(actor, editPayload(p, { options: opts }), p.id)); assert.equal(p.skus.filter(s => s.enabled).length, 9); assert.deepEqual(p.skus.map(s => s.id).sort(), ids); });
test('SKU dimension retirement and restoration preserve original combinations', async (t) => { const { service: s } = (await fixture(t)); let p = (await s.saveContent(actor, productPayload('multi', matrix()))); const ids = p.skus.map(s => s.id).sort(), opts = structuredClone(p.options); opts[1].enabled = false; p = (await s.saveContent(actor, editPayload(p, { options: opts }), p.id)); assert.equal(p.skus.filter(s => s.current).length, 5); assert.equal(p.skus.filter(s => !s.current).length, 10); opts[1].enabled = true; p = (await s.saveContent(actor, editPayload(p, { options: opts }), p.id)); assert.deepEqual(p.skus.filter(s => s.current).map(s => s.id).sort(), ids); });
test('SKU simple to options and legal/illegal options to simple preserve identity', async (t) => { const { service: s } = (await fixture(t)); let p = (await s.saveContent(actor, productPayload('simple'))); const id = p.skus[0].id; p = (await s.saveContent(actor, editPayload(p, { variantMode: 'options', options: matrix([2]) }), p.id)); assert.ok(p.skus.some(x => x.id === id)); (await invalid(() => editPayload(p, { variantMode: 'simple', options: p.options.map(o => ({ ...o, enabled: false })) }))); let q = editPayload(p); q.skus[1].enabled = false; p = (await s.saveContent(actor, q, p.id)); p = (await s.saveContent(actor, editPayload(p, { variantMode: 'simple', options: p.options.map(o => ({ ...o, enabled: false })) }), p.id)); assert.equal(p.skus.find(s => s.current).id, id); });
test('SKU bulk price 450 and individual480/0/null; bulk status and product gallery clear', async (t) => { const { service: s } = (await fixture(t)); let p = (await s.saveContent(actor, productPayload('multi', matrix()))); let q = editPayload(p); q.skus.forEach(x => { x.reference_price = 450; x.images = ['/assets/workshop.jpg']; x.enabled = false; }); p = (await s.saveContent(actor, q, p.id)); assert.equal(p.skus.filter(s => s.enabled).length, 0); q = editPayload(p); q.skus.forEach(x => { x.enabled = true; x.images = []; }); q.skus[0].reference_price = 480; q.skus[1].reference_price = 0; q.skus[2].reference_price = null; p = (await s.saveContent(actor, q, p.id)); assert.deepEqual(p.skus.slice(0, 3).map(x => x.effectiveReferencePrice), [480, 0, 450]); assert.ok(p.skus.every(s => s.images.length === 0 && s.effectiveImages.length === 1)); });
test('SKU rejects numeric/boolean/sort/media abnormalities without partial product writes', async (t) => {
    const { service: s, db } = (await fixture(t));
    const p = (await s.saveContent(actor, productPayload('safe')));
    for (const [key, value] of [['reference_price', NaN], ['reference_price', Infinity], ['reference_price', -1], ['reference_price', '450'], ['enabled', 1], ['sort_order', 1.5], ['images', ['https://unsafe.example/a.jpg']], ['images', ['/api/media/missing']]]) {
        const q = editPayload(p);
        q.name = 'must rollback';
        q.skus[0][key] = value;
        (await invalid(async () => (await s.saveContent(actor, q, p.id))));
        assert.equal((await s.content(p.id, false)).name, 'safe');
    }
    const opts = matrix();
    opts[0].values[0].enabled = 'true';
    (await invalid(async () => (await s.saveContent(actor, productPayload('bad', opts)))));
    assert.equal((await db.maybeOne("SELECT count(*) n FROM content", [])).n, 1);
});
test('SKU version conflict and induced late transaction failure roll back content/sku/audit', async (t) => { const { service: s, db } = (await fixture(t)); const p = (await s.saveContent(actor, productPayload('safe'))), next = (await save(s, p)); (await invalid(async () => (await save(s, p)), /其他人员/)); const before = (await db.many("SELECT * FROM content", [])), rows = (await db.many("SELECT * FROM product_skus", [])), n = (await db.maybeOne("SELECT count(*) n FROM audit", [])).n; await db.query("CREATE FUNCTION sku_fail_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated failure'; END $$; CREATE TRIGGER sku_fail BEFORE UPDATE ON product_skus FOR EACH ROW EXECUTE FUNCTION sku_fail_fn()"); const q = editPayload(next); q.name = 'rollback'; q.skus[0].reference_price = 480; (await invalid(async () => (await s.saveContent(actor, q, p.id)))); assert.deepEqual((await db.many("SELECT * FROM content", [])), before); assert.deepEqual((await db.many("SELECT * FROM product_skus", [])), rows); assert.equal((await db.maybeOne("SELECT count(*) n FROM audit", [])).n, n); });
test('SKU old writes rejected; old admin reads survive; public projection retired; inquiry hides prices', async (t) => { const { service: s, db } = (await fixture(t)); (await db.execute("INSERT INTO content VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8)", ['old', 'product', 'old', JSON.stringify({ category: 'violin', priceMode: 'inquiry', specs: [{ name: '4/4', description: '' }] }), 'published', 0, 'now', 'now'])); assert.equal((await s.content('old', false)).specs[0].name, '4/4'); assert.equal((await s.content('old')).specs, undefined); (await invalid(async () => (await s.saveContent(actor, { name: 'old', version: 1, data: { specs: [] } }, 'old')), /新版/)); const payload = productPayload('new', matrix()); payload.state = 'published'; payload.skus[0].reference_price = 480; let p = (await s.saveContent(actor, payload)); assert.equal(decode((await db.maybeOne("SELECT data FROM content WHERE id=$1", [p.id])).data).specs, undefined); assert.equal((await s.content(p.id)).skus.length, 10); assert.equal((await s.content(p.id)).specs, undefined); (await invalid(async () => (await s.saveContent(actor, { ...editPayload(p), data: { ...editPayload(p).data, specs: [] } }, p.id)), /新版/)); p = (await s.saveContent(actor, editPayload(p, { priceMode: 'inquiry' }), p.id)); assert.equal((await s.content(p.id)).price, undefined); assert.ok((await s.content(p.id)).skus.every(x => !('reference_price' in x) && x.effectiveReferencePrice === null)); });
test('SKU media internal references include independent and retired rows without file copies', async (t) => { const { service: s, db } = (await fixture(t)), id = randomUUID(); (await db.execute("INSERT INTO media VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [id, 'synthetic.png', 'image/png', 10, 'hash', id + '.png', 'synthetic', null, 'now'])); const q = productPayload('multi', matrix()); q.skus[0].images = ['/api/media/' + id]; let p = (await s.saveContent(actor, q)); assert.equal((await listMedia(db))[0].usedBy[0].id, p.id); const opts = structuredClone(p.options); opts[1].values[0].enabled = false; p = (await s.saveContent(actor, editPayload(p, { options: opts }), p.id)); assert.equal((await listMedia(db))[0].usedBy[0].id, p.id); assert.equal((await db.maybeOne("SELECT count(*) n FROM media", [])).n, 1); });
test('SKU migration empty/old db/idempotence/constraints/safe rollback', async (t) => { const { db, service: s } = (await fixture(t));  (await db.execute("INSERT INTO content VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8)", ['old', 'product', 'old', '{"specs":[]}', 'draft', 0, 'now', 'now'])); const old = (await db.many("SELECT * FROM content", [])); await migrate(db); await migrate(db); assert.deepEqual((await db.many("SELECT * FROM content", [])), old); assert.equal((await db.maybeOne("SELECT count(*) n FROM migrations WHERE version=1", [])).n, 1); const p = (await s.saveContent(actor, productPayload('new'))); await assert.rejects(db.transaction(async()=>{await db.query('DROP TABLE product_skus');throw Error('rollback');}),/rollback/);assert.ok(await db.maybeOne('SELECT id FROM product_skus WHERE id=$1',[p.skus[0].id])); const row = p.skus[0]; (await invalid(async () => (await db.execute("UPDATE product_skus SET sku_code=$1", ['bad/'])))); (await invalid(async () => (await db.execute("UPDATE product_skus SET product_id=$1", ['missing'])))); (await invalid(async () => (await db.execute("INSERT INTO product_skus SELECT $1,product_id,$2,option_values,combination_key,reference_price,images,enabled,sort_order,disable_reason,created_at,updated_at FROM product_skus WHERE id=$3", [randomUUID(), 'OTHER', row.id])))); });
test('SKU reset protects shared environment; repeat isolated reset and seed; backup restore full new schema', async (t) => { (await invalid(async () => (await resetSkuDev({ environment: 'development', target: '.local', confirm: true })))); (await invalid(async () => (await resetSkuDev({ environment: 'development', create: true, environment: 'production' })))); const r = (await resetSkuDev({ environment: 'development', create: true })); t.after(() => rmSync(r.directory, { recursive: true, force: true })); (await invalid(async () => (await resetSkuDev({ environment: 'development', target: r.directory })))); const r2 = (await resetSkuDev({ environment: 'development', target: r.directory, confirm: true })); assert.equal(r2.products, 5); const db = (await openDatabase(join(r.directory, 'fixture.pg'))); const before = (await db.many("SELECT * FROM product_skus ORDER BY id", [])); assert.equal((await seedSkuProducts(db)).length, 5); assert.deepEqual((await db.many("SELECT * FROM product_skus ORDER BY id", [])), before); (await db.close()); const outer = mkdtempSync(join(tmpdir(), 'sku-backup-')); t.after(() => rmSync(outer, { recursive: true, force: true })); (await backupData(r.directory, join(outer, 'backup'))); (await restoreData(join(outer, 'backup'), join(outer, 'restore'))); const restored = (await openDatabase(join(outer, 'restore', 'fixture.pg'))); assert.deepEqual((await restored.many("SELECT * FROM product_skus ORDER BY id", [])), before); assert.deepEqual((await restored.many("SELECT conname FROM pg_constraint WHERE connamespace=current_schema()::regnamespace AND NOT convalidated", [])), []); (await restored.close()); });
test('SKU HTTP permission matrix, conflicts, JSON errors, admin/public contract and media bridge', async (t) => {
    const { db } = (await fixture(t)), dir = mkdtempSync(join(tmpdir(), 'sku-http-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    const { server } = createHttpServer({ devAuth:true, db, uploads: dir, root: new URL('../', import.meta.url).pathname });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    t.after(() => new Promise(async (r) => (await server.close(r))));
    const base = 'http://127.0.0.1:' + server.address().port;
    const tokens = {};
    for (const role of ['admin', 'content', 'reception']) {
        const a = (await createAccount(db, { username: 'sku_' + role, password: randomUUID(), roles: [role] }));
        tokens[role] = (await issueSession(db, a.id, 'admin')).token;
    }
    const call = (path, role, method = 'GET', data) => fetch(base + path, { method, headers: { 'Content-Type': 'application/json', 'X-HQ-Action': '1', ...(tokens[role] ? { Cookie: `hq_admin=${tokens[role]}` } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) });
    for (const [role, status] of [['admin', 201], ['content', 201], ['reception', 403], ['anonymous', 401]]) {
        const p = productPayload(role);
        p.state = 'published';
        assert.equal((await call('/api/admin/content', role, 'POST', p)).status, status);
    }
    const list = await (await call('/api/admin/content?kind=product', 'admin')).json();
    assert.equal(list.length, 2);
    const p = list[0], q = editPayload(p);
    assert.equal((await call('/api/admin/content/' + p.id, 'admin', 'PUT', q)).status, 200);
    assert.equal((await call('/api/admin/content/' + p.id, 'admin', 'PUT', q)).status, 409);
    const pub = await (await call('/api/public/content/' + p.id)).json();
    assert.ok(pub.skus[0].id);
    assert.equal(pub.specs, undefined);
    assert.equal(pub.variantMode, 'simple');
    assert.equal(pub.variantModelVersion, undefined);
});
