// Change only known generated default copy, never rewrite custom operator content or historical snapshots.
export function neutralDefault(kind,data) {
  const d=structuredClone(data);
  if(kind==='site') {
    if(d.notice==='本地测试环境：产品、课程与预约资料仅用于开发验证，不用于真实接待。')d.notice='';
    if(d.privacy==='本地开发测试说明：浏览公开内容无需登录。提交预约或咨询时，保存测试身份、联系人、手机号、意向日期、人数和必要说明，用于验证接待及咨询流程。请勿填写真实儿童身份信息。测试服务运行在本机，接待与管理员按权限访问。正式数据保留期限、修改删除渠道和隐私文本待公司审核，本说明不能用于正式上线。')d.privacy='浏览公开内容无需登录。提交预约或咨询时，我们保存联系人、联系电话、意向日期、参加人数及必要说明，用于处理您的申请和咨询。请仅填写办理服务所需的信息。如需查询、更正或删除已提交资料，请联系工作人员。';
    if(d.serviceNote==='预约申请经工作人员人工确认后生效。本期不提供线上购买、支付或退款。票型、优惠、提前期、场次容量及正式联系方式由公司核定后配置。')d.serviceNote='预约申请经工作人员人工确认后生效。乐器和文创提供产品展示与咨询，具体费用和服务安排请与工作人员联系确认。';
  }
  if(kind==='product') {
    d.description=d.description?.replace('\n以上为原展示稿测试资料，正式规格由管理员维护。','');
    if(d.description===`${d.series} · 原展示稿测试资料。正式图片、材料与配套信息由管理员维护。`)d.description=d.series;
    if(d.priceNote==='测试参考价，不支持线上购买')d.priceNote='参考价格，具体规格与报价请咨询工作人员';
    d.specs=d.specs?.map(s=>({...s,description:s.description==='测试规格；图片和参数需后续按真实规格维护' || s.description==='测试展示规格'?'':s.description}));
  }
  if(kind==='package') {
    if(/^原稿适合.+，不作为自动报名门槛$/.test(d.ageNote || ''))d.ageNote=d.ageNote.replace(/^原稿适合/,'适合').replace('，不作为自动报名门槛','');
    if(/^原稿\d/.test(d.durationNote || ''))d.durationNote=d.durationNote.replace(/^原稿/,'');
    if(d.bookingNote==='原稿个人提前3天、团队提前1周；计算口径尚待确认，本地测试不自动拦截。票型与优惠尚未核定，本次仅登记人数和意向，由人工确认。')d.bookingNote='请填写意向日期和实际参加人数。提交后由工作人员联系您，具体接待时间与安排经人工确认后生效。';
    const replacements={materials:['作品和材料数量待核定','作品和材料安排请咨询工作人员'],meetingPoint:['集合地点待核定','集合地点以工作人员确认为准'],transfer:['转场方式及交通费用待核定','转场安排请咨询工作人员'],included:['原稿列示项目供复核，包含范围需公司确认','具体包含项目请咨询工作人员'],excluded:['未核定费用不自动计价','其他费用请咨询工作人员']};
    for(const [key,[old,value]] of Object.entries(replacements))if(d[key]===old)d[key]=value;
  }
  if(kind==='spot' && d.visitNote==='测试点位资料；不填入未经确认的地址或坐标')d.visitNote='到访前请联系工作人员确认开放与接待安排。';
  if(kind==='lesson' && d.description==='原展示稿教学标题，仅作草稿；上传可用视频并登记权属、实际时长后发布。')d.description='';
  return d;
}
