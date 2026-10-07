import React,{useEffect,useRef,useState} from 'react';
import {api} from './api';
import './content-delete.css';
export default function ContentDeleteDialog({item,label,onClose,onDeleted}) {
 const ref=useRef(null),cancel=useRef(null),lock=useRef(false);
 const [check,setCheck]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let active=true;const trigger=document.activeElement;ref.current.showModal();cancel.current.focus();api(`content/${encodeURIComponent(item.id)}/delete-check`).then(r=>{if(active)setCheck(r);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;if(trigger?.isConnected)trigger.focus();};},[item.id]);
 const remove=async()=>{if(lock.current||!check?.allowed)return;lock.current=true;setBusy(true);try{await api(`content/${encodeURIComponent(item.id)}`,{method:'DELETE',body:JSON.stringify({version:check.version})});onDeleted();}catch(e){setError(e.message);setCheck(c=>({...c,allowed:false}));}finally{lock.current=false;setBusy(false);}};
 const blocked=!!error || check?.allowed===false;
 return <dialog ref={ref} className="content-delete-dialog" aria-labelledby="content-delete-title" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}><h2 id="content-delete-title">{blocked?'无法删除':'删除'}{label}“{check?.name||item.name}”{blocked?'':'？'}</h2>{error?<p role="alert">{error}</p>:!check?<p role="status">正在检查内容状态与业务引用…</p>:!check.allowed?<p role="alert">{check.message}</p>:<p>删除后无法恢复。<br/>相关素材文件不会自动删除。</p>}<div className="content-delete-actions"><button ref={cancel} type="button" className="secondary" disabled={busy} onClick={onClose}>{blocked?'关闭':'取消'}</button>{check?.allowed&&!error?<button type="button" className="content-delete-danger" disabled={busy} onClick={remove}>{busy?'删除中…':'删除'}</button>:null}</div></dialog>;
}
