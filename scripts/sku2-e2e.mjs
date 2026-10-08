// Real compiled Admin + real WeChat DevTools simulator. All writes use isolated PostgreSQL/uploads/project copy.
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { mkdtempSync, mkdirSync, cpSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { productPayload, option } from '../server/sku-seed.mjs';
import { sku2Fixture, editProduct } from '../tests/sku2-fixture.mjs';
const require = createRequire(import.meta.url), { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/Users/aaron/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'), automator = require('miniprogram-automator');
const automationPort = Number(process.env.SKU2_AUTOMATOR_PORT) || await new Promise(resolve => { const server = createServer(); server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); }); });
const out = resolve(process.env.QA_OUTPUT_DIR||'docs/business/product-sku-phase-2/screenshots');
mkdirSync(out, { recursive: true });
const results = [], screens = [], errors = [];
let f, b, p, m, copy;
const ex = name => ({ name, exact: true }), dialog = () => p.getByRole('dialog'), field = name => dialog().locator('label.field').filter({ has: p.locator('span').getByText(name, ex(name)) }).locator('input,textarea,select');
async function nav(name) { await p.locator('.sidebar nav').getByRole('button', ex(name)).click(); await p.waitForFunction(() => !document.querySelector('.main .loading')); }
async function shot(name) { await m.screenshot({ path: join(out, name) }); screens.push(name); }
async function run(name, fn) { await (await fn()); results.push({ name, status: 'PASS' }); console.log('PASS', name); }
async function ready(page) { for (let i = 0; i < 100; i++) {
    if (!(await page.data('loading')))
        break;
    await page.waitFor(100);
} assert.equal(await page.data('loading'), false); assert.equal(await page.data('error'), ''); return page; }
async function open(route) { return ready(await m.reLaunch(route)); }
async function button(page, label) { for (const e of await page.$$('button'))
    if ((await e.text()).trim() === label)
        return e; throw Error('Button missing ' + label); }
async function route(path) { for (let i = 0; i < 100; i++) {
    const page = await m.currentPage();
    if (page?.path === path)
        return ready(page);
    await new Promise(r => setTimeout(r, 100));
} throw Error('Route timeout ' + path + ' ' + JSON.stringify({ page: (await m.currentPage())?.path, error: await (await m.currentPage())?.data('submitError') })); }
async function select(page, option, value) { const chip = await page.$(`[data-option-id="${option.id}"][data-value-id="${value.id}"]`); assert.ok(chip); await chip.tap(); await page.waitFor(150); }
async function scrollOptions(page) { const e = await page.$('.sku-selection'); if (e) {
    const offset = await e.offset();
    await m.pageScrollTo(Math.max(0, Number(await page.scrollTop()) + offset.top - 180));
    await page.waitFor(200);
} }
async function fillConsult(page) { for (const [key, value] of Object.entries({ contactName: '合成访客', phone: '13800000000', message: '隔离SKU全链路验证' }))
    await (await page.$(`[data-key="${key}"]`)).input(value); await page.callMethod('consent', { detail: { value: ['agree'] } }); }
