import { publicProduct } from './public-product.mjs';
import { productConsultationSnapshot } from './consultation-sku.mjs';
import { prepareSkuSave, writeSkus, readSkuProduct } from './product-sku.mjs';
import { randomUUID } from 'node:crypto';
import { transaction, decode, now } from './database.mjs';
import { requireValue, text, number, futureDate, contact, permit, digest } from '../security.mjs';
import { INSTRUMENT_CATEGORIES, PRODUCT_CATEGORIES } from '../../shared/status.mjs';
import { enrollmentData, publicEnrollment } from '../enrollment.mjs';
export const publicContent = row => ({ id: row.id, kind: row.kind, name: row.name, ...decode(row.data), state: row.state, sort: row.sort, version: row.version });
const record = row => row && ({ ...row, snapshot: decode(row.snapshot), request: decode(row.request),
    ...(Object.hasOwn(row, 'confirmed') ? { confirmed: decode(row.confirmed), contact_log: decode(row.contact_log) } : { followups: decode(row.followups) }) });
const visitorRecord = row => {
    const r = record(row);
    if (!r)
        return null;
    delete r.owner;
    delete r.contact_log;
    delete r.followups;
    if (r.snapshot?.sku)
        r.snapshot = { ...r.snapshot, sku: { specLabel: r.snapshot.sku.specLabel, referencePrice: r.snapshot.sku.referencePrice } };
    return r;
};
const id = prefix => `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
async function audit(db, actor, action, object, detail = {}) { await db.execute('INSERT INTO audit(actor,action,object,detail,created_at) VALUES($1,$2,$3,$4,$5)', [actor.id, action, object, JSON.stringify(detail), now()]); }
export class Foundation {
    constructor(db,{environment='development'}={}) { this.db = db; this.environment=environment; }
    async content(id, published = true) {
        const row = (await this.db.maybeOne("SELECT * FROM content WHERE id=$1", [id]));
        requireValue(row && (!published || row.state === 'published'), '内容已下架或不存在', 404, 'CONTENT_UNAVAILABLE');
        return published ? (await publicProduct(this.db, publicContent(row))) : (await readSkuProduct(this.db, publicContent(row)));
    }
    async saveContent(actor, data, existingId) {
        permit(actor, 'content');
        return (await transaction(this.db, async () => {
            if(existingId) await this.db.lockRows('content',[existingId]);
            else if(data.kind==='site') await this.db.lockKey('hq:site');
            const prev = existingId ? (await this.content(existingId, false)) : null;
            if (prev)
                requireValue(data.version === prev.version, '内容已被其他人员修改，请刷新后重试', 409, 'VERSION_CONFLICT');
            const kind = prev?.kind || data.kind;
            requireValue(['site', 'product', 'package', 'lesson', 'spot'].includes(kind), '内容类型无效');
            if (kind === 'site' && !existingId)
                requireValue(!(await this.db.maybeOne("SELECT 1 FROM content WHERE kind='site'", [])), '首页与企业配置为单一站点，请维护现有配置');
            const name = text(data.name, '名称', 120);
            const state = data.state || 'draft';
            requireValue(['draft', 'published', 'archived'].includes(state), '发布状态无效');
            requireValue(typeof data.data === 'object' && data.data && !Array.isArray(data.data), '内容格式错误');
            requireValue(JSON.stringify(data.data).length <= 50000, '单条内容过大');
            const allowed = ['variantModelVersion', 'variantMode', 'options', 'code', 'category', 'series', 'brand', 'description', 'images', 'specs', 'priceMode', 'price', 'priceNote',
                'itinerary', 'ageNote', 'durationNote', 'referenceParentPrice', 'referenceSinglePrice', 'included', 'excluded', 'materials',
                'meetingPoint', 'transfer', 'bookingNote', 'cancelNote', 'type', 'mediaId', 'rights', 'duration', 'audience', 'form', 'place',
                'courseTime', 'courseFee', 'address', 'opening', 'visitNote', 'phone', 'heroTitle', 'heroSubtitle', 'intro', 'notice',
                'privacy', 'serviceNote', 'bookingEnabled', 'isTest', 'highlight', 'latitude', 'longitude', 'coordinateVerified'];
            if (Object.hasOwn(data.data, 'tags') || Object.hasOwn(data.data, 'visitItems')) {
                requireValue(kind === 'spot', '点位标签和参观项目仅适用于园区点位');
                allowed.push('tags', 'visitItems');
            }
            const key = existingId || randomUUID();
            const skuPlan = kind === 'product' ? (await prepareSkuSave(this.db, key, data.data, data.skus, prev)) : null;
            const detail = Object.fromEntries(allowed.filter(k => Object.hasOwn(data.data, k)).map(k => [k, data.data[k]]));
            if (skuPlan) {
                delete detail.specs;
                detail.options = skuPlan.options;
            }
            if(this.environment==='production'){requireValue(detail.isTest!==true,'生产环境禁止测试内容');detail.isTest=false;}else{requireValue(detail.isTest!==false,'开发/测试环境内容必须标记为测试资料');detail.isTest=true;}
            for (const [key, value] of Object.entries(detail)) {
                requireValue(value === null || ['string', 'number', 'boolean'].includes(typeof value) || Array.isArray(value), `${key}类型无效`);
                if (typeof value === 'string')
                    requireValue(value.length <= 12000, `${key}过长`);
                if (typeof value === 'number')
                    requireValue(Number.isFinite(value), `${key}数值无效`);
            }
            if (detail.phone)
                requireValue(/^[+\d][\d\s()-]{4,29}$/.test(detail.phone), '服务电话格式无效');
            if (kind === 'spot') {
                if (Object.hasOwn(detail, 'tags')) {
                    requireValue(Array.isArray(detail.tags) && detail.tags.length <= 12 && detail.tags.every(tag => typeof tag === 'string' && tag.trim().length > 0 && tag.length <= 40), '点位标签最多12项，每项1—40字');
                }
                if (Object.hasOwn(detail, 'visitItems')) {
                    requireValue(Array.isArray(detail.visitItems) && detail.visitItems.length <= 20 && detail.visitItems.every(item => item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).every(key => ['name', 'description', 'durationNote'].includes(key)) &&
                        typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 80 &&
                        typeof item.description === 'string' && item.description.length <= 200 &&
                        typeof item.durationNote === 'string' && item.durationNote.trim().length > 0 && item.durationNote.length <= 40), '参观项目最多20项，名称1—80字、说明0—200字、时长说明1—40字');
                }
            }
            if (kind === 'product') {
                requireValue(Object.hasOwn(PRODUCT_CATEGORIES, detail.category), '请选择有效的乐器品类或文创');
                requireValue(['inquiry', 'reference'].includes(detail.priceMode), '请选择参考价格或咨询报价');
                if (detail.priceMode === 'reference')
                    requireValue(typeof detail.price === 'number' && detail.price >= 0 && detail.price <= 1e7, '参考价格无效');
            }
            if (detail.images || detail.specs?.some(s => s.images?.length)) {
                detail.images = detail.images || [];
                requireValue(Array.isArray(detail.images) && detail.images.length <= 12, '图片最多12张');
                for (const image of [...detail.images, ...(detail.specs || []).flatMap(s => s.images || [])]) {
                    requireValue(typeof image === 'string' && /^\/(assets\/[a-zA-Z0-9_.-]+|api\/media\/[a-zA-Z0-9-]+)$/.test(image), '请使用素材库或上传的图片');
                    if (image.startsWith('/api/media/')) {
                        const m = (await this.db.maybeOne("SELECT * FROM media WHERE id=$1", [image.split('/').at(-1)]));
                        requireValue(m && m.mime.startsWith('image/'), '关联图片不存在');
                    }
                }
            }
            if (kind === 'lesson' && detail.type === 'video' && state === 'published') {
                const media = (await this.db.maybeOne("SELECT * FROM media WHERE id=$1", [detail.mediaId || '']));
                requireValue(media && media.mime.startsWith('video/'), '请先实际上传视频文件再发布');
                requireValue(media.rights.trim() && typeof detail.duration === 'number' && detail.duration > 0, '请登记视频权属和实际时长');
            }
            if (kind === 'spot' && (detail.latitude != null || detail.longitude != null)) {
                requireValue(detail.coordinateVerified === true && Number.isFinite(detail.latitude) && Number.isFinite(detail.longitude)
                    && Math.abs(detail.latitude) <= 90 && Math.abs(detail.longitude) <= 180, '地图坐标须经过核实');
            }
            const sort = number(data.sort ?? prev?.sort ?? 0, '排序', 0, 10000);
            if (prev)
                (await this.db.execute("UPDATE content SET name=$1,data=$2,state=$3,sort=$4,version=version+1,updated_at=$5 WHERE id=$6", [name, JSON.stringify(detail), state, sort, now(), key]));
            else
                (await this.db.execute("INSERT INTO content VALUES ($1,$2,$3,$4,$5,$6,1,$7,$8)", [key, kind, name, JSON.stringify(detail), state, sort, now(), now()]));
            const skuChanges = skuPlan ? (await writeSkus(this.db, skuPlan)) : null;
            (await audit(this.db, actor, prev ? 'content.update' : 'content.create', key, { from: prev?.state, to: state, version: (prev?.version || 0) + 1, ...(skuChanges ? { skuChanges } : {}) }));
            return (await this.content(key, false));
        }));
    }
    async slots(publicOnly = false) {
        const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' }).format(new Date());
        return (await this.db.many("SELECT s.*,COALESCE((SELECT SUM(b.headcount) FROM bookings b WHERE b.slot_id=s.id AND b.state IN ('confirmed','completed','no_show')),0) AS confirmed_count FROM slots s ORDER BY s.date,s.start", [])).filter(s => !publicOnly || (!s.paused && s.date >= today))
            .map(s => ({ ...s, package_ids: decode(s.package_ids), enrollment: decode(s.enrollment),
            occupied_count: s.external_count + s.confirmed_count, remaining: Math.max(0, s.capacity - s.external_count - s.confirmed_count) }));
    }
    async idempotent(visitor, route, key, body, fn) {
        requireValue(typeof key === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(key), '缺少有效的重复提交保护编号');
        return (await transaction(this.db, async () => {
            await this.db.lockKey(JSON.stringify(['idempotency',visitor.id,route,key]));
            const fingerprint = digest(JSON.stringify(body));
            const old = (await this.db.maybeOne("SELECT * FROM idempotency WHERE owner=$1 AND route=$2 AND key=$3", [visitor.id, route, key]));
            if (old) {
                requireValue(old.fingerprint === fingerprint, '重试内容已改变，请使用新的提交编号', 409, 'IDEMPOTENCY_CONFLICT');
                return decode(old.response);
            }
            const response = (await fn());
            (await this.db.execute("INSERT INTO idempotency VALUES ($1,$2,$3,$4,$5)", [visitor.id, route, key, fingerprint, JSON.stringify(response)]));
            return response;
        }));
    }
    async getBooking(key, visitor, admin = false) {
        const row = (await this.db.maybeOne("SELECT * FROM bookings WHERE id=$1", [key]));
        requireValue(row && (admin || row.owner === visitor.id), '预约不存在或无权访问', 404, 'NOT_FOUND');
        const result = admin ? record(row) : visitorRecord(row);
        result.changes = (await this.db.many("SELECT * FROM changes WHERE booking_id=$1 ORDER BY created_at DESC", [key])).map(c => ({ ...c, data: decode(c.data), result: decode(c.result) }));
        return result;
    }
    async validateAssignee(key) {
        if (!key)
            return null;
        const account = (await this.db.maybeOne("SELECT * FROM accounts WHERE id=$1 AND active=true", [key]));
        requireValue(account && decode(account.roles).some(r => ['admin', 'reception'].includes(r)), '负责人须为有效的接待人员');
        return key;
    }
    async capacity(slotId, packageId, count, excludedBooking) {
        const slot = (await this.slots()).find(s => s.id === slotId);
        requireValue(slot && !slot.paused && (packageId === 'group-general' || slot.package_ids.includes(packageId)), '场次不可用或不适用', 409, 'SLOT_UNAVAILABLE');
        futureDate(slot.date);
        const used = (await this.db.maybeOne("SELECT COALESCE(SUM(headcount),0) AS n FROM bookings WHERE slot_id=$1 AND state IN ('confirmed','completed','no_show') AND id<>$2", [slotId, excludedBooking])).n;
        requireValue(slot.external_count + used + count <= slot.capacity, '该场次剩余容量不足，原安排未改变', 409, 'CAPACITY_FULL');
        return slot;
    }
    async handleBooking(actor, key, data) {
        permit(actor, 'reception');
        return (await transaction(this.db, async () => {
            const initial = await this.db.maybeOne('SELECT slot_id FROM bookings WHERE id=$1',[key]);
            await this.db.lockRows('slots',[initial?.slot_id,data.slotId]);
            await this.db.lockRows('bookings',[key]);
            const row = (await this.getBooking(key, null, true));
            requireValue(row.slot_id===initial?.slot_id,'预约关联已更新，请重试',409,'VERSION_CONFLICT');
            requireValue(data.version === row.version, '预约已由其他人员处理，请刷新', 409, 'VERSION_CONFLICT');
            const note = text(data.note || '', '处理说明', 1500, true);
            const actions = ['assign', 'followup', 'confirm', 'reject', 'arrive', 'complete', 'cancel', 'no_show', 'change_approve', 'change_reject'];
            requireValue(actions.includes(data.action), '操作无效');
            let state = row.state, slotId = row.slot_id, headcount = row.headcount, confirmed = row.confirmed, arrived = row.arrived_at;
            let assignee = row.assignee;
            if (data.action === 'assign')
                assignee = (await this.validateAssignee(data.assignee));
            if (data.action === 'followup')
                requireValue(note, '请填写联系情况');
            if (data.action === 'confirm') {
                requireValue(state === 'pending', '仅待确认预约可确认', 409);
                if (row.request.enrollment)
                    requireValue(data.slotId === row.request.enrollment.id, '跟团申请须确认到游客所选活动场次；其他安排请联系游客另行申请', 409, 'ENROLLMENT_SLOT_MISMATCH');
                requireValue(note, '请填写已联系游客的确认安排说明');
                assignee = (await this.validateAssignee(data.assignee || assignee || actor.id));
                const slot = (await this.capacity(data.slotId, row.snapshot.id, row.headcount, key));
                state = 'confirmed';
                slotId = slot.id;
                confirmed = { date: slot.date, start: slot.start, end: slot.end, total: headcount, adults: row.request.adults, children: row.request.children, arrangement: note };
            }
            if (data.action === 'reject') {
                requireValue(state === 'pending' && note, '仅待确认申请可拒绝，需说明原因', 409);
                state = 'rejected';
            }
            if (data.action === 'arrive') {
                requireValue(state === 'confirmed' && !arrived, '仅已确认且未登记到访的预约可到访', 409);
                arrived = now();
            }
            if (data.action === 'complete') {
                requireValue(state === 'confirmed' && arrived, '先登记到访再完成接待', 409);
                state = 'completed';
            }
            if (data.action === 'no_show') {
                requireValue(state === 'confirmed' && !arrived && note, '未到访登记须为已确认且未到访预约并填写说明', 409);
                state = 'no_show';
            }
            if (data.action === 'cancel') {
                requireValue(state === 'confirmed' && note, '仅已确认预约可人工取消，需说明原因', 409);
                state = 'cancelled';
            }
            if (data.action.startsWith('change_')) {
                requireValue(state === 'confirmed', '预约状态已改变，无法处理变更', 409);
                const change = (await this.db.maybeOne("SELECT * FROM changes WHERE booking_id=$1 AND state='pending' AND id=$2", [key, data.changeId]));
                requireValue(change && note, '变更不存在或缺少处理说明', 409);
                const request = decode(change.data);
                if (data.action === 'change_approve') {
                    if (change.type === 'cancel')
                        state = 'cancelled';
                    else {
                        const slot = (await this.capacity(data.slotId, row.snapshot.id, request.total, key));
                        requireValue(slot.date === request.date, '确认场次日期须与变更申请一致');
                        headcount = request.total;
                        slotId = slot.id;
                        confirmed = { ...confirmed, ...request, date: slot.date, start: slot.start, end: slot.end, arrangement: note };
                    }
                }
                (await this.db.execute("UPDATE changes SET state=$1,result=$2,handled_at=$3 WHERE id=$4", [data.action === 'change_approve' ? 'approved' : 'rejected', JSON.stringify({ note, before: row.confirmed, after: confirmed, actor: actor.id }), now(), change.id]));
            }
            const log = [...row.contact_log, { actor: actor.id, at: now(), action: data.action, note }];
            const publicNote = ['followup', 'assign'].includes(data.action) ? row.public_note : note || row.public_note;
            (await this.db.execute("UPDATE bookings SET state=$1,slot_id=$2,headcount=$3,confirmed=$4,assignee=$5,contact_log=$6,public_note=$7,arrived_at=$8,updated_at=$9,version=version+1 WHERE id=$10", [state, slotId, headcount, confirmed ? JSON.stringify(confirmed) : null, assignee, JSON.stringify(log), publicNote, arrived, now(), key]));
            if (['cancelled', 'completed', 'no_show'].includes(state))
                (await this.db.execute("UPDATE changes SET state='rejected',result=$1,handled_at=$2 WHERE booking_id=$3 AND state='pending'", [JSON.stringify({ note: '预约已结束或取消，变更不再适用' }), now(), key]));
            (await audit(this.db, actor, `booking.${data.action}`, key, { before: { state: row.state, confirmed: row.confirmed }, after: { state, confirmed }, assignee }));
            return (await this.getBooking(key, null, true));
        }));
    }
    async createConsultation(visitor, data, key) {
        return (await this.idempotent(visitor, 'consultations', key, data, async () => {
            const request = { ...contact(data), message: text(data.message, '咨询内容', 1500), source: text(data.source || '联系咨询', '来源', 120) };
            let snapshot = null;
            if (data.contentId) {
                await this.db.lockRows('content',[data.contentId],'SHARE');
                const row = (await this.db.maybeOne("SELECT * FROM content WHERE id=$1", [data.contentId]));
                requireValue(row && row.state === 'published', '产品或内容已下架，请返回重新选择', 404, 'PRODUCT_UNAVAILABLE');
                const c = publicContent(row);
                requireValue(['product', 'lesson', 'package', 'spot'].includes(c.kind), '咨询关联对象无效');
                if (c.kind === 'product')
                    snapshot = (await productConsultationSnapshot(this.db, c, data.skuId));
                else {
                    requireValue(!data.skuId, '该内容不支持产品规格', 400, 'SKU_PRODUCT_MISMATCH');
                    snapshot = { id: c.id, name: c.name, code: c.code || '', category: c.category || '', spec: '', version: c.version };
                }
            }
            requireValue(data.contentId || !data.skuId, '请指定规格所属产品', 400, 'SKU_PRODUCT_MISMATCH');
            const key = id('ZX');
            (await this.db.execute("INSERT INTO consultations(id,owner,snapshot,request,state,created_at,updated_at) VALUES ($1,$2,$3,$4,'pending',$5,$6)", [key, visitor.id, JSON.stringify(snapshot), JSON.stringify(request), now(), now()]));
            return { id: key, state: 'pending', message: '咨询已提交，工作人员将与您联系' };
        }));
    }
}
