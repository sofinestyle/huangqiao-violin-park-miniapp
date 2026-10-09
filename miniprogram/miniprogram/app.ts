import {getEnvironment} from './config';
App({
 globalData:{environment:'blocked',apiBase:'',environmentError:''},
 onLaunch(){try{const environment=getEnvironment();Object.assign(this.globalData,{environment:environment.name,apiBase:environment.apiBase});if(environment.showDebug)console.info('[Mini Program Environment]',environment.label,environment.apiBase);}catch(e){this.globalData.environmentError=e instanceof Error?e.message:'环境检查失败';console.error(this.globalData.environmentError);}}
});
