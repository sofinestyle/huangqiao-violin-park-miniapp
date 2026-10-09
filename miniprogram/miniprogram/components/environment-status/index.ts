import {getEnvironment} from '../../config';
Component({
 data:{visible:false,label:'',note:''},
 lifetimes:{attached(){
  try{const env=getEnvironment();this.setData({visible:env.showDebug,label:env.label,note:env.name==='development'?'本地开发数据库；切换请使用顶部编译模式。':'CloudBase Staging 数据；切换请使用顶部编译模式。'});}
  catch(e){let visible=false;try{visible=wx.getAccountInfoSync().miniProgram.envVersion==='develop';}catch{/* Unknown runtime keeps diagnostics hidden. */}this.setData({visible,label:'API 已阻止',note:e instanceof Error?e.message:'环境检查失败'});}
 }}
});
