import { decode } from '../server/db.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, symlinkSync, rmSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { sku2Fixture, editProduct } from './sku2-fixture.mjs';
import { productPayload, option } from '../server/sku-seed.mjs';
import { issueSession } from '../server/security.mjs';
import { listMedia } from '../server/media.mjs';
import { getConsultationSpecDisplay } from '../shared/consultation-display.mjs';
import { resetSkuDev } from '../scripts/reset-sku-dev.mjs';
import { backupFixture,restoreData,openDatabase } from './pg-test-db.mjs';

const setup = async (t) => { const f = await sku2Fixture(); t.after(async () => (await f.close())); return f; };
const fault = async (fn, code) => (await assert.rejects(async()=>fn(), e => e.code === code));
test('SKU2 public contract whitelist, product-level list, active definition sort, no legacy/raw fields', async (t) => {
    const f = await setup(t);
    for (const [i, count] of [[0, 1], [1, 9], [2, 20], [3, 12]]) {
        const p = (await f.service.content(f.products[i].id));
        assert.equal(p.skus.length, count);
        for (const s of p.skus)
            assert.deepEqual(Object.keys(s).sort(), ['effectiveImages', 'effectiveReferencePrice', 'id', 'optionValues']);
        assert.equal(p.specs, undefined);
        assert.equal(p.variantModelVersion, undefined);
    }
    const list = (await f.service.listContent({ kind: 'product' }));
    assert.equal(list.filter(p => p.id === f.products[1].id).length, 1);
    assert.equal(list[0].skus, undefined);
    assert.equal((await f.service.content('violin-L301')).skus.length, 5);
    let p = f.products[1], options = structuredClone(p.options);
    options.reverse();
    options[0].sort = 0;
    options[1].sort = 1;
    options[1].values[4].sort = -0;
    options[1].values[0].sort = 8;
    p = (await editProduct(f.service, f.actor, p, { options }));
    const pub = (await f.service.content(p.id));
    assert.equal(pub.options[0].id, options[0].id);
    assert.equal(pub.options[1].values.at(-1).id, options[1].values[0].id);
});
test('SKU2 reference null inherits, override, zero and inquiry never expose numerical price fields', async (t) => { const f = await setup(t); let p = f.products[1]; const pub = (await f.service.content(p.id)); assert.deepEqual(pub.skus.slice(-2).map(s => s.effectiveReferencePrice), [0, 480]); assert.equal(pub.skus[0].effectiveReferencePrice, 450); p = (await editProduct(f.service, f.actor, p, { priceMode: 'inquiry', priceNote: '参考450' })); const hidden = (await f.service.content(p.id)); assert.equal(hidden.price, undefined); assert.equal(hidden.priceNote, undefined); assert.ok(hidden.skus.every(s => s.effectiveReferencePrice === null)); assert.ok(hidden.skus.every(s => !('reference_price' in s))); const r = (await f.consultProduct(p, p.skus[9])); assert.equal((await f.service.getConsultation(r.id, null, true)).snapshot.sku.referencePrice, null); });
test('SKU2 simple/10/20/12 consultation snapshots use server IDs and preserve existing contact/source', async (t) => {
    const f = await setup(t);
    for (const p of f.products.slice(0, 4)) {
        const sku = p.skus.filter(s => s.current && s.enabled).at(-1), r = (await f.consultProduct(p, sku, { spec: '伪造规格', price: 999, skuCode: '伪造编码' })), snap = (await f.service.getConsultation(r.id, null, true)).snapshot;
        assert.equal(snap.sku.id, sku.id);
        assert.equal(snap.sku.code, sku.sku_code);
        assert.equal(snap.sku.specLabel, p.variantMode === 'simple' ? '' : sku.label);
        assert.equal(snap.sku.options.length, p.options.length);
        assert.equal(snap.images, undefined);
        assert.equal(snap.sku.images, undefined);
        assert.equal(snap.version, p.version);
        assert.equal((await f.service.getConsultation(r.id, null, true)).request.source, 'SKU隔离验证');
        const visitor = (await f.service.getConsultation(r.id, f.visitor));
        assert.equal(visitor.snapshot.sku.id, undefined);
        assert.equal(visitor.snapshot.sku.code, undefined);
    }
});
test('SKU2 rejects missing/not-found/wrong-product SKU and unbound SKU, old spec-only fails', async (t) => { const f = await setup(t), p = f.products[1]; (await fault(async () => (await f.consultProduct(p, {}, { spec: '4/4' })), 'SKU_REQUIRED')); (await fault(async () => (await f.consultProduct(p, { id: randomUUID() })), 'SKU_NOT_FOUND')); (await fault(async () => (await f.consultProduct(p, f.products[0].skus[0])), 'SKU_PRODUCT_MISMATCH')); (await fault(async () => (await f.consultProduct(p, p.skus[0], { contentId: null })), 'SKU_PRODUCT_MISMATCH')); (await fault(async () => (await f.consultProduct(p, p.skus[0], { contentId: 'lesson-1' })), 'PRODUCT_UNAVAILABLE')); });
test('SKU2 stale page SKU disabled and Product archived reject before inserting records', async (t) => { const f = await setup(t); let p = f.products[1]; const before = (await f.db.maybeOne("SELECT count(*) n FROM consultations", [])).n; (await fault(async () => (await f.consultProduct(p, p.skus[1])), 'SKU_UNAVAILABLE')); p = (await editProduct(f.service, f.actor, p, {}, q => { q.state = 'archived'; })); (await fault(async () => (await f.consultProduct(p, p.skus[0])), 'PRODUCT_UNAVAILABLE')); assert.equal((await f.db.maybeOne("SELECT count(*) n FROM consultations", [])).n, before); (await assert.rejects(async () => (await f.service.content(p.id)))); });
test('SKU2 deleted values and malformed-current legacy identity cannot bypass SKU availability', async (t) => { const f = await setup(t); let p = f.products[1], sku = p.skus[9], options = structuredClone(p.options); options[1].values[1].enabled = false; p = (await editProduct(f.service, f.actor, p, { options })); (await fault(async () => (await f.consultProduct(p, sku)), 'SKU_UNAVAILABLE')); assert.equal((await f.service.content(p.id)).options[1].values.length, 1); assert.equal((await f.service.content(p.id)).skus.length, 5); (await f.db.execute("UPDATE product_skus SET enabled=true WHERE id=$1", [sku.id])); (await fault(async () => (await f.consultProduct(p, sku)), 'SKU_UNAVAILABLE')); });
test('SKU2 zero enabled SKU safe empty Public detail, no fake identity', async (t) => { const f = await setup(t); const p = (await editProduct(f.service, f.actor, f.products[1], {}, q => q.skus.forEach(s => s.enabled = false))); assert.equal((await f.service.content(p.id)).skus.length, 0); assert.equal((await f.service.content(p.id)).name, p.name); (await fault(async () => (await f.consultProduct(p, p.skus[0])), 'SKU_UNAVAILABLE')); });
test('SKU2 snapshot immutable after Product/Option/Value rename, code and reference-price change', async (t) => { const f = await setup(t); let p = f.products[1]; const sku = p.skus[9], r = (await f.consultProduct(p, sku)), before = (await f.service.getConsultation(r.id, null, true)).snapshot; const opts = structuredClone(p.options); opts[1].name = '琴身颜色'; opts[1].values[1].label = '复古棕'; p = (await editProduct(f.service, f.actor, p, { options: opts }, q => { q.name = '改名后产品'; q.skus[9].sku_code = 'NEW-CODE-' + randomUUID().slice(0, 8); q.skus[9].reference_price = 520; })); assert.deepEqual((await f.service.getConsultation(r.id, null, true)).snapshot, before); const n = (await f.consultProduct(p, p.skus.find(s => s.id === sku.id))); const after = (await f.service.getConsultation(n.id, null, true)).snapshot; assert.equal(after.sku.id, sku.id); assert.equal(after.sku.specLabel, '4/4 / 复古棕'); assert.equal(after.sku.referencePrice, 520); assert.notEqual(after.sku.code, before.sku.code); assert.equal(after.sku.options[1].optionName, '琴身颜色'); });
test('SKU2 idempotent replay returns same snapshot, changed SKU same key rejected; failed transaction rolls back', async (t) => { const f = await setup(t), p = f.products[1], key = randomUUID(); const r = (await f.consultProduct(p, p.skus[0], {}, key)); assert.equal((await f.consultProduct(p, p.skus[0], {}, key)).id, r.id); (await fault(async () => (await f.consultProduct(p, p.skus[2], {}, key)), 'IDEMPOTENCY_CONFLICT')); const before = (await f.db.maybeOne("SELECT count(*) n FROM consultations", [])).n; await f.db.query("CREATE FUNCTION fail_sku2_fn() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'isolated failure'; END $$; CREATE TRIGGER fail_sku2 BEFORE INSERT ON idempotency FOR EACH ROW EXECUTE FUNCTION fail_sku2_fn()"); (await assert.rejects(async () => (await f.consultProduct(p, p.skus[0])))); assert.equal((await f.db.maybeOne("SELECT count(*) n FROM consultations", [])).n, before); });
test('SKU2 old snapshots stay readable unchanged, simple new label wins and general consultation preserved', async (t) => { const f = await setup(t), id = randomUUID(), snapshot = { id: 'old-product', name: '旧产品', spec: '旧规格', version: 1 }; (await f.db.execute("INSERT INTO consultations(id,owner,snapshot,request,state,created_at,updated_at) VALUES ($1,$2,$3,$4,'closed','2020-01-01','2020-01-01')", [id, f.visitor.id, JSON.stringify(snapshot), JSON.stringify({ contactName: '合成历史', phone: '13800000000' })])); assert.deepEqual((await f.service.getConsultation(id, null, true)).snapshot, snapshot); assert.equal(getConsultationSpecDisplay(snapshot), '旧规格'); assert.equal(getConsultationSpecDisplay({ spec: '旧', sku: { specLabel: '' } }), ''); const general = (await f.consultProduct({ id: null }, { id: undefined })); assert.equal((await f.service.getConsultation(general.id, f.visitor)).snapshot, null); });
test('SKU2 Public media A-F, retired structure, shared image, no deletion and Admin usedBy', async (t) => { const f = await setup(t); let p = f.products[1]; const url = f.base + f.media[2], code = async (u) => (await fetch(u)).status; assert.equal(await code(url), 200); assert.equal(await code(f.base + f.media[0]), 200); p = (await editProduct(f.service, f.actor, p, {}, q => { q.skus[9].enabled = false; })); assert.equal(await code(url), 410); const tok = (await issueSession(f.db, f.actor.id, 'admin')).token; assert.equal((await fetch(url.replace('/api/media/', '/api/admin/media/') + '/file', { headers: { Cookie: 'hq_admin=' + tok } })).status, 200); assert.ok((await listMedia(f.db)).find(m => f.media[2].endsWith(m.id)).usedBy.some(c => c.id === p.id)); let other = (await editProduct(f.service, f.actor, f.products[0], { images: [f.media[2]] })); assert.equal(await code(url), 200); other = (await editProduct(f.service, f.actor, other, {}, q => q.state = 'archived')); assert.equal(await code(url), 410); p = (await editProduct(f.service, f.actor, p, {}, q => q.skus[9].enabled = true)); assert.equal(await code(url), 200); const opts = structuredClone(p.options); opts[1].values[1].enabled = false; p = (await editProduct(f.service, f.actor, p, { options: opts })); assert.equal(await code(url), 410); assert.equal((await f.db.maybeOne("SELECT count(*) n FROM media", [])).n, 3); p = (await editProduct(f.service, f.actor, p, {}, q => q.state = 'archived')); assert.equal(await code(f.base + f.media[0]), 410); });
test('SKU2 HTTP permissions: anonymous/public, own visitor records, reception/content/admin boundaries', async (t) => {
    const f = await setup(t), p = f.products[1], body = { contentId: p.id, skuId: p.skus[0].id, contactName: '合成访客', phone: '13800000000', message: '测试', consent: true };
    const call = (path, headers = {}, method = 'GET', data) => fetch(f.base + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(data ? { body: JSON.stringify(data) } : {}) });
    assert.equal((await call('/api/public/content/' + p.id)).status, 200);
    assert.equal((await call('/api/visitor/consultations', {}, 'POST', body)).status, 401);
    const token = (await issueSession(f.db, f.visitor.id, 'visitor')).token;
    const r = await call('/api/visitor/consultations', { Authorization: 'Bearer ' + token, 'Idempotency-Key': randomUUID() }, 'POST', body);
    assert.equal(r.status, 201);
    const created = await r.json();
    for (const [role, status] of [['admin', 200], ['reception', 200], ['content', 403]]) {
        const session = (await issueSession(f.db, f.accounts[role].id, 'admin')).token;
        assert.equal((await call('/api/admin/consultations/' + created.id, { Cookie: 'hq_admin=' + session })).status, status);
        assert.equal((await call('/api/admin/media/' + f.media[2].split('/').at(-1) + '/file', { Cookie: 'hq_admin=' + session })).status, role === 'reception' ? 403 : 200);
    }
    const other = (await (await call('/api/auth/development', {}, 'POST', {})).json()).token;
    assert.equal((await call('/api/visitor/consultations/' + created.id, { Authorization: 'Bearer ' + other })).status, 404);
});
test('SKU2 50 SKU public detail remains bounded and deterministic', async (t) => {
    const f = await setup(t);
    const input = productPayload('合成50SKU', [option('维一', Array.from({ length: 5 }, (_, i) => '值' + i)), option('维二', Array.from({ length: 5 }, (_, i) => '值' + i), 1), option('维三', ['甲', '乙'], 2)]);
    input.state = 'published';
    const p = (await f.service.saveContent(f.actor, input));
    const start = performance.now();
    let result;
    for (let i = 0; i < 100; i++)
        result = (await f.service.content(p.id));
    assert.equal(result.skus.length, 50);
    assert.equal(new Set(result.skus.map(s => s.id)).size, 50);
    console.log('SKU2 50 SKU Public Detail 100 reads ms', Math.round(performance.now() - start));
});
test('SKU2 reset dry-run no changes, explicit environment and nested symlink protections', async (t) => { (await assert.rejects(async () => (await resetSkuDev({ create: true })), /development/)); const r = (await resetSkuDev({ create: true, environment: 'development' })); t.after(() => rmSync(r.directory, { recursive: true, force: true })); const path = join(r.directory, '.pg-fixture.json'), before = readFileSync(path); const plan = (await resetSkuDev({ target: r.directory, dryRun: true, environment: 'development' })); assert.equal(plan.dryRun, true); assert.deepEqual(readFileSync(path), before); symlinkSync('/tmp', join(r.directory, 'escape')); (await assert.rejects(async () => (await resetSkuDev({ target: r.directory, confirm: true, environment: 'development' })), /符号链接/)); });
test('SKU2 backup restore retains new SKU consultation snapshot and migration without shared writes', async (t) => {
    const f = await setup(t), r = (await f.consultProduct(f.products[1], f.products[1].skus[9]));
    const dir = mkdtempSync(join(tmpdir(), 'hq-sku2-backup-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    await backupFixture(f.db,join(f.dir,'uploads'),join(dir,'backup'));
    (await restoreData(join(dir, 'backup'), join(dir, 'restored')));
    const db = await openDatabase(join(dir, 'restored', 'fixture.pg'));
    try {
        assert.deepEqual(decode((await db.maybeOne("SELECT snapshot FROM consultations WHERE id=$1", [r.id])).snapshot), (await f.service.getConsultation(r.id, null, true)).snapshot);
        assert.ok((await db.maybeOne("SELECT * FROM migrations WHERE version=1", [])));
        assert.equal((await db.many("SELECT conname FROM pg_constraint WHERE connamespace=current_schema()::regnamespace AND NOT convalidated", [])).length, 0);
    }
    finally {
        (await db.close());
    }
});
