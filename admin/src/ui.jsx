import React, {useEffect,useState} from 'react';
import {api} from './api';
export function Icon({name,size=20}) {
  const paths={home:'M3 10l9-7 9 7v11h-6v-7H9v7H3z',content:'M5 3h14v18H5z M8 7h8 M8 11h8 M8 15h5',slots:'M3 5h18v16H3z M7 3v4 M17 3v4 M3 10h18',bookings:'M4 5h16v16H4z M8 3v4 M16 3v4 M8 13l3 3 5-6',consultations:'M3 4h18v13H9l-6 4z M7 9h10 M7 12h7',media:'M3 4h18v16H3z M3 16l6-6 5 5 3-3 4 4 M16 8h.01',accounts:'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M4 21v-3a8 8 0 0 1 16 0v3z',audit:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M12 7v5l4 3',close:'M5 5l14 14 M19 5L5 19',refresh:'M20 11a8 8 0 1 0-2 6 M20 3v8h-8',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',logout:'M9 3H3v18h6 M13 12h8 M17 8l4 4-4 4'};
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.content}/></svg>;
}
export function Field({label,children,hint}) {return <label className="field"><span>{label}</span>{children}{hint?<small>{hint}</small>:null}</label>;}
export function ErrorBox({error}) {return error?<div className="error" role="alert">{error}</div>:null;}
export function Empty({children='暂无记录'}) {return <div className="empty">{children}</div>;}
export function Drawer({title,onClose,children}) {useEffect(()=>{const f=e=>{if(e.key==='Escape')onClose();};document.addEventListener('keydown',f);return()=>document.removeEventListener('keydown',f);},[onClose]);return <aside className="drawer" role="dialog" aria-modal="false" aria-label={title}><div className="drawer-heading"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="关闭详情"><Icon name="close"/></button></div>{children}</aside>;}
export function useRemote(path) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[tick,setTick]=useState(0);
  useEffect(()=>{let alive=true;setLoading(true);setError('');api(path).then(r=>{if(alive)setData(r);}).catch(e=>{if(alive)setError(e.message);}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};},[path,tick]);
  return {data,error,loading,refresh:()=>setTick(x=>x+1)};
}
export function Status({state,labels}) {return <span className={`status ${state}`}>{labels[state] || state}</span>;}
export function Loading({loading}) {return loading?<div className="loading" role="status">正在读取…</div>:null;}
