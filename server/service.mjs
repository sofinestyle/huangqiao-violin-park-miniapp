import { randomUUID } from 'node:crypto';
import { transaction, decode, now } from './db.mjs';
import { requireValue, text, number, futureDate, contact, permit, audit, digest } from './security.mjs';
import { INSTRUMENT_CATEGORIES, PRODUCT_CATEGORIES } from '../shared/status.mjs';
import { enrollmentData, publicEnrollment } from './enrollment.mjs';

export const publicContent = row => ({ id: row.id, kind: row.kind, name: row.name, ...decode(row.data), state: row.state, sort: row.sort, version: row.version });
const record = row => row && ({ ...row, snapshot: decode(row.snapshot), request: decode(row.request),
  ...(Object.hasOwn(row, 'confirmed') ? { confirmed: decode(row.confirmed), contact_log: decode(row.contact_log) } : { followups: decode(row.followups) }) });
const visitorRecord = row => {
  const r = record(row);
  if (!r) return null;
  delete r.owner; delete r.contact_log; delete r.followups;
  return r;
};
const id = prefix => `${prefix}-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${randomUUID().slice(0,8).toUpperCase()}`;

export class Service {
  constructor(db) { this.db = db; }
  content(id, published = true) {
    const row = this.db.prepare('SELECT * FROM content WHERE id=?').get(id);
    requireValue(row && (!published || row.state === 'published'), '内容已下架或不存在', 404, 'CONTENT_UNAVAILABLE');
    return publicContent(row);
  }
  listContent({ kind, category, q = '' } = {}, admin = false) {
    const rows = this.db.prepare(`SELECT * FROM content ${admin ? '' : "WHERE state='published'"} ORDER BY sort,id`).all().map(publicContent);
    return rows.filter(r => (!kind || r.kind === kind) && (!category || (category==='instrument' ? Object.hasOwn(INSTRUMENT_CATEGORIES,r.category) : r.category === category)) && (!q || `${r.name} ${r.code || ''} ${r.series || ''}`.toLowerCase().includes(q.toLowerCase())));
  }
  saveContent(actor, data, existingId) {
    permit(actor, 'content');
    return transaction(this.db, () => {
      const prev = existingId ? this.content(existingId, false) : null;
      if (prev) requireValue(data.version === prev.version, '内容已被其他人员修改，请刷新后重试', 409, 'VERSION_CONFLICT');
      const kind = prev?.kind || data.kind;
      requireValue(['site','product','package','lesson','spot'].includes(kind), '内容类型无效');
      if(kind==='site' && !existingId)requireValue(!this.db.prepare("SELECT 1 FROM content WHERE kind='site'").get(),'首页与企业配置为单一站点，请维护现有配置');
      const name = text(data.name, '名称', 120);
      const state = data.state || 'draft';
      requireValue(['draft','published','archived'].includes(state), '发布状态无效');
      requireValue(typeof data.data === 'object' && data.data && !Array.isArray(data.data), '内容格式错误');
      requireValue(JSON.stringify(data.data).length <= 50000, '单条内容过大');
      const allowed = ['code','category','series','brand','description','images','specs','priceMode','price','priceNote',
        'itinerary','ageNote','durationNote','referenceParentPrice','referenceSinglePrice','included','excluded','materials',
        'meetingPoint','transfer','bookingNote','cancelNote','type','mediaId','rights','duration','audience','form','place',
        'courseTime','courseFee','address','opening','visitNote','phone','heroTitle','heroSubtitle','intro','notice',
        'privacy','serviceNote','bookingEnabled','isTest','highlight','latitude','longitude','coordinateVerified'];
      const detail = Object.fromEntries(allowed.filter(k => Object.hasOwn(data.data,k)).map(k => [k,data.data[k]]));
      requireValue(detail.isTest !== false, '本地开发环境内容必须标记为测试资料');
      detail.isTest = true;
      for (const [key, value] of Object.entries(detail)) {
        requireValue(value === null || ['string','number','boolean'].includes(typeof value) || Array.isArray(value), `${key}类型无效`);
        if (typeof value === 'string') requireValue(value.length <= 12000, `${key}过长`);
        if (typeof value === 'number') requireValue(Number.isFinite(value), `${key}数值无效`);
      }
      if (detail.phone) requireValue(/^[+\d][\d\s()-]{4,29}$/.test(detail.phone), '服务电话格式无效');
      if (kind === 'product') {
        requireValue(Object.hasOwn(PRODUCT_CATEGORIES,detail.category), '请选择有效的乐器品类或文创');
        requireValue(['inquiry','reference'].includes(detail.priceMode), '请选择参考价格或咨询报价');
        if (detail.priceMode === 'reference') requireValue(typeof detail.price === 'number' && detail.price >= 0 && detail.price <= 1e7, '参考价格无效');
        requireValue(Array.isArray(detail.specs) && detail.specs.length <= 50 && detail.specs.every(s => s && typeof s.name === 'string' && s.name.length <= 80 && typeof s.description === 'string' && s.description.length <= 3000 && (s.price == null || (typeof s.price === 'number' && Number.isFinite(s.price) && s.price >= 0 && s.price<=1e7)) && (s.images==null || (Array.isArray(s.images) && s.images.length<=12))), '规格格式无效');
      }
      if (detail.images || detail.specs?.some(s=>s.images?.length)) {
        detail.images=detail.images || [];
        requireValue(Array.isArray(detail.images) && detail.images.length <= 12, '图片最多12张');
        for (const image of [...detail.images,...(detail.specs || []).flatMap(s=>s.images || [])]) {
          requireValue(typeof image === 'string' && /^\/(assets\/[a-zA-Z0-9_.-]+|api\/media\/[a-zA-Z0-9-]+)$/.test(image), '请使用素材库或上传的图片');
          if (image.startsWith('/api/media/')) {
            const m = this.db.prepare('SELECT * FROM media WHERE id=?').get(image.split('/').at(-1));
            requireValue(m && m.mime.startsWith('image/'), '关联图片不存在');
          }
        }
      }
      if (kind === 'lesson' && detail.type === 'video' && state === 'published') {
        const media = this.db.prepare('SELECT * FROM media WHERE id=?').get(detail.mediaId || '');
        requireValue(media && media.mime.startsWith('video/'), '请先实际上传视频文件再发布');
        requireValue(media.rights.trim() && typeof detail.duration === 'number' && detail.duration > 0, '请登记视频权属和实际时长');
      }
      if (kind === 'spot' && (detail.latitude != null || detail.longitude != null)) {
        requireValue(detail.coordinateVerified === true && Number.isFinite(detail.latitude) && Number.isFinite(detail.longitude)
          && Math.abs(detail.latitude) <= 90 && Math.abs(detail.longitude) <= 180, '地图坐标须经过核实');
      }
      const key = existingId || randomUUID();
      const sort = number(data.sort ?? prev?.sort ?? 0, '排序', 0, 10000);
      if (prev) this.db.prepare('UPDATE content SET name=?,data=?,state=?,sort=?,version=version+1,updated_at=? WHERE id=?').run(name, JSON.stringify(detail), state, sort, now(), key);
      else this.db.prepare('INSERT INTO content VALUES (?,?,?,?,?,?,1,?,?)').run(key, kind, name, JSON.stringify(detail), state, sort, now(), now());
      audit(this.db, actor, prev ? 'content.update' : 'content.create', key, { from: prev?.state, to: state, version: (prev?.version || 0)+1 });
      return this.content(key, false);
    });
  }
  slots(publicOnly = false) {
    const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
    return this.db.prepare(`SELECT s.*,COALESCE((SELECT SUM(b.headcount) FROM bookings b WHERE b.slot_id=s.id AND b.state IN ('confirmed','completed','no_show')),0) AS confirmed_count FROM slots s ORDER BY s.date,s.start`).all()
      .filter(s => !publicOnly || (!s.paused && s.date >= today))
      .map(s => ({ ...s, package_ids: decode(s.package_ids),enrollment:decode(s.enrollment),
        occupied_count:s.external_count+s.confirmed_count,remaining:Math.max(0,s.capacity-s.external_count-s.confirmed_count) }));
  }
  enrollments() {
    const packages=new Map(this.listContent({kind:'package'}).map(p=>[p.id,p]));
    const enabled=this.listContent({kind:'site'})[0]?.bookingEnabled===true;
    return this.slots(true).filter(s=>s.enrollment.state==='published' && packages.has(s.enrollment.packageId))
      .map(s=>publicEnrollment(s,packages.get(s.enrollment.packageId),enabled));
  }
  enrollment(key) {
    const item=this.enrollments().find(s=>s.id===key);
    requireValue(item,'报名活动已下架、暂停或不存在',404,'ENROLLMENT_UNAVAILABLE');
    return item;
  }
  saveSlot(actor, data, slotId) {
    permit(actor,'reception');
    return transaction(this.db, () => {
      const prev = slotId ? this.slots().find(s => s.id === slotId) : null;
      if (slotId) requireValue(prev, '场次不存在',404);
      if (prev) requireValue(prev.version === data.version, '场次已修改，请刷新',409,'VERSION_CONFLICT');
      const date = futureDate(data.date), start = text(data.start,'开始时间',5), end = text(data.end,'结束时间',5);
      requireValue(/^([01]\d|2[0-3]):[0-5]\d$/.test(start) && /^([01]\d|2[0-3]):[0-5]\d$/.test(end) && start < end, '时间段无效');
      const capacity = number(data.capacity,'人数上限',1);
      const externalCount=number(data.externalCount ?? prev?.external_count ?? 0,'系统外已成团人数',0);
      requireValue(capacity >= externalCount+(prev?.confirmed_count || 0), '人数上限不能低于系统外人数与系统已确认人数之和',409,'CAPACITY_FULL');
      requireValue(Array.isArray(data.packageIds) && data.packageIds.length > 0, '请选择适用套餐');
      for (const pid of data.packageIds) requireValue(this.content(pid,false).kind === 'package', '关联套餐无效');
      const hasJoinApplications=prev && this.db.prepare("SELECT 1 FROM bookings WHERE json_extract(request,'$.enrollment.id')=? LIMIT 1").get(prev.id);
      if(prev?.confirmed_count>0 || hasJoinApplications)requireValue(date===prev.date && start===prev.start && end===prev.end && JSON.stringify([...data.packageIds].sort())===JSON.stringify([...prev.package_ids].sort()),'已有确认或报名记录的场次不能修改日期、时段或适用套餐，请建立新场次',409,'SLOT_HAS_BOOKINGS');
      const enrollment=enrollmentData(data.enrollment ?? prev?.enrollment);
      if(hasJoinApplications)requireValue(enrollment.packageId===prev.enrollment.packageId,'已有报名记录，不能更换跟团套餐，请建立新场次',409,'SLOT_HAS_BOOKINGS');
      if(enrollment.state==='published') {
        requireValue(enrollment.title && enrollment.meetingPoint,'发布报名活动须填写活动名称和集合地点');
        requireValue(data.packageIds.includes(enrollment.packageId),'跟团套餐须属于本场次适用套餐');
        requireValue(this.content(enrollment.packageId).kind==='package','跟团套餐须已发布');
        requireValue(externalCount+(prev?.confirmed_count || 0)>0,'请登记实际已成团人数，或先确认已有团体预约');
      }
      const note = text(data.note || '','接待说明',1500,true);
      const key = slotId || randomUUID();
      if (prev) this.db.prepare('UPDATE slots SET date=?,start=?,end=?,capacity=?,package_ids=?,paused=?,note=?,external_count=?,enrollment=?,version=version+1 WHERE id=?').run(date,start,end,capacity,JSON.stringify(data.packageIds),+!!data.paused,note,externalCount,JSON.stringify(enrollment),key);
      else this.db.prepare('INSERT INTO slots(id,date,start,end,capacity,package_ids,paused,note,external_count,enrollment) VALUES (?,?,?,?,?,?,?,?,?,?)').run(key,date,start,end,capacity,JSON.stringify(data.packageIds),+!!data.paused,note,externalCount,JSON.stringify(enrollment));
      audit(this.db,actor,'slot.save',key,{date,start,end,capacity,paused:!!data.paused,externalCount,
        previousExternalCount:prev?.external_count ?? 0,enrollmentState:enrollment.state,previousEnrollmentState:prev?.enrollment.state || 'draft',title:enrollment.title});
      return this.slots().find(s=>s.id===key);
    });
  }
  idempotent(visitor, route, key, body, fn) {
    requireValue(typeof key === 'string' && /^[a-zA-Z0-9_-]{8,100}$/.test(key), '缺少有效的重复提交保护编号');
    return transaction(this.db, () => {
      const fingerprint = digest(JSON.stringify(body));
      const old = this.db.prepare('SELECT * FROM idempotency WHERE owner=? AND route=? AND key=?').get(visitor.id,route,key);
      if (old) {
        requireValue(old.fingerprint === fingerprint, '重试内容已改变，请使用新的提交编号',409,'IDEMPOTENCY_CONFLICT');
        return decode(old.response);
      }
      const response = fn();
      this.db.prepare('INSERT INTO idempotency VALUES (?,?,?,?,?)').run(visitor.id,route,key,fingerprint,JSON.stringify(response));
      return response;
    });
  }
  bookingRequest(data, group = false) {
    const requested = { ...contact(data), date: futureDate(data.date), note: text(data.note || '','说明',1500,true), group };
    if (group) {
      requested.team = text(data.team,'团队名称',120);
      requested.total = number(data.total,'预计总人数',1);
      requireValue(requested.note.length > 0, '请填写团体需求说明');
    } else {
      requested.adults = number(data.adults,'成人数'); requested.children = number(data.children,'儿童数');
      requested.total = requested.adults + requested.children;
      requireValue(requested.total > 0 && requested.total <= 10000, '参加人数必须大于零');
    }
    requested.slotId = data.slotId || null;
    return requested;
  }
  createBooking(visitor, data, key) {
    return this.idempotent(visitor,'bookings',key,data,()=> {
      const requested = this.bookingRequest(data,data.group === true);
      if (data.enrollmentId) {
        const activity=this.enrollment(data.enrollmentId);
        requireValue(!requested.group && requested.date===activity.date && data.packageId===activity.packageId && requested.slotId===activity.id,'报名日期、时段及套餐必须与所选活动一致');
        requireValue(activity.canApply,'该活动暂不可报名',409,'ENROLLMENT_CLOSED');
        requireValue(requested.total<=activity.remaining,'本次报名人数超过当前剩余名额，请联系工作人员',409,'CAPACITY_FULL');
        requested.enrollment={...activity};
      }
      const pkg = requested.group && !data.packageId
        ? {id:'group-general',kind:'package',name:'团体研学需求（未指定套餐）',isTest:true}
        : this.content(data.packageId);
      requireValue(pkg.kind === 'package','请选择研学套餐');
      const site = this.listContent({kind:'site'})[0];
      requireValue(site?.bookingEnabled === true,'预约申请尚未开放，请联系工作人员',409,'BOOKING_CLOSED');
      if (requested.slotId) {
        const slot = this.slots(true).find(s=>s.id===requested.slotId);
        requireValue(slot && slot.date === requested.date && (pkg.id==='group-general' || slot.package_ids.includes(pkg.id)),'意向场次已暂停或不适用',409,'SLOT_UNAVAILABLE');
      }
      const key = id('HQ');
      this.db.prepare("INSERT INTO bookings(id,owner,snapshot,request,state,headcount,created_at,updated_at) VALUES (?,?,?,?,'pending',?,?,?)").run(key,visitor.id,JSON.stringify(pkg),JSON.stringify(requested),requested.total,now(),now());
      return { id:key, state:'pending', message:'预约申请已提交，工作人员确认后生效' };
    });
  }
  myBookings(visitor) { return this.db.prepare('SELECT * FROM bookings WHERE owner=? ORDER BY created_at DESC').all(visitor.id).map(visitorRecord); }
  getBooking(key, visitor, admin = false) {
    const row = this.db.prepare('SELECT * FROM bookings WHERE id=?').get(key);
    requireValue(row && (admin || row.owner === visitor.id),'预约不存在或无权访问',404,'NOT_FOUND');
    const result = admin ? record(row) : visitorRecord(row);
    result.changes = this.db.prepare('SELECT * FROM changes WHERE booking_id=? ORDER BY created_at DESC').all(key).map(c=>({...c,data:decode(c.data),result:decode(c.result)}));
    return result;
  }
  withdraw(visitor, key, data) {
    return transaction(this.db,()=> {
      const row = this.getBooking(key,visitor);
      requireValue(row.state === 'pending','仅待确认申请可以直接撤回',409);
      this.db.prepare("UPDATE bookings SET state='cancelled',public_note=?,updated_at=?,version=version+1 WHERE id=?").run(text(data.reason,'撤回原因',500),now(),key);
      audit(this.db,visitor,'booking.withdraw',key);
      return this.getBooking(key,visitor);
    });
  }
  requestChange(visitor, key, data) {
    return transaction(this.db,()=> {
      const row = this.getBooking(key,visitor);
      requireValue(row.state === 'confirmed','只有已确认预约可以申请变更',409);
      requireValue(!row.changes.some(c=>c.state==='pending'),'已有待处理变更，请等待工作人员处理',409);
      requireValue(['cancel','reschedule'].includes(data.type),'变更类型无效');
      const payload = { reason:text(data.reason,'变更原因',800) };
      if (data.type==='reschedule') {
        payload.date = futureDate(data.date);
        if (row.request.group) payload.total = number(data.total,'预计人数',1);
        else { payload.adults=number(data.adults,'成人数'); payload.children=number(data.children,'儿童数'); payload.total=payload.adults+payload.children; requireValue(payload.total>0,'人数必须大于零'); }
      }
      const changeId = randomUUID();
      this.db.prepare('INSERT INTO changes(id,booking_id,type,data,created_at) VALUES (?,?,?,?,?)').run(changeId,key,data.type,JSON.stringify(payload),now());
      audit(this.db,visitor,'booking.change.request',key,{changeId,type:data.type});
      return this.getBooking(key,visitor);
    });
  }
  validateAssignee(key) {
    if (!key) return null;
    const account = this.db.prepare('SELECT * FROM accounts WHERE id=? AND active=1').get(key);
    requireValue(account && decode(account.roles).some(r=>['admin','reception'].includes(r)), '负责人须为有效的接待人员');
    return key;
  }
  capacity(slotId, packageId, count, excludedBooking) {
    const slot = this.slots().find(s=>s.id===slotId);
    requireValue(slot && !slot.paused && (packageId==='group-general' || slot.package_ids.includes(packageId)),'场次不可用或不适用',409,'SLOT_UNAVAILABLE');
    futureDate(slot.date);
    const used = this.db.prepare("SELECT COALESCE(SUM(headcount),0) AS n FROM bookings WHERE slot_id=? AND state IN ('confirmed','completed','no_show') AND id<>?").get(slotId,excludedBooking).n;
    requireValue(slot.external_count+used+count <= slot.capacity,'该场次剩余容量不足，原安排未改变',409,'CAPACITY_FULL');
    return slot;
  }
  handleBooking(actor, key, data) {
    permit(actor,'reception');
    return transaction(this.db,()=> {
      const row = this.getBooking(key,null,true);
      requireValue(data.version===row.version,'预约已由其他人员处理，请刷新',409,'VERSION_CONFLICT');
      const note = text(data.note || '','处理说明',1500,true);
      const actions = ['assign','followup','confirm','reject','arrive','complete','cancel','no_show','change_approve','change_reject'];
      requireValue(actions.includes(data.action),'操作无效');
      let state=row.state, slotId=row.slot_id, headcount=row.headcount, confirmed=row.confirmed, arrived=row.arrived_at;
      let assignee=row.assignee;
      if (data.action==='assign') assignee=this.validateAssignee(data.assignee);
      if (data.action==='followup') requireValue(note,'请填写联系情况');
      if (data.action==='confirm') {
        requireValue(state==='pending','仅待确认预约可确认',409);
        if(row.request.enrollment)requireValue(data.slotId===row.request.enrollment.id,'跟团申请须确认到游客所选活动场次；其他安排请联系游客另行申请',409,'ENROLLMENT_SLOT_MISMATCH');
        requireValue(note,'请填写已联系游客的确认安排说明');
        assignee=this.validateAssignee(data.assignee || assignee || actor.id);
        const slot=this.capacity(data.slotId,row.snapshot.id,row.headcount,key);
        state='confirmed'; slotId=slot.id;
        confirmed={ date:slot.date,start:slot.start,end:slot.end,total:headcount,adults:row.request.adults,children:row.request.children,arrangement:note };
      }
      if (data.action==='reject') { requireValue(state==='pending' && note,'仅待确认申请可拒绝，需说明原因',409); state='rejected'; }
      if (data.action==='arrive') { requireValue(state==='confirmed' && !arrived,'仅已确认且未登记到访的预约可到访',409); arrived=now(); }
      if (data.action==='complete') { requireValue(state==='confirmed' && arrived,'先登记到访再完成接待',409); state='completed'; }
      if (data.action==='no_show') { requireValue(state==='confirmed' && !arrived && note,'未到访登记须为已确认且未到访预约并填写说明',409); state='no_show'; }
      if (data.action==='cancel') { requireValue(state==='confirmed' && note,'仅已确认预约可人工取消，需说明原因',409); state='cancelled'; }
      if (data.action.startsWith('change_')) {
        requireValue(state==='confirmed','预约状态已改变，无法处理变更',409);
        const change=this.db.prepare("SELECT * FROM changes WHERE booking_id=? AND state='pending' AND id=?").get(key,data.changeId);
        requireValue(change && note,'变更不存在或缺少处理说明',409);
        const request=decode(change.data);
        if (data.action==='change_approve') {
          if (change.type==='cancel') state='cancelled';
          else {
            const slot=this.capacity(data.slotId,row.snapshot.id,request.total,key);
            requireValue(slot.date===request.date,'确认场次日期须与变更申请一致');
            headcount=request.total; slotId=slot.id;
            confirmed={...confirmed,...request,date:slot.date,start:slot.start,end:slot.end,arrangement:note};
          }
        }
        this.db.prepare('UPDATE changes SET state=?,result=?,handled_at=? WHERE id=?').run(data.action==='change_approve'?'approved':'rejected',JSON.stringify({note,before:row.confirmed,after:confirmed,actor:actor.id}),now(),change.id);
      }
      const log=[...row.contact_log,{actor:actor.id,at:now(),action:data.action,note}];
      const publicNote=['followup','assign'].includes(data.action)?row.public_note:note || row.public_note;
      this.db.prepare('UPDATE bookings SET state=?,slot_id=?,headcount=?,confirmed=?,assignee=?,contact_log=?,public_note=?,arrived_at=?,updated_at=?,version=version+1 WHERE id=?').run(state,slotId,headcount,confirmed?JSON.stringify(confirmed):null,assignee,JSON.stringify(log),publicNote,arrived,now(),key);
      if (['cancelled','completed','no_show'].includes(state)) this.db.prepare("UPDATE changes SET state='rejected',result=?,handled_at=? WHERE booking_id=? AND state='pending'").run(JSON.stringify({note:'预约已结束或取消，变更不再适用'}),now(),key);
      audit(this.db,actor,`booking.${data.action}`,key,{before:{state:row.state,confirmed:row.confirmed},after:{state,confirmed},assignee});
      return this.getBooking(key,null,true);
    });
  }
  createConsultation(visitor,data,key) {
    return this.idempotent(visitor,'consultations',key,data,()=> {
      const request={...contact(data),message:text(data.message,'咨询内容',1500),source:text(data.source || '联系咨询','来源',120)};
      let snapshot=null;
      if (data.contentId) {
        const c=this.content(data.contentId);
        requireValue(['product','lesson','package','spot'].includes(c.kind),'咨询关联对象无效');
        const spec=data.spec || '';
        if (spec) requireValue(c.kind==='product' && c.specs?.some(s=>s.name===spec),'所选规格不存在');
        snapshot={id:c.id,name:c.name,code:c.code || '',category:c.category || '',spec,version:c.version};
      }
      const key=id('ZX');
      this.db.prepare("INSERT INTO consultations(id,owner,snapshot,request,state,created_at,updated_at) VALUES (?,?,?,?,'pending',?,?)").run(key,visitor.id,JSON.stringify(snapshot),JSON.stringify(request),now(),now());
      return {id:key,state:'pending',message:'咨询已提交，工作人员将与您联系'};
    });
  }
  myConsultations(visitor) { return this.db.prepare('SELECT * FROM consultations WHERE owner=? ORDER BY created_at DESC').all(visitor.id).map(visitorRecord); }
  getConsultation(key,visitor,admin=false) {
    const row=this.db.prepare('SELECT * FROM consultations WHERE id=?').get(key);
    requireValue(row && (admin || row.owner===visitor.id),'咨询不存在或无权访问',404,'NOT_FOUND');
    return admin?record(row):visitorRecord(row);
  }
  handleConsultation(actor,key,data) {
    permit(actor,'reception');
    return transaction(this.db,()=> {
      const row=this.getConsultation(key,null,true);
      requireValue(row.version===data.version,'咨询已更新，请刷新',409,'VERSION_CONFLICT');
      requireValue(['assign','followup','close'].includes(data.action),'操作无效');
      requireValue(row.state!=='closed','咨询已结束',409);
      const assignee=data.action==='assign'?this.validateAssignee(data.assignee):row.assignee || actor.id;
      const note=text(data.note || '','跟进或结果说明',1500,data.action==='assign');
      const state=data.action==='close'?'closed':data.action==='followup'?'following':row.state;
      const log=[...row.followups,{at:now(),actor:actor.id,note,action:data.action}];
      this.db.prepare('UPDATE consultations SET state=?,assignee=?,followups=?,public_note=?,version=version+1,updated_at=? WHERE id=?').run(state,assignee,JSON.stringify(log),data.action==='close'?note:row.public_note,now(),key);
      audit(this.db,actor,`consultation.${data.action}`,key,{state,assignee});
      return this.getConsultation(key,null,true);
    });
  }
  adminRecords(actor,kind,filter={}) {
    permit(actor,'reception');
    const table=kind==='bookings'?'bookings':'consultations';
    return this.db.prepare(`SELECT * FROM ${table} ORDER BY created_at DESC`).all().map(record)
      .filter(r=>(!filter.state || r.state===filter.state) && (!filter.unassigned || !r.assignee)
        && (!filter.enrollment || !!r.request.enrollment)
        && (!filter.q || `${r.id} ${r.request.contactName} ${r.request.phone} ${r.request.team || ''} ${r.request.enrollment?.title || ''}`.includes(filter.q)));
  }
}
