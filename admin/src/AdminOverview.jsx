import React, {useEffect,useState} from 'react';
import {ErrorBox,useRemote} from './ui';
import {AdminIcon,MetricCard} from './AdminUI';

export default function AdminOverview({onNavigate,onCreate,user}) {
  const r=useRemote('overview');
  const [now,setNow]=useState(()=>new Date());
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(timer);},[]);
  const hour=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',hour:'numeric',hourCycle:'h23'}).format(now));
  const greeting=hour<6?'您好':hour<12?'上午好':hour<18?'下午好':'晚上好';
  const date=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric'}).format(now);
  const weekday=new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',weekday:'long'}).format(now);
  const operational=user.roles.some(role=>['admin','reception'].includes(role));
  const content=user.roles.some(role=>['admin','content'].includes(role));
  const hasTasks=r.data?.pendingBookings!==undefined && r.data?.pendingConsultations!==undefined;
  const total=hasTasks?r.data.pendingBookings+r.data.pendingConsultations:null;
  return <section className="admin-dashboard">
    <div className="admin-dashboard-heading"><div><h1>工作台</h1><h2>{greeting}，{user.username}</h2><p>{r.loading?'正在读取运营概况…':r.error?'运营概况暂未读取成功':total!==null?`当前有 ${total} 项预约与咨询待办`:'查看内容资料，开展日常维护'}</p></div><div className="admin-date"><time dateTime={new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(now)}>{date}</time><span>{weekday}</span></div></div>
    <ErrorBox error={r.error}/>{r.error?<button className="secondary admin-retry" onClick={r.refresh}>重新读取工作台</button>:null}
    <div className="admin-metrics">
      <MetricCard label="内容记录" value={r.data?.contentCount} description="含草稿和已发布资料" icon="content" loading={r.loading}/>
      <MetricCard label="待确认预约" value={r.data?.pendingBookings} description={operational?'等待人工确认':'当前岗位无接待数据权限'} icon="slots" loading={r.loading} attention={r.data?.pendingBookings>0} onAction={operational?()=>onNavigate('bookings'):undefined} action="查看申请"/>
      <MetricCard label="未结束咨询" value={r.data?.pendingConsultations} description={operational?'尚未关闭的咨询':'当前岗位无接待数据权限'} icon="consultations" loading={r.loading} onAction={operational?()=>onNavigate('consultations'):undefined} action="处理咨询"/>
      <MetricCard label="今日已确认接待" value={r.data?.todayBookings} description={operational?'以人工确认的日期为准':'当前岗位无接待数据权限'} icon="accounts" loading={r.loading}/>
    </div>
    <div className="admin-workspace-grid">
      <section className="admin-panel admin-tasks"><div className="admin-panel-heading"><h2>待办事项</h2><span>优先处理预约与咨询</span></div>
        {operational?<div className="admin-task-list">
          {[['bookings','待确认研学预约','等待工作人员联系并确认',r.data?.pendingBookings],['consultations','未结束咨询','查看跟进情况，及时处理',r.data?.pendingConsultations]].map(([key,label,hint,count])=><button key={key} className="admin-task" onClick={()=>onNavigate(key)}><span className={`admin-task-dot ${count>0?'has-tasks':''}`} aria-hidden="true"/><span className="admin-task-copy"><strong>{label}</strong><small>{hint}</small></span><span className={`admin-task-count ${count>0?'has-tasks':''}`}>{r.loading?'读取中':count===undefined?'暂不可用':`${count} 项`}</span><AdminIcon name="chevron" size={16}/></button>)}
        </div>:<p className="admin-no-tasks">当前岗位可维护内容，接待与咨询待办按岗位权限展示。</p>}
        <p className="admin-task-note">申请提交不代表安排已确认。</p>
      </section>
      <section className="admin-panel"><div className="admin-panel-heading"><h2>快捷操作</h2><span>常用维护入口</span></div><div className="admin-shortcuts">
        {content?<><button onClick={()=>onCreate('instrument')}><AdminIcon name="instrument" size={24}/><span>新增乐器<small>产品资料与规格</small></span><AdminIcon name="chevron" size={14}/></button><button onClick={()=>onCreate('gift')}><AdminIcon name="gift" size={24}/><span>新增文创<small>文创资料与图片</small></span><AdminIcon name="chevron" size={14}/></button></>:null}
        {operational?<button onClick={()=>onNavigate('slots')}><AdminIcon name="slots" size={24}/><span>配置研学场次<small>接待日期与安排</small></span><AdminIcon name="chevron" size={14}/></button>:null}
        {content?<button onClick={()=>onCreate('lesson')}><AdminIcon name="lesson" size={24}/><span>新增教学内容<small>图文、课程与视频</small></span><AdminIcon name="chevron" size={14}/></button>:null}
      </div></section>
    </div>
    <details className="admin-operating-help"><summary>日常运营指引</summary><div><p>先维护并发布内容，再配置接待场次。游客提交申请后，工作人员记录联系情况、选择场次并确认；到访后登记接待结果。申请提交不代表安排已确认。</p><h3>内容发布与接待</h3><p>图片和视频可在内容维护时直接上传。乐器与文创通过咨询了解详情，研学安排由工作人员联系确认。</p><div className="admin-help-links">{content?<><button className="admin-link" onClick={()=>onNavigate('content')}>维护资料<AdminIcon name="arrow" size={16}/></button><button className="admin-link" onClick={()=>onNavigate('media')}>查看素材库<AdminIcon name="arrow" size={16}/></button></>:null}{operational?<button className="admin-link" onClick={()=>onNavigate('slots')}>配置接待场次<AdminIcon name="arrow" size={16}/></button>:null}</div></div></details>
  </section>;
}
