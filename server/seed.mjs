import { readFileSync } from 'node:fs';
import { now } from './db.mjs';
import { neutralDefault, migrateContentCopy } from './content-migration.mjs';
const catalog=JSON.parse(readFileSync(new URL('./test-catalog.json',import.meta.url),'utf8'));
export function seed(db) {
  const insert=db.prepare('INSERT OR IGNORE INTO content VALUES (?,?,?,?,?,?,1,?,?)');
  const add=(id,kind,name,data,sort=0,state='published')=>insert.run(id,kind,name,JSON.stringify({...neutralDefault(kind,data),isTest:true}),state,sort,now(),now());
  add('site','site','黄桥乐器文化产业园',{
    images:['/assets/yorray-logo.png','/assets/hero-violin.jpg'],heroTitle:'一把琴的旅程',heroSubtitle:'从这里出发',
    intro:'江苏黄桥乐器文化产业园投资发展有限公司，深耕提琴制造与乐器文化产业，建设集乐器博览、工业研学、文创开发、提琴产销与艺术教学于一体的文化产业园区。从一块云杉到一把成琴，从城市客厅到智能工坊，在这里读懂一把琴的诞生，也把黄桥的琴音带回家。',
    notice:'本地测试环境：产品、课程与预约资料仅用于开发验证，不用于真实接待。',
    bookingEnabled:true,phone:'',address:'',
    privacy:'本地开发测试说明：浏览公开内容无需登录。提交预约或咨询时，保存测试身份、联系人、手机号、意向日期、人数和必要说明，用于验证接待及咨询流程。请勿填写真实儿童身份信息。测试服务运行在本机，接待与管理员按权限访问。正式数据保留期限、修改删除渠道和隐私文本待公司审核，本说明不能用于正式上线。',
    serviceNote:'预约申请经工作人员人工确认后生效。本期不提供线上购买、支付或退款。票型、优惠、提前期、场次容量及正式联系方式由公司核定后配置。'
  });
  catalog.fiddles.forEach((v,i)=>add(`violin-${v.model}`,'product',v.model,{
    code:v.model,category:'violin',series:v.lvl,brand:'YorRay',priceMode:'inquiry',
    description:`${v.grade}\n${v.spec.map(([k,val])=>`${k}：${val}`).join('\n')}\n配套：${v.gift}\n以上为原展示稿测试资料，正式规格由管理员维护。`,
    images:['/assets/hero-violin.jpg'],specs:['4/4','3/4','1/2','1/4','1/8'].map(name=>({name,description:'测试规格；图片和参数需后续按真实规格维护'}))
  },10+i));
  catalog.shops.forEach((g,i)=>add(`gift-${i+1}`,'product',g.name,{
    code:`WC-${String(i+1).padStart(3,'0')}`,category:'gift',series:g.c,priceMode:g.p>0?'reference':'inquiry',price:g.p || null,
    description:`${g.c} · 原展示稿测试资料。正式图片、材料与配套信息由管理员维护。`,
    images:['/assets/wenchuang.jpg'],specs:[{name:'默认规格',description:'测试展示规格'}],priceNote:'测试参考价，不支持线上购买'
  },30+i));
  const packages=[
    ['琴韵初体验','5岁以上','2小时',118,88,'城市客厅四馆；尤克里里组装彩绘约60分钟，作品带走。','workshop.jpg'],
    ['提琴匠心深度游','6岁以上','3.5小时',158,118,'城市客厅；产业园生产讲解＋观摩制琴；绿岛喷涂；尤克里里。','green.jpg'],
    ['制琴工坊探秘','6岁以上','3小时',138,98,'产业园全流程＋观摩；绿岛喷涂；尤克里里。','industry.jpg'],
    ['提琴文化艺术营','5岁以上','2小时',118,88,'名琴故事约30分钟；提琴科普；提琴干花制作约60分钟。','city.jpg'],
    ['小小制琴师·工序体验营','7岁以上','3小时',128,88,'三地点；制琴工序二选一；琴码钥匙扣带走。','workshop.jpg']
  ];
  packages.forEach(([name,age,duration,parent,single,core,img],i)=>add(`package-${i+1}`,'package',name,{
    code:`0${i+1}`,ageNote:`原稿适合${age}，不作为自动报名门槛`,durationNote:`原稿${duration}`,referenceParentPrice:parent,referenceSinglePrice:single,
    description:core,itinerary:core,images:[`/assets/${img}`],highlight:i<2,
    bookingNote:'原稿个人提前3天、团队提前1周；计算口径尚待确认，本地测试不自动拦截。票型与优惠尚未核定，本次仅登记人数和意向，由人工确认。',
    cancelNote:'待确认申请可撤回；已确认安排的取消、改期和人数变更需申请并经工作人员处理。',
    materials:'作品和材料数量待核定',meetingPoint:'集合地点待核定',transfer:'转场方式及交通费用待核定',
    included:'原稿列示项目供复核，包含范围需公司确认',excluded:'未核定费用不自动计价'
  },60+i));
  const spots=[['城市客厅','city.jpg',['c1.jpg','c2.jpg','c3.jpg','c4.jpg'],'数字沙盘、乐器博览馆、路演厅及古琴馆。'],
    ['音乐生态湖','lake.jpg',['l1.jpg','l2.jpg','l3.jpg'],'音乐文化与园区环境。喷泉、音乐会和免费范围需核定。'],
    ['产业园·中小企业集聚区','industry.jpg',['i1.jpg','i2.jpg','i3.jpg','i4.jpg'],'真实生产与制琴工坊。可观摩项目需接待人员确认。'],
    ['绿岛·智能环保表面处理中心','green.jpg',['g1.jpg','g2.jpg','g3.jpg','g4.jpg'],'制琴工艺与表面处理场景。开放安排需核定。']];
  spots.forEach(([name,img,gallery,description],i)=>add(`spot-${i+1}`,'spot',name,{description,images:[img,...gallery].map(x=>`/assets/${x}`),opening:'开放安排尚待核定，请先咨询',address:'',visitNote:'测试点位资料；不填入未经确认的地址或坐标'},80+i));
  catalog.videos.forEach((v,i)=>add(`lesson-${i+1}`,'lesson',v.t,{type:'video',category:v.lv,description:'原展示稿教学标题，仅作草稿；上传可用视频并登记权属、实际时长后发布。',images:['/assets/hero-violin.jpg'],mediaId:'',rights:''},100+i,'draft'));
  migrateContentCopy(db);
}
