import React, {useEffect, useRef, useState} from 'react';
import {Icon} from './ui';

// Presentation only. Existing navigation, account and business handlers are supplied by callers.
export function AdminIcon({name, size=20}) {
  const paths={
    arrow:'M5 12h14 M14 7l5 5-5 5',
    chevron:'M9 5l7 7-7 7',
    down:'M6 9l6 6 6-6',
    plus:'M12 5v14 M5 12h14',
    instrument:'M10 8l6-6 M14 4l6 6 M9 9c-2-2-5-1-5 2 0 2 2 2 2 4-4 0-5 5-2 7s7 0 7-3c2 0 2 2 4 2 3 0 4-3 2-5z M7 16l3 3',
    gift:'M3 8h18v4H3z M5 12v9h14v-9 M12 8v13 M12 8C5 8 5 2 8 2c3 0 4 6 4 6s1-6 4-6c3 0 3 6-4 6',
    lesson:'M5 3h10l4 4v14H5z M14 3v5h5 M9 12l5 3-5 3z'
  };
  return paths[name]?<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>:<Icon name={name} size={size}/>;
}

export function UserMenu({user,onLogout}) {
  const [open,setOpen]=useState(false);
  const root=useRef(null),trigger=useRef(null);
  useEffect(()=>{
    if(!open)return;
    const outside=e=>{if(!root.current?.contains(e.target))setOpen(false);};
    const escape=e=>{if(e.key==='Escape'){setOpen(false);trigger.current?.focus();}};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  return <div className="admin-user" ref={root} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
    <button ref={trigger} className="admin-user-trigger" aria-expanded={open} aria-controls="admin-account-actions" onClick={()=>setOpen(v=>!v)}>
      <span className="admin-avatar" aria-hidden="true">{user.username.slice(0,1).toUpperCase()}</span><span>{user.username}</span><AdminIcon name="down" size={14}/>
    </button>
    {open?<div className="admin-user-popover" id="admin-account-actions"><p>当前登录账户</p><strong>{user.username}</strong><button className="admin-logout" onClick={onLogout}><Icon name="logout"/>退出登录</button></div>:null}
  </div>;
}

export function MetricCard({label,value,description,icon,onAction,action,loading,attention=false}) {
  return <article className="admin-metric" aria-label={label} aria-busy={loading}>
    <span className={`admin-metric-icon ${attention?'is-attention':''}`}><AdminIcon name={icon} size={23}/></span>
    <div className="admin-metric-copy"><h2>{label}</h2><div className="admin-metric-value">{loading?<span className="admin-skeleton" aria-label="读取中"/>:value??'—'}{attention?<span className="admin-attention-dot" aria-label="有待办事项"/>:null}</div>
      {onAction?<button className="admin-link" onClick={onAction}>{action}<AdminIcon name="arrow" size={16}/></button>:<p>{description}</p>}
    </div>
  </article>;
}
