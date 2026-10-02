// Decode the frame at time zero without playing or altering the source video.
export function captureFirstFrame(src) {
  return new Promise((resolve,reject)=>{
    const video=document.createElement('video');
    video.preload='auto';video.muted=true;video.playsInline=true;
    let settled=false;
    const finish=(error,file)=>{
      if(settled)return;settled=true;clearTimeout(timer);
      video.onloadeddata=null;video.onerror=null;video.removeAttribute('src');video.load();
      error?reject(error):resolve(file);
    };
    const timer=setTimeout(()=>finish(new Error('视频首帧读取超时，请重试或手动上传封面')),20000);
    video.onerror=()=>finish(new Error('无法读取视频首帧，请检查视频格式或手动上传封面'));
    video.onloadeddata=()=>{
      try {
        if(!video.videoWidth || !video.videoHeight)throw new Error('视频没有可用画面，请手动上传封面');
        const canvas=document.createElement('canvas');
        const scale=Math.min(1,1280/Math.max(video.videoWidth,video.videoHeight));
        canvas.width=Math.max(1,Math.round(video.videoWidth*scale));
        canvas.height=Math.max(1,Math.round(video.videoHeight*scale));
        const context=canvas.getContext('2d');
        if(!context)throw new Error('无法生成封面，请手动上传图片');
        context.drawImage(video,0,0,canvas.width,canvas.height);
        canvas.toBlob(blob=>blob?finish(null,new File([blob],'video-first-frame.jpg',{type:'image/jpeg'})):finish(new Error('封面生成失败，请手动上传图片')),'image/jpeg',0.9);
      }catch(e){finish(e);}
    };
    video.src=src;video.load();
  });
}

export async function prepareVideoCover(form,{capture=captureFirstFrame,upload,rights}) {
  if(form.kind!=='lesson' || form.type!=='video' || !form.mediaId || form.images?.length)return null;
  const file=await capture(`/api/admin/media/${encodeURIComponent(form.mediaId)}/file`);
  return upload(file,rights || form.rights || '由已上传视频提取首帧，沿用源视频授权',()=>{});
}

export const durationText=value=>Number.isFinite(Number(value)) && Number(value)>0?Math.max(0.01,Number(value)).toFixed(2):'';
