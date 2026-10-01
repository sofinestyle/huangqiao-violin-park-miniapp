import React,{useState} from 'react';
import {post,put} from './api';
import {Field,Drawer,ErrorBox,Empty,useRemote} from './ui';
const roles={admin:'系统管理员',content:'内容维护',reception:'接待 / 客服'};
export default function Accounts() {
  const remote=useRemote('accounts');const [editing,setEditing]=useState(null);
  return <><div className="toolbar"><p>每位工作人员使用独立账号；导出权限需单独授权。</p><button onClick={()=>setEditing({username:'',password:'',roles:['content'],active:true,canExport:false})}>新增账号</button></div><ErrorBox error={remote.error}/><div className="table-region"><table><thead><tr><th>账号</th><th>角色</th><th>状态</th><th>名单导出</th><th>操作</th></tr></thead><tbody>{remote.data?.map(a=><tr key={a.id}><td>{a.username}</td><td>{a.roles.map(r=>roles[r]).join('、')}</td><td>{a.active?'启用':'停用'}</td><td>{a.canExport?'已授权':'未授权'}</td><td><button className="text-button" onClick={()=>setEditing(a)}>管理</button></td></tr>)}</tbody></table></div>{editing?<AccountEditor key={editing.id || 'new'} value={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);remote.refresh();}}/>:null}</>;
}
function AccountEditor({value,onClose,onSaved}) {
  const [form,setForm]=useState({...value,password:''}),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const update=(k,v)=>setForm(f=>({...f,[k]:v}));
  const submit=async e=>{e.preventDefault();setBusy(true);try{await (form.id?put(`accounts/${form.id}`,form):post('accounts',form));onSaved();}catch(e){setError(e.message);}finally{setBusy(false);}};
  return <Drawer title={form.id?'工作人员账号':'新增工作人员'} onClose={onClose}><form onSubmit={submit}><ErrorBox error={error}/><Field label="账号名称"><input required disabled={!!form.id} pattern="[a-zA-Z0-9_-]{3,40}" value={form.username} onChange={e=>update('username',e.target.value)}/></Field><Field label={form.id?'重设密码（留空则保留）':'初始密码'} hint="至少12个字符；请通过公司批准的方式交付本人。"><input type="password" autoComplete="new-password" minLength={12} required={!form.id} value={form.password} onChange={e=>update('password',e.target.value)}/></Field><fieldset><legend>岗位权限</legend>{Object.entries(roles).map(([key,label])=><label className="check-row" key={key}><input type="checkbox" checked={form.roles.includes(key)} onChange={e=>update('roles',e.target.checked?[...form.roles,key]:form.roles.filter(r=>r!==key))}/>{label}</label>)}</fieldset><label className="check-row"><input type="checkbox" checked={form.active} onChange={e=>update('active',e.target.checked)}/>启用账号</label><label className="check-row"><input type="checkbox" checked={form.canExport} onChange={e=>update('canExport',e.target.checked)}/>单独授权名单导出</label><p className="muted">权限、密码或启用状态变更后，此账号已有会话将失效，需要重新登录。最后一个管理员不能被停用。</p><button className="full" disabled={busy}>保存账号</button></form></Drawer>;
}
export function Audit() {
  const remote=useRemote('audit');
  return <><div className="toolbar"><p>显示最近500条关键操作，记录操作者、时间和变更摘要。</p><button className="secondary" onClick={remote.refresh}>刷新</button></div><ErrorBox error={remote.error}/><div className="table-region"><table><thead><tr><th>时间</th><th>操作者</th><th>动作</th><th>对象</th><th>摘要</th></tr></thead><tbody>{remote.data?.map(a=><tr key={a.id}><td>{new Date(a.created_at).toLocaleString('zh-CN')}</td><td className="mono">{a.actor_name || a.actor}</td><td>{a.action}</td><td className="mono">{a.object}</td><td><details><summary>查看</summary><pre>{JSON.stringify(a.detail,null,2)}</pre></details></td></tr>)}</tbody></table>{!remote.data?.length?<Empty>暂无操作记录</Empty>:null}</div></>;
}
