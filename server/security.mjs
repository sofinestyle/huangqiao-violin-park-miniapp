import { randomBytes, randomUUID, createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { now, decode } from './db.mjs';
export class Fault extends Error {
    constructor(status, message, code = 'INVALID_REQUEST') { super(message); this.status = status; this.code = code; }
}
export function requireValue(condition, message, status = 400, code) {
    if (!condition)
        throw new Fault(status, message, code);
}
export const digest = value => createHash('sha256').update(value).digest('hex');
export function hashPassword(password) {
    requireValue(typeof password === 'string' && password.length >= 12 && password.length <= 256, '密码须为12—256个字符');
    const salt = randomBytes(16).toString('hex');
    return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}
export function checkPassword(password, stored) {
    if (typeof password !== 'string' || password.length > 256)
        return false;
    const [salt, hash] = stored.split(':');
    const actual = scryptSync(password, salt, 64);
    return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}
export async function createAccount(db, { username, password, roles = ['admin'], canExport = false, active = true }) {
    requireValue(/^[a-zA-Z0-9_-]{3,40}$/.test(username), '账号名称须为3—40位字母、数字、下划线或短横线');
    requireValue(Array.isArray(roles) && roles.length && roles.every(x => ['admin', 'content', 'reception'].includes(x)), '角色无效');
    requireValue(typeof active === 'boolean', '启用状态须为布尔值');
    const account = { id: randomUUID(), username, roles, canExport, active };
    (await db.execute("INSERT INTO accounts VALUES ($1,$2,$3,$4,$5,$6,$7)", [account.id, username, hashPassword(password), JSON.stringify(roles), canExport, active, now()]));
    return account;
}
export async function issueSession(db, owner, type) {
    const token = randomBytes(32).toString('base64url');
    const expiresAt = Date.now() + (type === 'admin' ? 8 * 3600e3 : 30 * 86400e3);
    (await db.execute("INSERT INTO sessions VALUES ($1,$2,$3,$4)", [digest(token), owner, type, expiresAt]));
    return { token, expiresAt };
}
export async function authenticate(db, token, type) {
    const s = (await db.maybeOne("SELECT * FROM sessions WHERE token_hash=$1 AND type=$2 AND expires_at>$3", [digest(token || ''), type, Date.now()]));
    requireValue(s, '请先登录或重新建立测试身份', 401, 'AUTH_REQUIRED');
    if (type === 'admin') {
        const a = (await db.maybeOne("SELECT * FROM accounts WHERE id=$1", [s.owner]));
        requireValue(a && a.active, '账号已停用', 401, 'ACCOUNT_DISABLED');
        return { id: a.id, username: a.username, roles: decode(a.roles), canExport: !!a.can_export };
    }
    return { id: s.owner };
}
export function permit(actor, role) {
    requireValue(actor.roles.includes('admin') || actor.roles.includes(role), '没有此操作权限', 403, 'FORBIDDEN');
}
export async function audit(db, actor, action, object, detail = {}) {
    (await db.execute("INSERT INTO audit(actor,action,object,detail,created_at) VALUES ($1,$2,$3,$4,$5)", [actor.id, action, object, JSON.stringify(detail), now()]));
}
export function text(value, label, max = 500, optional = false) {
    requireValue(typeof value === 'string', `${label}格式错误`);
    const trimmed = value.trim();
    requireValue((optional || trimmed.length > 0) && trimmed.length <= max, `${label}须为${optional ? '0' : '1'}—${max}个字符`);
    return trimmed;
}
export function number(value, label, min = 0, max = 10000) {
    requireValue(Number.isInteger(value) && value >= min && value <= max, `${label}须为${min}—${max}之间的整数`);
    return value;
}
export function futureDate(value) {
    requireValue(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value), '请选择有效日期');
    const date = new Date(`${value}T00:00:00+08:00`);
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
    requireValue(Number.isFinite(+date) && new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(date) === value && value >= today, '日期无效或已过去');
    return value;
}
export function contact(data) {
    const name = text(data.contactName, '联系人', 60);
    const phone = text(data.phone, '中国大陆手机号', 11);
    requireValue(/^1[3-9]\d{9}$/.test(phone), '请填写有效的中国大陆手机号');
    requireValue(data.consent === true, '请阅读并同意测试环境资料使用说明');
    return { contactName: name, phone };
}
