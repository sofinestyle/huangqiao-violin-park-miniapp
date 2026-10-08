import http from 'node:http';
import { auditQuery, auditOptions } from './audit-query.mjs';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';
import { Service } from './service.mjs';
import { Fault, requireValue, authenticate, checkPassword, issueSession, createAccount, hashPassword, permit, audit, digest, text } from './security.mjs';
import { now, decode, transaction } from './db.mjs';
import { upload, serveMedia, listMedia } from './media.mjs';
const json = (res, value, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); };
// Buffer responses until commit: never acknowledge a write that later rolls back.
async function atomicAdminResponse(db,res,fn){
 const headers={};let status=200,body;
 const buffered={setHeader:(k,v)=>{headers[k]=v;},writeHead:(code,h={})=>{status=code;Object.assign(headers,h);},end:value=>{body=value;}};
 await db.transaction(async()=>{await db.lockKey('hq:accounts');await fn(buffered);});
 res.writeHead(status,headers);res.end(body);
}
async function body(req) {
    requireValue(req.headers['content-type']?.startsWith('application/json'), '请求须使用JSON', 415);
    const chunks = [];
    let size = 0;
    for await (const c of req) {
        size += c.length;
        requireValue(size <= 1e6, '请求内容过大', 413);
        chunks.push(c);
    }
    try {
        const result = JSON.parse(Buffer.concat(chunks).toString());
        requireValue(result && typeof result === 'object' && !Array.isArray(result), '请求格式无效');
        return result;
    }
    catch (e) {
        if (e instanceof Fault)
            throw e;
        throw new Fault(400, 'JSON格式错误');
    }
}
const cookieToken = req => req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('hq_admin='))?.slice(9) || '';
const bearer = req => /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1] || '';
const safeAccount = a => ({ id: a.id, username: a.username, roles: decode(a.roles), active: !!a.active, canExport: !!a.can_export });
export function createHttpServer({ db, uploads, storage, root, devAuth = false, environment = 'development', adminOrigin = '' }) {
    const service = new Service(db,{environment}), loginFailures = new Map();
    if(environment!=='development'&&devAuth)throw new Error('非开发环境禁止Dev Auth');
    const secureCookie=environment==='development'?'':'; Secure';
    const mediaStorage=storage||uploads;
    const server = http.createServer(async (req, res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'same-origin');
        try {
            const url = new URL(req.url, 'http://localhost');
            const path = url.pathname;
            const match = pattern => path.match(pattern);
            const method = req.method;
            if (path.startsWith('/api/admin/') && !['GET', 'HEAD'].includes(method)) {
                requireValue(req.headers['x-hq-action'] === '1', '请求校验失败', 403);
                const origin = req.headers.origin;
                const ownPort = server.address()?.port;
                requireValue(!origin || (environment==='development'?[`http://127.0.0.1:${ownPort}`, `http://localhost:${ownPort}`, 'http://127.0.0.1:5173', 'http://localhost:5173']:[adminOrigin]).includes(origin), '请求来源不允许', 403);
            }
            if(path==='/api/health'&&method==='GET'){try{await db.one('SELECT 1 AS ok');await db.one('SELECT version FROM migrations WHERE version=1');return json(res,{ok:true,database:true,environment});}catch{return json(res,{ok:false,database:false},503);}}
            if (path === '/api/auth/development' && method === 'POST') {
                requireValue(devAuth, '本地测试身份已关闭', 403);
                const visitorId = randomUUID();
                (await db.execute("INSERT INTO visitors VALUES ($1,NULL,$2)", [visitorId, now()]));
                return json(res, { ...(await issueSession(db, visitorId, 'visitor')), identityMode: 'development', message: '仅用于本地验证，不代表微信真实身份' }, 201);
            }
            if (path === '/api/auth/wechat' && method === 'POST') {
                const b = await body(req);
                const code = text(b.code, '微信登录凭据', 200);
                requireValue(process.env.WX_APPID && process.env.WX_APPSECRET, '微信真实身份尚未配置，不能以测试身份替代', 503, 'WECHAT_NOT_CONFIGURED');
                const query = new URLSearchParams({ appid: process.env.WX_APPID, secret: process.env.WX_APPSECRET, js_code: code, grant_type: 'authorization_code' });
                const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query}`, { signal: AbortSignal.timeout(10000) });
                const result = await response.json();
                requireValue(response.ok && typeof result.openid === 'string' && !result.errcode, '微信身份验证失败', 401);
                const row=await db.one('INSERT INTO visitors(id,wechat_openid,created_at) VALUES($1,$2,$3) ON CONFLICT(wechat_openid) DO UPDATE SET wechat_openid=EXCLUDED.wechat_openid RETURNING id',[randomUUID(),result.openid,now()]);
                return json(res, { ...(await issueSession(db, row.id, 'visitor')), identityMode: 'wechat' });
            }
            if (path === '/api/public/content' && method === 'GET')
                return json(res, (await service.listContent(Object.fromEntries(url.searchParams))));
            let m;
            if ((m = match(/^\/api\/public\/content\/([^/]+)$/)) && method === 'GET')
                return json(res, (await service.content(m[1])));
            if (path === '/api/public/slots' && method === 'GET')
                return json(res, (await service.slots(true)).map(s => ({ id: s.id, date: s.date, start: s.start, end: s.end, package_ids: s.package_ids })));
            if (path === '/api/public/enrollments' && method === 'GET')
                return json(res, (await service.enrollments()));
            if ((m = match(/^\/api\/public\/enrollments\/([^/]+)$/)) && method === 'GET')
                return json(res, (await service.enrollment(m[1])));
            if ((m = match(/^\/api\/media\/([a-zA-Z0-9-]+)$/)) && ['GET', 'HEAD'].includes(method))
                return (await serveMedia(db, req, res, m[1], mediaStorage));
            if (path.startsWith('/api/visitor/')) {
                const visitor = (await authenticate(db, bearer(req), 'visitor'));
                if (path === '/api/visitor/bookings') {
                    if (method === 'GET')
                        return json(res, (await service.myBookings(visitor)));
                    if (method === 'POST')
                        return json(res, (await service.createBooking(visitor, await body(req), req.headers['idempotency-key'])), 201);
                }
                if ((m = match(/^\/api\/visitor\/bookings\/([^/]+)$/)) && method === 'GET')
                    return json(res, (await service.getBooking(m[1], visitor)));
                if ((m = match(/^\/api\/visitor\/bookings\/([^/]+)\/withdraw$/)) && method === 'POST')
                    return json(res, (await service.withdraw(visitor, m[1], await body(req))));
                if ((m = match(/^\/api\/visitor\/bookings\/([^/]+)\/changes$/)) && method === 'POST')
                    return json(res, (await service.requestChange(visitor, m[1], await body(req))));
                if (path === '/api/visitor/consultations') {
                    if (method === 'GET')
                        return json(res, (await service.myConsultations(visitor)));
                    if (method === 'POST')
                        return json(res, (await service.createConsultation(visitor, await body(req), req.headers['idempotency-key'])), 201);
                }
                if ((m = match(/^\/api\/visitor\/consultations\/([^/]+)$/)) && method === 'GET')
                    return json(res, (await service.getConsultation(m[1], visitor)));
            }
            if (path === '/api/admin/login' && method === 'POST') {
                const b = await body(req);
                return await atomicAdminResponse(db,res,async res=>{
                const peer = req.socket.remoteAddress || 'local';
                let throttle = loginFailures.get(peer);
                if (!throttle || throttle.since < Date.now() - 600e3)
                    throttle = { count: 0, since: Date.now() };
                requireValue(throttle.count < 10, '登录失败过多，请10分钟后重试', 429);
                const row = (await db.maybeOne("SELECT * FROM accounts WHERE username=$1", [String(b.username)]));
                if (!row || !row.active || !checkPassword(b.password, row.password_hash)) {
                    throttle.count++;
                    loginFailures.set(peer, throttle);
                    throw new Fault(401, '账号或密码错误');
                }
                loginFailures.delete(peer);
                const s = (await issueSession(db, row.id, 'admin'));
                res.setHeader('Set-Cookie', `hq_admin=${s.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookie}`);
                (await audit(db, { id: row.id }, 'account.login', row.id));
                return json(res, safeAccount(row));
                });
            }
            // Streaming media must not hold a DB transaction while bytes traverse the network.
            if(path==='/api/admin/media'&&method==='POST'){
                const actor=await authenticate(db,cookieToken(req),'admin');permit(actor,'content');
                return json(res,await upload(db,actor,req,mediaStorage,async()=>{await db.lockKey('hq:accounts');const current=await authenticate(db,cookieToken(req),'admin');permit(current,'content');}),201);
            }
            if((m=match(/^\/api\/admin\/media\/([^/]+)\/file$/))&&['GET','HEAD'].includes(method)){
                await db.transaction(async()=>{await db.lockKey('hq:accounts');permit(await authenticate(db,cookieToken(req),'admin'),'content');});
                return await serveMedia(db,req,res,m[1],mediaStorage,true);
            }
            if (path.startsWith('/api/admin/')) {
                return await atomicAdminResponse(db,res,async res=>{
                const actor = (await authenticate(db, cookieToken(req), 'admin'));
                if (path === '/api/admin/me' && method === 'GET')
                    return json(res, actor);
                if (path === '/api/admin/logout' && method === 'POST') {
                    (await db.execute("DELETE FROM sessions WHERE token_hash=$1", [digest(cookieToken(req))]));
                    res.setHeader('Set-Cookie', 'hq_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+secureCookie);
                    return json(res, { ok: true });
                }
                if (path === '/api/admin/overview' && method === 'GET') {
                    const operational = actor.roles.some(r => ['admin', 'reception'].includes(r));
                    return json(res, { contentCount: (await db.maybeOne("SELECT COUNT(*) AS n FROM content", [])).n,
                        ...(operational ? { pendingBookings: (await db.maybeOne("SELECT COUNT(*) AS n FROM bookings WHERE state='pending'", [])).n,
                            pendingConsultations: (await db.maybeOne("SELECT COUNT(*) AS n FROM consultations WHERE state<>'closed'", [])).n,
                            todayBookings: (await service.adminRecords(actor, 'bookings')).filter(r => r.state === 'confirmed' && r.confirmed?.date === new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date())).length } : {}) });
                }
                if (path === '/api/admin/content') {
                    permit(actor, 'content');
                    if (method === 'GET')
                        return json(res, (await service.listContent(Object.fromEntries(url.searchParams), true)));
                    if (method === 'POST')
                        return json(res, (await service.saveContent(actor, await body(req))), 201);
                }
                if ((m = match(/^\/api\/admin\/content\/([^/]+)\/delete-check$/)) && method === 'GET')
                    return json(res, (await service.contentDeleteCheck(actor, m[1])));
                if ((m = match(/^\/api\/admin\/content\/([^/]+)$/))) {
                    if (method === 'GET') {
                        permit(actor, 'content');
                        return json(res, (await service.content(m[1], false)));
                    }
                    if (method === 'PUT')
                        return json(res, (await service.saveContent(actor, await body(req), m[1])));
                    if (method === 'DELETE') {
                        permit(actor, 'content');
                        return json(res, (await service.deleteContent(actor, m[1], (await body(req)).version)));
                    }
                }
                if (path === '/api/admin/slots') {
                    permit(actor, 'reception');
                    if (method === 'GET')
                        return json(res, (await service.slots()));
                    if (method === 'POST')
                        return json(res, (await service.saveSlot(actor, await body(req))), 201);
                }
                if ((m = match(/^\/api\/admin\/slots\/([^/]+)$/)) && method === 'PUT')
                    return json(res, (await service.saveSlot(actor, await body(req), m[1])));
                if (path === '/api/admin/staff' && method === 'GET') {
                    permit(actor, 'reception');
                    return json(res, (await db.many("SELECT * FROM accounts", [])).map(a => ({ id: a.id, username: a.username, active: !!a.active, canReceive: decode(a.roles).some(r => ['admin', 'reception'].includes(r)) })));
                }
                if (path === '/api/admin/packages' && method === 'GET') {
                    permit(actor, 'reception');
                    return json(res, (await service.listContent({ kind: 'package' }, true)).map(p => ({ id: p.id, name: p.name, state: p.state })));
                }
                if (path === '/api/admin/bookings' && method === 'GET')
                    return json(res, (await service.adminRecords(actor, 'bookings', Object.fromEntries(url.searchParams))));
                if ((m = match(/^\/api\/admin\/bookings\/([^/]+)$/))) {
                    if (method === 'GET') {
                        permit(actor, 'reception');
                        return json(res, (await service.getBooking(m[1], null, true)));
                    }
                    if (method === 'POST')
                        return json(res, (await service.handleBooking(actor, m[1], await body(req))));
                }
                if (path === '/api/admin/consultations' && method === 'GET')
                    return json(res, (await service.adminRecords(actor, 'consultations', Object.fromEntries(url.searchParams))));
                if ((m = match(/^\/api\/admin\/consultations\/([^/]+)$/))) {
                    if (method === 'GET') {
                        permit(actor, 'reception');
                        return json(res, (await service.getConsultation(m[1], null, true)));
                    }
                    if (method === 'POST')
                        return json(res, (await service.handleConsultation(actor, m[1], await body(req))));
                }
                if (path === '/api/admin/media') {
                    permit(actor, 'content');
                    if (method === 'GET')
                        return json(res, (await listMedia(db)));
                    if (method === 'POST')
                        return json(res, await (await upload(db, actor, req, mediaStorage)), 201);
                }
                if ((m = match(/^\/api\/admin\/media\/([^/]+)\/file$/)) && ['GET', 'HEAD'].includes(method)) {
                    permit(actor, 'content');
                    return (await serveMedia(db, req, res, m[1], mediaStorage, true));
                }
                if (path === '/api/admin/accounts') {
                    permit(actor, 'admin');
                    if (method === 'GET')
                        return json(res, (await db.many("SELECT * FROM accounts ORDER BY created_at", [])).map(safeAccount));
                    if (method === 'POST') {
                        const a = (await createAccount(db, await body(req)));
                        (await audit(db, actor, 'account.create', a.id, { roles: a.roles }));
                        return json(res, a, 201);
                    }
                }
                if ((m = match(/^\/api\/admin\/accounts\/([^/]+)$/)) && method === 'PUT') {
                    permit(actor, 'admin');
                    const b = await body(req);
                    return json(res, (await transaction(db, async () => {
                        await db.lockKey('hq:accounts');
                        await db.lockRows('accounts',[actor.id,m[1]]);
                        const fresh=await authenticate(db,cookieToken(req),'admin');permit(fresh,'admin');
                        const prev = (await db.maybeOne("SELECT * FROM accounts WHERE id=$1", [m[1]]));
                        requireValue(prev, '账号不存在', 404);
                        requireValue(Array.isArray(b.roles) && b.roles.length && b.roles.every(r => ['admin', 'content', 'reception'].includes(r)), '角色无效');
                        if (prev.active && decode(prev.roles).includes('admin') && (!b.active || !b.roles.includes('admin')))
                            requireValue((await db.many("SELECT * FROM accounts WHERE active=true AND id<>$1", [prev.id])).some(a => decode(a.roles).includes('admin')), '不能停用或移除最后一个管理员');
                        (await db.execute("UPDATE accounts SET roles=$1,can_export=$2,active=$3,password_hash=$4 WHERE id=$5", [JSON.stringify(b.roles), !!b.canExport, !!b.active, b.password ? hashPassword(b.password) : prev.password_hash, prev.id]));
                        const previousRoles = new Set(decode(prev.roles)), nextRoles = new Set(b.roles);
                        const rolesChanged = previousRoles.size !== nextRoles.size || [...previousRoles].some(r => !nextRoles.has(r));
                        if (b.password || rolesChanged || !!prev.active !== !!b.active)
                            (await db.execute("DELETE FROM sessions WHERE owner=$1 AND type=$2", [prev.id, 'admin']));
                        (await audit(db, actor, 'account.update', prev.id, { roles: b.roles, active: !!b.active, canExport: !!b.canExport, passwordReset: !!b.password }));
                        return safeAccount((await db.maybeOne("SELECT * FROM accounts WHERE id=$1", [prev.id])));
                    })));
                }
                if (path === '/api/admin/audit/options' && method === 'GET') {
                    permit(actor, 'admin');
                    return json(res, (await auditOptions(db)));
                }
                if (path === '/api/admin/audit' && method === 'GET') {
                    permit(actor, 'admin');
                    const result = (await auditQuery(db, url.searchParams));
                    res.setHeader('X-Total-Count', String(result.total));
                    return json(res, url.searchParams.size ? result : result.items);
                }
                if (path === '/api/admin/export' && method === 'GET') {
                    permit(actor, 'reception');
                    requireValue(actor.canExport, '没有名单导出权限', 403);
                    const kind = url.searchParams.get('kind') === 'consultations' ? 'consultations' : 'bookings';
                    const rows = (await service.adminRecords(actor, kind, Object.fromEntries(url.searchParams)));
                    const escape = v => `"${String(v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`;
                    const csv = '\ufeff' + [['导出时间', now()], ['编号', '联系人', '手机号', '状态', '意向日期', '人数'], ...rows.map(r => [r.id, r.request.contactName, r.request.phone, r.state, r.request.date, r.headcount])].map(r => r.map(escape).join(',')).join('\r\n');
                    (await audit(db, actor, 'records.export', kind, { count: rows.length }));
                    res.writeHead(200, { 'Content-Type': 'text/csv; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="${kind}.csv"` });
                    return res.end(csv);
                }
                throw new Fault(404,'接口不存在','NOT_FOUND');
                });
            }
            if (path.startsWith('/assets/') && method === 'GET') {
                const filename = path.slice(8);
                requireValue(/^[a-zA-Z0-9_.-]+\.(jpg|png)$/.test(filename), '素材不存在', 404);
                const file = join(root, 'images', filename);
                requireValue(existsSync(file), '素材不存在', 404);
                res.writeHead(200, { 'Content-Type': extname(file) === '.png' ? 'image/png' : 'image/jpeg', 'Cache-Control': 'public, max-age=3600' });
                createReadStream(file).pipe(res);
                return;
            }
            if (path.startsWith('/admin') && method === 'GET') {
                const base = join(root, 'admin/dist');
                let file = resolve(base, '.' + decodeURIComponent(path.replace(/^\/admin/, '')));
                requireValue(file.startsWith(base + '/') || file === base, '访问路径无效', 404);
                if (!existsSync(file) || statSync(file).isDirectory())
                    file = join(base, 'index.html');
                requireValue(existsSync(file), '网页后台尚未构建，请运行 npm run dev', 503);
                const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };
                res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store',
                    'Content-Security-Policy': "default-src 'self'; img-src 'self' blob:; media-src 'self' blob:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'" });
                createReadStream(file).pipe(res);
                return;
            }
            throw new Fault(404, '接口或页面不存在', 'NOT_FOUND');
        }
        catch (e) {
            if (res.headersSent) {
                res.destroy();
                return;
            }
            if (!(e instanceof Fault)&&!e.safe) console.error('请求处理异常:', {code:typeof e.code==='string'?e.code:'INTERNAL_ERROR'}); // Never log request bodies, tokens, or credentials.
            json(res, { error: (e instanceof Fault||e.safe) ? e.message : '服务处理失败，请重试', code: e.code || 'INTERNAL_ERROR', ...(e instanceof Fault && e.field ? { field: e.field } : {}), ...(e instanceof Fault && e.references ? { references: e.references } : {}) }, e.status || 500);
        }
    });
    server.requestTimeout = 120000;
    server.headersTimeout = 15000;
    return { server, service };
}
