import {requireValue} from './security.mjs';
const allowed = new Set(['page','pageSize','from','to','actor','action']);
export async function auditQuery(db, params) {
  for (const key of params.keys()) requireValue(allowed.has(key) && params.getAll(key).length===1,'审计查询参数无效');
  const pageValue=params.get('page') ?? '1', sizeValue=params.get('pageSize') ?? '50';
  requireValue(/^[1-9]\d*$/.test(pageValue) && Number.isSafeInteger(+pageValue) && +pageValue<=Math.floor(Number.MAX_SAFE_INTEGER/100),'page须为有效正整数');
  requireValue(['20','50','100'].includes(sizeValue),'pageSize仅支持20、50、100');
  const page=+pageValue,pageSize=+sizeValue,where=[],values=[];
  const timestamp=key=>{
    const value=params.get(key);if(!value)return null;
    requireValue(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value),'时间须为带时区的ISO8601格式');
    // Reject calendar overflow rather than silently normalizing e.g. February 30.
    const [datePart,timePart]=value.split('T'), date=new Date(datePart+'T00:00:00Z');
    requireValue(+timePart.slice(0,2)<24 && +timePart.slice(3,5)<60 && +timePart.slice(6,8)<60,'时间无效');
    requireValue(Number.isFinite(+date) && date.toISOString().slice(0,10)===datePart && Number.isFinite(Date.parse(value)),'时间无效');
    return new Date(value).toISOString();
  };
  const from=timestamp('from'),to=timestamp('to');requireValue(!from || !to || from<=to,'开始时间不能晚于结束时间');
  if(from){values.push(from);where.push('audit.created_at>=$'+values.length);}
  if(to){values.push(to);where.push('audit.created_at<=$'+values.length);}
  for(const key of ['actor','action']){
    const value=params.get(key);if(value){requireValue(value.length<=200,'审计筛选值过长');values.push(value);where.push(`audit.${key}=$${values.length}`);}
  }
  const clause=where.length?' WHERE '+where.join(' AND '):'';
  // Count and bounded page share one statement snapshot, including inside an outer transaction.
  const rows=await db.many('SELECT totals.total, page.* FROM (SELECT COUNT(*) AS total FROM audit'+clause+') totals LEFT JOIN LATERAL (SELECT audit.*,accounts.username AS actor_name FROM audit LEFT JOIN accounts ON accounts.id=audit.actor'+clause+` ORDER BY audit.created_at DESC,audit.id DESC LIMIT $${values.length+1} OFFSET $${values.length+2}) page ON true ORDER BY page.created_at DESC,page.id DESC`,[...values,pageSize,(page-1)*pageSize]);
  return {items:rows.filter(r=>r.id!==null).map(({total,...item})=>item),total:rows[0].total,page,pageSize};
}
export async function auditOptions(db){return {
 actions:(await db.many('SELECT DISTINCT action FROM audit ORDER BY action')).map(a=>a.action),
 actors:await db.many('SELECT DISTINCT audit.actor AS id,accounts.username AS name FROM audit LEFT JOIN accounts ON accounts.id=audit.actor ORDER BY audit.actor')
};}