try {
    f = await sku2Fixture();
    f.products[2] = (await editProduct(f.service, f.actor, f.products[2], {}, q => q.data.options[2].values[1].label = '高级套装含琴盒与配件长名称换行验证'));
    const fiftyInput = productPayload('50规格性能验证', [option('维度甲', Array.from({ length: 5 }, (_, i) => '甲' + i)), option('维度乙', Array.from({ length: 5 }, (_, i) => '乙' + i), 1), option('维度丙', ['丙一', '丙二'], 2)]);
    fiftyInput.state = 'published';
    const fifty = (await f.service.saveContent(f.actor, fiftyInput));
    b = await chromium.launch({ channel: 'chrome', headless: true });
    p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
    p.on('pageerror', e => errors.push('Admin: ' + e.message));
    await p.goto(f.url);
    await p.getByLabel('账号', ex('账号')).fill('qa_admin');
    await p.getByLabel('密码', ex('密码')).fill(f.passwords.admin);
    await p.getByRole('button', ex('登录后台')).click();
    await p.locator('.admin-metric-value').first().waitFor();
    await nav('内容维护');
    let product, simple;
    await run('Admin creates and publishes 10 SKU product with 450/0/480 prices, galleries and disabled combination', async () => { await p.getByRole('button', ex('新增乐器')).click(); await field('名称').fill('L201 规格体验小提琴'); await field('发布状态').selectOption('published'); await field('产品编码').fill('QA-E2E-L201'); await field('价格展示').selectOption('reference'); await field('参考价（元）').fill('450'); for (let i = 0; i < 2; i++) {
        await p.getByRole('button', ex('从素材库添加图片')).click();
        await p.getByLabel(i === 0 ? '内容图片 1（封面）' : '内容图片 2', ex('')).selectOption(f.media[i]);
    } await p.getByRole('button', ex('多规格')).click(); await p.getByRole('button', ex('确认变更')).click(); for (const [i, name, values] of [[0, '尺寸', ['1/8', '1/4', '1/2', '3/4', '4/4']], [1, '颜色', ['自然色', '棕色']]]) {
        if (i)
            await p.getByRole('button', ex('＋ 添加规格维度')).click();
        await p.getByLabel(`维度${i + 1}名称`, ex('')).fill(name);
        for (const [j, label] of values.entries()) {
            await p.getByRole('button', ex(`＋ 添加${name}值`)).click();
            await p.getByLabel(`${name}值${j + 1}`, ex('')).fill(label);
        }
    } await p.getByRole('button', ex('更新组合')).click(); await p.getByLabel('SKU 2 启用', ex('')).uncheck(); await p.getByLabel('SKU 9 参考价', ex('')).fill('0'); await p.getByLabel('SKU 10 参考价', ex('')).fill('480'); await p.getByLabel('管理SKU 10 图片', ex('')).click(); await p.getByLabel('SKU复用图片', ex('')).selectOption(f.media[2]); const response = p.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/admin/content'); await p.getByRole('button', ex('保存内容')).click(); const r = await response; product = await r.json(); assert.equal(r.status(), 201, JSON.stringify(product)); assert.equal(product.skus.length, 10); assert.equal(product.state, 'published'); await dialog().waitFor({ state: 'hidden' }); });
    await run('Admin creates and publishes simple product', async () => { await p.getByRole('button', ex('新增乐器')).click(); await field('名称').fill('单规格小提琴'); await field('发布状态').selectOption('published'); await p.getByRole('button', ex('从素材库添加图片')).click(); const response = p.waitForResponse(r => r.request().method() === 'POST' && new URL(r.url()).pathname === '/api/admin/content'); await p.getByRole('button', ex('保存内容')).click(); const r = await response; simple = await r.json(); assert.equal(r.status(), 201); await dialog().waitFor({ state: 'hidden' }); });
    copy = mkdtempSync(join(tmpdir(), 'hq-sku2-native-'));
    cpSync(resolve('miniprogram'), copy, { recursive: true });
    writeFileSync(join(copy, 'miniprogram/config.ts'), `export const API_BASE = '${f.base}';\nexport const IDENTITY_MODE: 'development'|'wechat' = 'development';\n`);
    // Automation compiles an isolated project copy; no mock wx APIs or host-rendered WXML.
    m = await automator.launch({ projectPath: copy, port: automationPort, trustProject: true, timeout: 60000 });
    m.on('exception', e => errors.push('WeChat: ' + String(e.message || e)));
    await m.callWxMethod('removeStorageSync', 'hq-visitor-token');
    let page, consultId;
    await run('Native product list -> default real enabled SKU; unavailable combination disabled', async () => { page = await open('/pages/instruments/index'); assert.ok((await page.data('items')).some(i => i.id === product.id)); await page.callMethod('open', { currentTarget: { dataset: { id: product.id } } }); page = await route('pages/product/index'); assert.equal(await page.data('selectedSkuId'), product.skus[0].id); assert.equal(await page.data('priceLabel'), '参考价 ¥450'); await scrollOptions(page); await shot('01-product-options-default.png'); const unavailable = await page.$('.sku-chip[disabled]'); const groups = await page.data('optionGroups'); assert.equal(groups[1].values[1].disabled, true); await shot('03-product-option-unavailable.png'); });
    await run('Native 4/4 brown -> unique SKU, gallery/price switch and carousel reset', async () => { const [size, color] = product.options; await select(page, size, size.values[4]); assert.equal(await page.data('priceLabel'), '参考价 ¥0'); await (await page.$('swiper')).swipeTo(1); await select(page, color, color.values[1]); assert.equal(await page.data('selectedSkuId'), product.skus[9].id); assert.equal(await page.data('galleryCurrent'), 0); assert.equal(await page.data('priceLabel'), '参考价 ¥480'); assert.equal((await page.data('galleryImages')).length, 1); await scrollOptions(page); await shot('02-product-options-switch.png'); await shot('05-product-sku-price-switch.png'); await m.pageScrollTo(0); await shot('04-product-sku-image-switch.png'); });
    await run('Native consultation -> immutable SKU snapshot -> visitor record -> Admin detail', async () => { await (await button(page, '咨询此产品')).tap(); page = await route('pages/consult/index'); assert.equal(await page.data('specLabel'), '4/4 / 棕色'); await shot('06-consult-sku-summary.png'); await fillConsult(page); await (await button(page, '提交咨询')).tap(); page = await route('pages/record/index'); consultId = await page.data('id'); assert.equal((await page.data('row')).specDisplay, '4/4 / 棕色'); await shot('07-my-record-sku-snapshot.png'); const record = (await f.service.getConsultation(consultId, null, true)); assert.equal(record.snapshot.sku.id, product.skus[9].id); assert.equal(record.snapshot.sku.referencePrice, 480); await nav('咨询管理'); await p.locator('tr').filter({ hasText: consultId }).getByRole('button', ex('查看')).click(); await p.getByText('SKU编码', ex('SKU编码')).waitFor(); assert.ok((await dialog().innerText()).includes(record.snapshot.sku.code)); await p.screenshot({ path: join(out, '09-admin-consult-sku.png') }); screens.push('09-admin-consult-sku.png'); await p.getByRole('button', ex('关闭详情')).click(); });
    await run('Native simple auto SKU without technical label and successful consultation', async () => { page = await open('/pages/product/index?id=' + simple.id); assert.equal(await page.data('selectedSkuId'), simple.skus[0].id); assert.equal(await page.$('.sku-selection'), null); assert.equal(await page.data('specLabel'), ''); await shot('08-simple-product.png'); await page.callMethod('consult'); page = await route('pages/consult/index'); await fillConsult(page); await page.callMethod('submit'); page = await route('pages/record/index'); assert.equal((await page.data('row')).specDisplay, ''); });
    await run('Native 20 SKU three dimensions and gift 12 SKU select and consult', async () => { for (const index of [2, 3]) {
        page = await open('/pages/product/index?id=' + f.products[index].id);
        const groups = await page.data('optionGroups');
        assert.equal(groups.length, index === 2 ? 3 : 2);
        for (const o of groups)
            await select(page, o, o.values.at(-1));
        assert.equal(await page.data('canConsult'), true);
        await scrollOptions(page);
        await shot(index === 2 ? '10-product-three-options.png' : '11-gift-options.png');
        await page.callMethod('consult');
        page = await route('pages/consult/index');
        await fillConsult(page);
        await page.callMethod('submit');
        await route('pages/record/index');
    } });
    await run('Native stale SKU rejected, form retained, current model reloaded and no auto resubmit', async () => { page = await open('/pages/consult/index?id=' + product.id + '&skuId=' + product.skus[9].id); await fillConsult(page); product = (await editProduct(f.service, f.actor, product, {}, q => q.skus.find(s => s.id === product.skus[9].id).enabled = false)); const count = (await f.db.maybeOne("SELECT count(*) n FROM consultations", [])).n; await page.callMethod('submit'); await page.waitFor(300); assert.match(await page.data('submitError'), /规格已更新/); assert.equal((await page.data('form')).contactName, '合成访客'); assert.equal((await f.db.maybeOne("SELECT count(*) n FROM consultations", [])).n, count); await shot('12-stale-sku-recovery.png'); });
    await run('Native historical snapshot survives rename/code/price change and legacy spec remains readable', async () => { const original = (await f.service.getConsultation(consultId, null, true)); product = (await editProduct(f.service, f.actor, product, {}, q => { q.data.options[1].name = '琴身颜色'; q.data.options[1].values[1].label = '复古棕'; const s = q.skus.find(s => s.id === original.snapshot.sku.id); s.enabled = true; s.sku_code = 'QA-E2E-RECODE'; s.reference_price = 499; })); page = await open('/pages/record/index?kind=consultations&id=' + consultId); assert.equal((await page.data('row')).specDisplay, '4/4 / 棕色'); assert.equal((await f.service.getConsultation(consultId, null, true)).snapshot.sku.code, original.snapshot.sku.code); const legacy = { ...original.snapshot, spec: '旧咨询规格 3/4' }; delete legacy.sku; (await f.db.execute("UPDATE consultations SET snapshot=$1 WHERE id=$2", [JSON.stringify(legacy), consultId])); page = await open('/pages/record/index?kind=consultations&id=' + consultId); assert.equal((await page.data('row')).specDisplay, '旧咨询规格 3/4'); (await f.db.execute("UPDATE consultations SET snapshot=$1 WHERE id=$2", [JSON.stringify(original.snapshot), consultId])); page = await open('/pages/records/index?kind=consultations'); assert.ok((await page.data('rows')).some(r => r.specDisplay === '4/4 / 棕色')); });
    await run('Native 50 SKU product with three dimensions loads and selects', async () => { const started = Date.now(); page = await open('/pages/product/index?id=' + fifty.id); assert.equal((await page.data('item')).skus.length, 50); for (const o of await page.data('optionGroups'))
        await select(page, o, o.values.at(-1)); assert.equal(await page.data('canConsult'), true); results.push({ name: 'native50loadAndSelect', status: 'PASS', milliseconds: Date.now() - started }); });
    await run('Admin eight pages no blank page or runtime failure', async () => { for (const name of ['工作台', '内容维护', '场次管理', '研学预约', '咨询管理', '素材库', '账号权限', '操作记录']) {
        await nav(name);
        assert.ok((await p.locator('.main').innerText()).length > 15);
        assert.equal(await p.locator('vite-error-overlay').count(), 0);
    } });
    assert.deepEqual(errors, []);
    const info = await m.systemInfo();
    writeFileSync(resolve(out, '../e2e-verification.json'), JSON.stringify({ environment: 'isolated PostgreSQL/uploads and isolated native WeChat project copy', sharedDatabaseAffected: false, systemInfo: Object.fromEntries(['brand', 'model', 'platform', 'pixelRatio', 'screenWidth', 'screenHeight', 'windowWidth', 'windowHeight', 'SDKVersion'].map(k => [k, info[k]])), chrome: await b.version(), results, screenshots: screens, errors }, null, 2) + '\n');
    // Optional hold permits native simulator viewport changes and read-only layout inspection.
    if (process.env.SKU2_KEEP_OPEN === '1') {
        writeFileSync('/tmp/sku2-native-session.json', JSON.stringify({ projectPath: copy, api: f.base, productId: product.id, threeId: f.products[2].id, giftId: f.products[3].id, ws: 'ws://127.0.0.1:' + automationPort, out }));
        console.log('READY_FOR_VIEWPORT_QA');
        await new Promise(r => { process.once('SIGTERM', r); process.once('SIGINT', r); });
    }
}
catch (e) {
    console.error(e.stack);
    if (p)
        await p.screenshot({ path: '/tmp/sku2-e2e-failure.png' });
    process.exitCode = 1;
}
finally {
    if (m)
        await m.close().catch(() => m.disconnect());
    if (b)
        await b.close();
    if (f)
        await f.close();
    if (copy)
        rmSync(copy, { recursive: true, force: true });
}
