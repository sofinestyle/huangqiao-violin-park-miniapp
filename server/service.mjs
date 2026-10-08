import { publicProduct } from './public-product.mjs';
import { contentDeleteCheck, deleteContent } from './content-delete.mjs';
import { readSkuProduct } from './product-sku.mjs';
import { randomUUID } from 'node:crypto';
import { transaction, decode, now } from './db.mjs';
import { requireValue, text, number, futureDate, contact, permit, audit } from './security.mjs';
import { INSTRUMENT_CATEGORIES } from '../shared/status.mjs';
import { enrollmentData, publicEnrollment } from './enrollment.mjs';
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
import { Foundation } from './pg/foundation.mjs';
export class Service extends Foundation {
    async listContent({ kind, category, q = '' } = {}, admin = false) {
        const rows = (await this.db.many(`SELECT * FROM content ${admin ? '' : "WHERE state='published'"} ORDER BY sort,id`, [])).map(publicContent);
        const allSkus = admin ? (await this.db.many("SELECT * FROM product_skus ORDER BY sort_order,id", [])) : [];
        const grouped = new Map();
        for (const s of allSkus) {
            const list = grouped.get(s.product_id) || [];
            list.push({ ...s, enabled: !!s.enabled, option_values: decode(s.option_values), images: decode(s.images) });
            grouped.set(s.product_id, list);
        }
        return (await Promise.all(rows.map(async (r) => admin ? (await readSkuProduct(this.db, r, false, grouped.get(r.id) || [])) : (await publicProduct(this.db, r, { detail: false }))))).filter(r => (!kind || r.kind === kind) && (!category || (category === 'instrument' ? Object.hasOwn(INSTRUMENT_CATEGORIES, r.category) : r.category === category)) && (!q || `${r.name} ${r.code || ''} ${r.series || ''}`.toLowerCase().includes(q.toLowerCase())));
    }
    async contentDeleteCheck(actor, id) { return (await transaction(this.db, async () => (await contentDeleteCheck(this.db, actor, id)))); }
    async deleteContent(actor, id, version) { return (await deleteContent(this.db, actor, id, version)); }
    async enrollments() {
        const packages = new Map((await this.listContent({ kind: 'package' })).map(p => [p.id, p]));
        const enabled = (await this.listContent({ kind: 'site' }))[0]?.bookingEnabled === true;
        return (await this.slots(true)).filter(s => s.enrollment.state === 'published' && packages.has(s.enrollment.packageId))
            .map(s => publicEnrollment(s, packages.get(s.enrollment.packageId), enabled));
    }
    async enrollment(key) {
        const item = (await this.enrollments()).find(s => s.id === key);
        requireValue(item, '报名活动已下架、暂停或不存在', 404, 'ENROLLMENT_UNAVAILABLE');
        return item;
    }
    async saveSlot(actor, data, slotId) {
        permit(actor, 'reception');
        return (await transaction(this.db, async () => {
            const prior=slotId?await this.db.maybeOne('SELECT package_ids FROM slots WHERE id=$1',[slotId]):null;
            await this.db.lockRows('content',[...(prior?.package_ids||[]),...(Array.isArray(data.packageIds)?data.packageIds:[])],'SHARE');
            await this.db.lockRows('slots',[slotId]);
            const prev = slotId ? (await this.slots()).find(s => s.id === slotId) : null;
            if(prev) requireValue(JSON.stringify(prev.package_ids)===JSON.stringify(prior.package_ids),'场次关联已改变，请刷新',409,'VERSION_CONFLICT');
            if (slotId)
                requireValue(prev, '场次不存在', 404);
            if (prev)
                requireValue(prev.version === data.version, '场次已修改，请刷新', 409, 'VERSION_CONFLICT');
            const date = futureDate(data.date), start = text(data.start, '开始时间', 5), end = text(data.end, '结束时间', 5);
            requireValue(/^([01]\d|2[0-3]):[0-5]\d$/.test(start) && /^([01]\d|2[0-3]):[0-5]\d$/.test(end) && start < end, '时间段无效');
            const capacity = number(data.capacity, '人数上限', 1);
            const externalCount = number(data.externalCount ?? prev?.external_count ?? 0, '系统外已成团人数', 0);
            requireValue(capacity >= externalCount + (prev?.confirmed_count || 0), '人数上限不能低于系统外人数与系统已确认人数之和', 409, 'CAPACITY_FULL');
            requireValue(Array.isArray(data.packageIds) && data.packageIds.length > 0, '请选择适用套餐');
            for (const pid of data.packageIds)
                requireValue((await this.content(pid, false)).kind === 'package', '关联套餐无效');
            const hasJoinApplications = prev && (await this.db.maybeOne("SELECT 1 FROM bookings WHERE request#>>'{enrollment,id}'=$1 LIMIT 1", [prev.id]));
            if (prev?.confirmed_count > 0 || hasJoinApplications)
                requireValue(date === prev.date && start === prev.start && end === prev.end && JSON.stringify([...data.packageIds].sort()) === JSON.stringify([...prev.package_ids].sort()), '已有确认或报名记录的场次不能修改日期、时段或适用套餐，请建立新场次', 409, 'SLOT_HAS_BOOKINGS');
            const enrollment = enrollmentData(data.enrollment ?? prev?.enrollment);
            if (hasJoinApplications)
                requireValue(enrollment.packageId === prev.enrollment.packageId, '已有报名记录，不能更换跟团套餐，请建立新场次', 409, 'SLOT_HAS_BOOKINGS');
            if (enrollment.state === 'published') {
                requireValue(enrollment.title && enrollment.meetingPoint, '发布报名活动须填写活动名称和集合地点');
                requireValue(data.packageIds.includes(enrollment.packageId), '跟团套餐须属于本场次适用套餐');
                requireValue((await this.content(enrollment.packageId)).kind === 'package', '跟团套餐须已发布');
                requireValue(externalCount + (prev?.confirmed_count || 0) > 0, '请登记实际已成团人数，或先确认已有团体预约');
            }
            const note = text(data.note || '', '接待说明', 1500, true);
            const key = slotId || randomUUID();
            if (prev)
                (await this.db.execute("UPDATE slots SET date=$1,start=$2,\"end\"=$3,capacity=$4,package_ids=$5,paused=$6,note=$7,external_count=$8,enrollment=$9,version=version+1 WHERE id=$10", [date, start, end, capacity, JSON.stringify(data.packageIds), !!data.paused, note, externalCount, JSON.stringify(enrollment), key]));
            else
                (await this.db.execute("INSERT INTO slots(id,date,start,\"end\",capacity,package_ids,paused,note,external_count,enrollment) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)", [key, date, start, end, capacity, JSON.stringify(data.packageIds), !!data.paused, note, externalCount, JSON.stringify(enrollment)]));
            (await audit(this.db, actor, 'slot.save', key, { date, start, end, capacity, paused: !!data.paused, externalCount,
                previousExternalCount: prev?.external_count ?? 0, enrollmentState: enrollment.state, previousEnrollmentState: prev?.enrollment.state || 'draft', title: enrollment.title }));
            return (await this.slots()).find(s => s.id === key);
        }));
    }
    bookingRequest(data, group = false) {
        const requested = { ...contact(data), date: futureDate(data.date), note: text(data.note || '', '说明', 1500, true), group };
        if (data.preferredTime != null) {
            const preferredTime = text(data.preferredTime, '意向时间段', 100, true);
            if (preferredTime)
                requested.preferredTime = preferredTime;
        }
        if (group) {
            requested.team = text(data.team, '团队名称', 120);
            requested.total = number(data.total, '预计总人数', 1);
            requireValue(requested.note.length > 0, '请填写团体需求说明');
        }
        else {
            requested.adults = number(data.adults, '成人数');
            requested.children = number(data.children, '儿童数');
            requested.total = requested.adults + requested.children;
            requireValue(requested.total > 0 && requested.total <= 10000, '参加人数必须大于零');
        }
        requested.slotId = data.slotId || null;
        return requested;
    }
    async createBooking(visitor, data, key) {
        return (await this.idempotent(visitor, 'bookings', key, data, async () => {
            await this.db.lockRows('content',[data.packageId],'SHARE');
            await this.db.lockRows('slots',[data.slotId]);
            const requested = this.bookingRequest(data, data.group === true);
            if (data.enrollmentId) {
                requireValue(!requested.preferredTime, '跟团活动使用已发布的固定时段，不能另填意向时间段');
                const activity = (await this.enrollment(data.enrollmentId));
                requireValue(!requested.group && requested.date === activity.date && data.packageId === activity.packageId && requested.slotId === activity.id, '报名日期、时段及套餐必须与所选活动一致');
                requireValue(activity.canApply, '该活动暂不可报名', 409, 'ENROLLMENT_CLOSED');
                requireValue(requested.total <= activity.remaining, '本次报名人数超过当前剩余名额，请联系工作人员', 409, 'CAPACITY_FULL');
                requested.enrollment = { ...activity };
            }
            const pkg = requested.group && !data.packageId
                ? { id: 'group-general', kind: 'package', name: '团体研学需求（未指定套餐）', isTest: this.environment!=='production' }
                : (await this.content(data.packageId));
            requireValue(pkg.kind === 'package', '请选择研学套餐');
            const site = (await this.listContent({ kind: 'site' }))[0];
            requireValue(site?.bookingEnabled === true, '预约申请尚未开放，请联系工作人员', 409, 'BOOKING_CLOSED');
            if (requested.slotId) {
                const slot = (await this.slots(true)).find(s => s.id === requested.slotId);
                requireValue(slot && slot.date === requested.date && (pkg.id === 'group-general' || slot.package_ids.includes(pkg.id)), '意向场次已暂停或不适用', 409, 'SLOT_UNAVAILABLE');
            }
            const key = id('HQ');
            (await this.db.execute("INSERT INTO bookings(id,owner,snapshot,request,state,headcount,created_at,updated_at) VALUES ($1,$2,$3,$4,'pending',$5,$6,$7)", [key, visitor.id, JSON.stringify(pkg), JSON.stringify(requested), requested.total, now(), now()]));
            return { id: key, state: 'pending', message: '预约申请已提交，工作人员确认后生效' };
        }));
    }
    async myBookings(visitor) { return (await this.db.many("SELECT * FROM bookings WHERE owner=$1 ORDER BY created_at DESC", [visitor.id])).map(visitorRecord); }
    async withdraw(visitor, key, data) {
        return (await transaction(this.db, async () => {
            await this.db.lockRows('bookings',[key]);
            const row = (await this.getBooking(key, visitor));
            requireValue(row.state === 'pending', '仅待确认申请可以直接撤回', 409);
            (await this.db.execute("UPDATE bookings SET state='cancelled',public_note=$1,updated_at=$2,version=version+1 WHERE id=$3", [text(data.reason, '撤回原因', 500), now(), key]));
            (await audit(this.db, visitor, 'booking.withdraw', key));
            return (await this.getBooking(key, visitor));
        }));
    }
    async requestChange(visitor, key, data) {
        return (await transaction(this.db, async () => {
            await this.db.lockRows('bookings',[key]);
            const row = (await this.getBooking(key, visitor));
            requireValue(row.state === 'confirmed', '只有已确认预约可以申请变更', 409);
            requireValue(!row.changes.some(c => c.state === 'pending'), '已有待处理变更，请等待工作人员处理', 409);
            requireValue(['cancel', 'reschedule'].includes(data.type), '变更类型无效');
            const payload = { reason: text(data.reason, '变更原因', 800) };
            if (data.type === 'reschedule') {
                payload.date = futureDate(data.date);
                if (row.request.group)
                    payload.total = number(data.total, '预计人数', 1);
                else {
                    payload.adults = number(data.adults, '成人数');
                    payload.children = number(data.children, '儿童数');
                    payload.total = payload.adults + payload.children;
                    requireValue(payload.total > 0, '人数必须大于零');
                }
            }
            const changeId = randomUUID();
            (await this.db.execute("INSERT INTO changes(id,booking_id,type,data,created_at) VALUES ($1,$2,$3,$4,$5)", [changeId, key, data.type, JSON.stringify(payload), now()]));
            (await audit(this.db, visitor, 'booking.change.request', key, { changeId, type: data.type }));
            return (await this.getBooking(key, visitor));
        }));
    }
    async myConsultations(visitor) { return (await this.db.many("SELECT * FROM consultations WHERE owner=$1 ORDER BY created_at DESC", [visitor.id])).map(visitorRecord); }
    async getConsultation(key, visitor, admin = false) {
        const row = (await this.db.maybeOne("SELECT * FROM consultations WHERE id=$1", [key]));
        requireValue(row && (admin || row.owner === visitor.id), '咨询不存在或无权访问', 404, 'NOT_FOUND');
        return admin ? record(row) : visitorRecord(row);
    }
    async handleConsultation(actor, key, data) {
        permit(actor, 'reception');
        return (await transaction(this.db, async () => {
            await this.db.lockRows('consultations',[key]);
            const row = (await this.getConsultation(key, null, true));
            requireValue(row.version === data.version, '咨询已更新，请刷新', 409, 'VERSION_CONFLICT');
            requireValue(['assign', 'followup', 'close'].includes(data.action), '操作无效');
            requireValue(row.state !== 'closed', '咨询已结束', 409);
            const assignee = data.action === 'assign' ? (await this.validateAssignee(data.assignee)) : row.assignee || actor.id;
            const note = text(data.note || '', '跟进或结果说明', 1500, data.action === 'assign');
            const state = data.action === 'close' ? 'closed' : data.action === 'followup' ? 'following' : row.state;
            const log = [...row.followups, { at: now(), actor: actor.id, note, action: data.action }];
            (await this.db.execute("UPDATE consultations SET state=$1,assignee=$2,followups=$3,public_note=$4,version=version+1,updated_at=$5 WHERE id=$6", [state, assignee, JSON.stringify(log), data.action === 'close' ? note : row.public_note, now(), key]));
            (await audit(this.db, actor, `consultation.${data.action}`, key, { state, assignee }));
            return (await this.getConsultation(key, null, true));
        }));
    }
    async adminRecords(actor, kind, filter = {}) {
        permit(actor, 'reception');
        const table = kind === 'bookings' ? 'bookings' : 'consultations';
        return (await this.db.many(`SELECT * FROM ${table} ORDER BY created_at DESC`, [])).map(record)
            .filter(r => (!filter.state || r.state === filter.state) && (!filter.unassigned || !r.assignee)
            && (!filter.enrollment || !!r.request.enrollment)
            && (!filter.q || `${r.id} ${r.request.contactName} ${r.request.phone} ${r.request.team || ''} ${r.request.enrollment?.title || ''}`.includes(filter.q)));
    }
}
