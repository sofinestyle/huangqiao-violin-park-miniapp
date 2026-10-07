import React,{useRef,useState} from 'react';
import {uploadFile} from './api';
import {Field,ErrorBox} from './ui';

// Embedded in the content form; never introduce a nested form or submit the parent.
export default function MediaUpload({type='image',onUploaded,onBusyChange=()=>{},disabled=false,label}) {
  const [file,setFile]=useState(null),[rights,setRights]=useState(''),[progress,setProgress]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState(''),[preview,setPreview]=useState(null);
  const input=useRef(null);
  const upload=async()=>{
    setError('');setSuccess('');
    if(!file){setError('请选择文件');return;}
    if(type==='video' && !rights.trim()){setError('请填写视频来源与使用授权');return;}
    if(file.size>64*1024*1024){setError('文件超过64MB上传上限');return;}
    setBusy(true);onBusyChange(true);setProgress(0);
    try{const media=await uploadFile(file,type==='video'?rights.trim():'',setProgress);onUploaded(media);setPreview(media);setSuccess(`已上传并关联：${media.filename}`);setFile(null);if(input.current)input.current.value='';}
    catch(e){setError(e.message);}
    finally{setBusy(false);onBusyChange(false);}
  };
  return <section className="inline-upload" aria-label={label || (type==='image'?'上传图片':'上传视频')}>
    <Field label={label || (type==='image'?'上传新图片':'上传新视频')} hint={type==='image'?'支持JPG、PNG，单个文件不超过64MB。':'支持MP4、WebM，单个文件不超过64MB；上传后预览并核对时长。'}><input ref={input} type="file" accept={type==='image'?'image/jpeg,image/png':'video/mp4,video/webm'} disabled={busy || disabled} onChange={e=>{setFile(e.target.files[0] || null);setSuccess('');}}/></Field>
    {type==='video'?<Field label="文件来源与使用授权"><textarea maxLength={800} value={rights} disabled={busy} placeholder="请说明文件来源及使用授权" onChange={e=>setRights(e.target.value)}/></Field>:null}
    <ErrorBox error={error}/>{busy?<><progress max={100} value={progress}/><small role="status">上传进度 {progress}%</small></>:null}{success?<p className="success" role="status">{success}</p>:null}
    <button type="button" className="secondary full" disabled={busy || disabled} onClick={upload}>{busy?'上传中…':type==='image'?'上传并添加图片':'上传并关联视频'}</button>
    {preview?.mime.startsWith('image/')?<img className="cover-preview" src={preview.previewUrl} alt="上传图片预览"/>:null}
    <small>保存内容前，文件仅存入素材库；草稿不会对外展示。</small>
  </section>;
}
