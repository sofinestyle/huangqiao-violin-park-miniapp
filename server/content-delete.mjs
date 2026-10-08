import { Fault, permit, audit, requireValue } from './security.mjs';
import { transaction } from './db.mjs';
// These are the actual persistent relations written by Service, not name/code matching.
export async function contentDeleteCheck(db, actor, id) {
    permit(actor, 'content');
    const row = (await db.maybeOne("SELECT id,kind,name,state,version FROM content WHERE id=$1", [id]));
    requireValue(row, '内容不存在或已删除', 404, 'CONTENT_NOT_FOUND');
    const references = { consultations: 0, sessions: 0, bookings: 0 };
    const result = (allowed, code = '', message = '') => ({ ...row, allowed, code, message, references });
    if (!['product', 'package', 'lesson'].includes(row.kind))
        return result(false, 'CONTENT_DELETE_UNSUPPORTED', '该内容类型不支持删除');
    if (!['draft', 'archived'].includes(row.state))
        return result(false, 'CONTENT_DELETE_REQUIRES_UNPUBLISHED', '已发布内容不能删除，请先下架后再删除。');
    references.consultations = (await db.maybeOne("SELECT count(*) n FROM consultations WHERE snapshot->>'id'=$1", [id])).n;
    if (row.kind === 'package') {
        const slots = "SELECT id FROM slots WHERE package_ids @> jsonb_build_array($1::text) OR enrollment->>'packageId'=$1";
        references.sessions = (await db.one(`SELECT count(*) n FROM (${slots}) AS related`,[id])).n;
        references.bookings = (await db.one(`WITH related_slots AS (${slots}) SELECT count(*) n FROM bookings WHERE snapshot->>'id'=$1 OR request#>>'{enrollment,packageId}'=$1 OR slot_id IN (SELECT id FROM related_slots) OR request->>'slotId' IN (SELECT id FROM related_slots) OR request#>>'{enrollment,id}' IN (SELECT id FROM related_slots)`,[id])).n;
    }
    if (Object.values(references).some(Boolean)) {
        const noun = row.kind === 'product' ? '该产品' : row.kind === 'package' ? '该研学套餐' : '该教学内容';
        const counts = [references.consultations && `${references.consultations}条历史咨询记录`, references.sessions && `${references.sessions}条场次记录`, references.bookings && `${references.bookings}条预约记录`].filter(Boolean).join('、');
        return result(false, 'CONTENT_DELETE_REFERENCED', `${noun}已有${counts}，不能删除。如不再使用，请保持下架状态。`);
    }
    return result(true);
}
export async function deleteContent(db, actor, id, version) {
    permit(actor, 'content');
    requireValue(Number.isInteger(version) && version > 0, '请提供有效内容版本', 400, 'INVALID_VERSION');
    return (await transaction(db, async () => {
        await db.lockRows('content',[id]);
        const check = (await contentDeleteCheck(db, actor, id));
        if (!check.allowed) {
            const error = new Fault(check.code === 'CONTENT_DELETE_UNSUPPORTED' ? 400 : 409, check.message, check.code);
            error.references = check.references;
            throw error;
        }
        requireValue(version === check.version, '内容已被其他人员修改，请刷新后重试', 409, 'VERSION_CONFLICT');
        if (check.kind === 'product')
            (await db.execute("DELETE FROM product_skus WHERE product_id=$1", [id]));
        (await db.execute("DELETE FROM content WHERE id=$1", [id]));
        (await audit(db, actor, 'content.delete', id, { id, kind: check.kind, name: check.name, state: check.state }));
        return { ok: true, id };
    }));
}
