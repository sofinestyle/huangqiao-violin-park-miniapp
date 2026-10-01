import React,{useState} from 'react';
import {ErrorBox,Empty,useRemote,Loading} from './ui';
const states={draft:'草稿',published:'已发布',archived:'已下架'};
export default function Media() {
  const remote=useRemote('media');const [preview,setPreview]=useState(null),[error,setError]=useState('');
  return <><div className="toolbar"><p>图片和视频可在内容维护中直接上传。本页用于查找、预览与复用已有文件，上传文件不会自动发布。</p><button className="secondary" onClick={remote.refresh}>刷新素材</button></div>
    {preview?<section className="note-box"><h2>{preview.filename}</h2>{preview.mime.startsWith('video/')?<video key={preview.id} className="media-preview" controls src={`/api/admin/media/${preview.id}/file`} onError={()=>setError('媒体预览失败，请核对文件格式或重新上传')}/>:<img className="cover-preview" src={`/api/admin/media/${preview.id}/file`} alt={preview.filename}/>}<button className="text-button" onClick={()=>{setPreview(null);setError('');}}>关闭预览</button></section>:null}
    <ErrorBox error={error || remote.error}/><Loading loading={remote.loading}/><div className="table-region"><table><thead><tr><th>文件名</th><th>类型 / 大小</th><th>授权说明</th><th>关联内容</th><th>上传时间</th><th>操作</th></tr></thead><tbody>{remote.data?.map(m=><tr key={m.id}><td>{m.filename}</td><td>{m.mime}<small>{(m.size/1024/1024).toFixed(2)} MB</small></td><td>{m.rights}</td><td>{m.usedBy?.length?m.usedBy.map(c=><small key={c.id}>{c.name} · {states[c.state]}</small>):<span className="muted">尚未关联</span>}</td><td>{new Date(m.created_at).toLocaleString('zh-CN')}</td><td><button className="text-button" onClick={()=>{setPreview(m);setError('');}}>预览</button></td></tr>)}</tbody></table>{!remote.loading && !remote.data?.length?<Empty>尚无文件，请在内容维护中上传</Empty>:null}</div></>;
}
