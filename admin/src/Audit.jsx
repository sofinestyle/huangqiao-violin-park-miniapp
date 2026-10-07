import React,{useState} from 'react';
import {ErrorBox,Empty,useRemote,Loading,Icon} from './ui';
import {auditActionLabel} from './audit-actions.mjs';
import './admin-phase-2b.css';
const blank={from:'',to:'',actor:'',action:''};
export default function Audit(){
 const [draft,setDraft]=useState(blank),[filters,setFilters]=useState({}),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(50),[validation,setValidation]=useState('');
 const params=new URLSearchParams({page:String(page),pageSize:String(pageSize),...filters});
 const remote=useRemote(`audit?${params}`),options=useRemote('audit/options');
 const result=remote.data,items=result?.items || [],total=result?.total ?? 0,pages=Math.max(1,Math.ceil(total/pageSize));
 const apply=e=>{e.preventDefault();setValidation('');const next={};for(const key of ['actor','action'])if(draft[key])next[key]=draft[key];for(const key of ['from','to'])if(draft[key]){const date=new Date(draft[key]);if(!Number.isFinite(+date)){setValidation('请选择有效时间');return;}next[key]=date.toISOString();}if(next.from && next.to && next.from>next.to){setValidation('开始时间不能晚于结束时间');return;}setFilters(next);setPage(1);};
 const change=(key,value)=>setDraft(f=>({...f,[key]:value}));
 const refresh=()=>{remote.refresh();options.refresh();};
 return <section className="admin-management admin-audit-page">
  <div className="admin-management-header"><div><h1>操作记录</h1><p>查看后台关键操作及审计记录</p></div></div>
  <form className="admin-audit-filters" onSubmit={apply}>
   <label>开始时间<input aria-label="开始时间" type="datetime-local" step="1" value={draft.from} onChange={e=>change('from',e.target.value)}/></label>
   <label>结束时间<input aria-label="结束时间" type="datetime-local" step="1" value={draft.to} onChange={e=>change('to',e.target.value)}/></label>
   <label>操作人<select aria-label="操作人筛选" value={draft.actor} onChange={e=>change('actor',e.target.value)}><option value="">全部操作人</option>{options.data?.actors.map(a=><option key={a.id} value={a.id}>{a.name || a.id}</option>)}</select></label>
   <label>动作<select aria-label="动作筛选" value={draft.action} onChange={e=>change('action',e.target.value)}><option value="">全部动作</option>{options.data?.actions.map(action=><option key={action} value={action}>{auditActionLabel(action)}{auditActionLabel(action)!==action?` · ${action}`:''}</option>)}</select></label>
   <div className="admin-audit-filter-actions"><button disabled={remote.loading}>应用筛选</button><button type="button" className="secondary" onClick={()=>{setDraft(blank);setFilters({});setPage(1);setValidation('');}}>重置</button><button type="button" className="secondary" onClick={refresh}><Icon name="refresh"/>刷新</button></div>
  </form><p className="admin-management-note">时间范围包含起止时刻，按当前浏览器本地时间输入；最新记录在前。</p>
  <ErrorBox error={validation || remote.error || options.error}/><Loading loading={remote.loading}/>
  <div className="admin-management-list-heading"><h2>关键操作</h2><span>{remote.loading?'正在读取':remote.error?'读取失败':`${total} 条记录`}</span></div>
  <div className="table-region" role="region" aria-label="操作记录列表，可横向滚动" tabIndex={0} aria-busy={remote.loading}>
   {!remote.loading && !remote.error && !items.length?<Empty>暂无符合条件的操作记录</Empty>:<table><thead><tr><th>时间</th><th>操作者</th><th>动作</th><th>对象</th><th>摘要</th></tr></thead><tbody>{items.map(a=><tr key={a.id}><td>{new Date(a.created_at).toLocaleString('zh-CN')}</td><td className="admin-audit-actor">{a.actor_name || a.actor}</td><td className="admin-audit-action"><span>{auditActionLabel(a.action)}</span>{auditActionLabel(a.action)!==a.action?<small className="mono">{a.action}</small>:null}</td><td className="mono">{a.object}</td><td><details><summary>查看</summary><pre>{JSON.stringify(a.detail,null,2)}</pre></details></td></tr>)}</tbody></table>}
  </div>
  <div className="admin-audit-pagination"><span aria-live="polite">{remote.loading?'正在读取':remote.error?'读取失败':total && items.length?`${(page-1)*pageSize+1}—${(page-1)*pageSize+items.length} / ${total} 条`:`0 / ${total} 条`}</span><label>每页<select aria-label="每页记录数" value={pageSize} onChange={e=>{setPageSize(Number(e.target.value));setPage(1);}}>{[20,50,100].map(size=><option key={size} value={size}>{size}条</option>)}</select></label><button className="secondary" disabled={remote.loading || !!remote.error || page<=1} onClick={()=>setPage(p=>p-1)}>上一页</button><span>{page} / {pages}</span><button className="secondary" disabled={remote.loading || !!remote.error || page>=pages} onClick={()=>setPage(p=>p+1)}>下一页</button></div>
 </section>;
}
