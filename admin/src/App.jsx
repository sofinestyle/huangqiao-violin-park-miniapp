import React,{useEffect,useState} from 'react';
import {api,post} from './api';
import {Field,Icon,ErrorBox,useRemote} from './ui';
import Operations,{Slots} from './Operations';
import Content from './Content';
import Media from './Media';
import Accounts,{Audit} from './Accounts';
import './login.css';
const menu=[['home','工作台','all'],['content','内容维护','content'],['slots','场次管理','reception'],['bookings','研学预约','reception'],['consultations','咨询管理','reception'],['media','素材库','content'],['accounts','账号权限','admin'],['audit','操作记录','admin']];
export default function App() {
  const [user,setUser]=useState(null),[checking,setChecking]=useState(true),[page,setPage]=useState('home');
  useEffect(()=>{api('me').then(setUser).catch(()=>{}).finally(()=>setChecking(false));const expire=()=>setUser(null);window.addEventListener('hq-session-expired',expire);return()=>window.removeEventListener('hq-session-expired',expire);},[]);
  if(checking)return <main className="startup">正在连接管理服务…</main>;
  if(!user)return <Login onLogin={u=>{setUser(u);setPage('home');}}/>;
  const logout=async()=>{try{await post('logout',{});}finally{setUser(null);}};
  return <div className="shell"><aside className="sidebar"><div className="brand"><h1>园区管理</h1><p>黄桥乐器文化产业园</p></div><nav aria-label="后台导航">{menu.filter(([, ,role])=>role==='all' || user.roles.includes('admin') || user.roles.includes(role)).map(([key,label])=><button key={key} className={page===key?'selected':''} onClick={()=>setPage(key)}><Icon name={key}/><span>{label}</span></button>)}</nav><div className="sidebar-bottom">内容运营与接待管理</div></aside><header className="topbar"><span>{user.username}</span><button className="text-button" onClick={logout}><Icon name="logout"/>退出</button></header><main className="main"><div className="page-heading"><h1>{menu.find(m=>m[0]===page)?.[1]}</h1></div>{page==='home'?<Overview onNavigate={setPage} user={user}/>:null}{page==='content'?<Content/>:null}{page==='slots'?<Slots/>:null}{page==='bookings' || page==='consultations'?<Operations key={page} kind={page} user={user}/>:null}{page==='media'?<Media/>:null}{page==='accounts'?<Accounts/>:null}{page==='audit'?<Audit/>:null}</main></div>;
}
function Login({onLogin}) {
  const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{onLogin(await post('login',{username,password}));}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <main className="login login--refined">
    <section className="login-brand">
      <div className="login-brand-copy">
        <img src="/assets/yorray-logo.png" alt="YorRay"/>
        <h1>黄桥乐器文化产业园</h1>
        <p className="login-brand-motto">让世界听见黄桥的琴音</p>
        <p className="login-brand-services">产品与内容维护 · 研学接待 · 客户咨询</p>
      </div>
      <p className="login-brand-signature" aria-hidden="true">HUANGQIAO<br/>MUSICAL INSTRUMENTS<br/>CULTURAL PARK</p>
    </section>
    <section className="login-panel">
      <p className="login-panel-caption">内容运营 · 接待管理 · 系统后台</p>
      <div className="login-form">
        <h2>工作人员登录</h2><p>内容运营与接待管理</p>
        <form onSubmit={submit}>
          <ErrorBox error={error}/>
          <Field label="账号"><span className="login-input-shell"><Icon name="accounts" size={22}/><input autoComplete="username" placeholder="请输入账号" required value={username} onChange={e=>setUsername(e.target.value)}/></span></Field>
          <Field label="密码"><span className="login-input-shell"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg><input type="password" autoComplete="current-password" placeholder="请输入密码" required value={password} onChange={e=>setPassword(e.target.value)}/></span></Field>
          <button className="full" disabled={busy}><span>{busy?'正在验证…':'登录后台'}</span><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12h17M14 6l6 6-6 6"/></svg></button>
        </form>
        <small>请使用本人账号。游客资料与内容维护按岗位权限分别管理。</small>
      </div>
      <div className="login-panel-watermark" aria-hidden="true">
        <svg viewBox="0 0 320 320" fill="currentColor"><g transform="rotate(42 160 160)"><path d="M151 0h18v110c12 4 30 2 42 22 7 12 3 26-8 37-9 9-7 20 5 25 32 13 46 39 38 67-9 32-37 49-86 49s-77-17-86-49c-8-28 6-54 38-67 12-5 14-16 5-25-11-11-15-25-8-37 12-20 30-18 42-22z"/><path d="M156 0h2v300h-2zM162 0h2v300h-2z" fill="#faf8f4"/><path d="M129 211c-17 13 10 26-8 40M191 211c17 13-10 26 8 40" fill="none" stroke="#faf8f4" strokeWidth="5"/></g></svg>
        <p>MUSIC<br/>CONNECTS<br/>A BETTER LIFE</p>
      </div>
    </section>
  </main>;
}
function Overview({onNavigate,user}) {
  const r=useRemote('overview');
  return <><ErrorBox error={r.error}/>{r.error?<button className="secondary" onClick={r.refresh}>重新读取工作台</button>:null}<section className="overview-band"><div><span>内容记录</span><strong>{r.data?.contentCount??'—'}</strong><small>含草稿和已发布资料</small></div>{r.data?.pendingBookings!==undefined?<><div><span>待确认预约</span><strong>{r.data.pendingBookings}</strong><button className="text-button" onClick={()=>onNavigate('bookings')}>查看申请</button></div><div><span>未结束咨询</span><strong>{r.data.pendingConsultations}</strong><button className="text-button" onClick={()=>onNavigate('consultations')}>处理咨询</button></div><div><span>今日已确认接待</span><strong>{r.data.todayBookings}</strong><small>以人工确认的日期为准</small></div></>:null}</section><section className="work-guide"><h2>日常运营指引</h2><p>先维护并发布内容，再配置接待场次。游客提交申请后，工作人员记录联系情况、选择场次并确认；到访后登记接待结果。申请提交不代表安排已确认。</p><div className="action-grid">{user.roles.some(r=>['admin','content'].includes(r))?<><button onClick={()=>onNavigate('content')}>维护资料</button><button className="secondary" onClick={()=>onNavigate('media')}>查看素材库</button></>:null}{user.roles.some(r=>['admin','reception'].includes(r))?<button className="secondary" onClick={()=>onNavigate('slots')}>配置接待场次</button>:null}</div><h3>内容发布与接待</h3><p>图片和视频可在内容维护时直接上传。乐器与文创通过咨询了解详情，研学安排由工作人员联系确认。</p></section></>;
}
