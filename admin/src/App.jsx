import React,{useEffect,useState} from 'react';
import {api,post} from './api';
import {Field,Icon,ErrorBox,useRemote} from './ui';
import Operations,{Slots} from './Operations';
import Content from './Content';
import Media from './Media';
import Accounts,{Audit} from './Accounts';
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
  return <main className="login"><section className="login-brand"><img src="/assets/yorray-logo.png" alt="YorRay"/><h1>黄桥乐器文化产业园</h1><p>产品与内容维护 · 研学接待 · 客户咨询</p></section><section className="login-form"><h2>工作人员登录</h2><p>内容运营与接待管理</p><form onSubmit={submit}><ErrorBox error={error}/><Field label="账号"><input autoComplete="username" required value={username} onChange={e=>setUsername(e.target.value)}/></Field><Field label="密码"><input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></Field><button className="full" disabled={busy}>{busy?'正在验证…':'登录后台'}</button></form><small>请使用本人账号。游客资料与内容维护按岗位权限分别管理。</small></section></main>;
}
function Overview({onNavigate,user}) {
  const r=useRemote('overview');
  return <><ErrorBox error={r.error}/>{r.error?<button className="secondary" onClick={r.refresh}>重新读取工作台</button>:null}<section className="overview-band"><div><span>内容记录</span><strong>{r.data?.contentCount??'—'}</strong><small>含草稿和已发布资料</small></div>{r.data?.pendingBookings!==undefined?<><div><span>待确认预约</span><strong>{r.data.pendingBookings}</strong><button className="text-button" onClick={()=>onNavigate('bookings')}>查看申请</button></div><div><span>未结束咨询</span><strong>{r.data.pendingConsultations}</strong><button className="text-button" onClick={()=>onNavigate('consultations')}>处理咨询</button></div><div><span>今日已确认接待</span><strong>{r.data.todayBookings}</strong><small>以人工确认的日期为准</small></div></>:null}</section><section className="work-guide"><h2>日常运营指引</h2><p>先维护并发布内容，再配置接待场次。游客提交申请后，工作人员记录联系情况、选择场次并确认；到访后登记接待结果。申请提交不代表安排已确认。</p><div className="action-grid">{user.roles.some(r=>['admin','content'].includes(r))?<><button onClick={()=>onNavigate('content')}>维护资料</button><button className="secondary" onClick={()=>onNavigate('media')}>查看素材库</button></>:null}{user.roles.some(r=>['admin','reception'].includes(r))?<button className="secondary" onClick={()=>onNavigate('slots')}>配置接待场次</button>:null}</div><h3>内容发布与接待</h3><p>图片和视频可在内容维护时直接上传。乐器与文创通过咨询了解详情，研学安排由工作人员联系确认。</p></section></>;
}
