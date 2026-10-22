import settings from './environment-settings';
import target from './build-target';

export type EnvironmentName = 'development' | 'staging' | 'production';
export interface Environment {
 name: EnvironmentName;
 apiBase: string;
 label: string;
 identityMode: 'development' | 'wechat';
 showDebug: boolean;
}
let active: Environment | undefined;

// Resolve once per process: recompile, rather than navigation/storage, switches APIs.
export function getEnvironment(): Environment {
 if(active)return active;
 const version=wx.getAccountInfoSync().miniProgram.envVersion;
 if(!['develop','trial','release'].includes(version))throw new Error('未知微信运行版本，已禁止连接API');
 const productionTarget=target.environment==='production';
 if(version==='release'&&!productionTarget)throw new Error('Production尚未批准，当前版本禁止连接API');
 if(productionTarget&&version==='develop')throw new Error('正式候选仅允许体验或正式运行，不允许开发调试连接');
 const requested=version==='develop'?wx.getLaunchOptionsSync().query.miniEnvironment:undefined;
 const name:unknown=productionTarget?'production':version==='trial'?'staging':(requested || target.environment);
 if(name!=='development'&&name!=='staging'&&!(productionTarget&&name==='production'))throw new Error('环境配置无效，已禁止连接API');
 const config:{enabled:boolean;apiBase:string|null;label:string;identityMode:string}=settings[name];
 if(!config.enabled||!config.apiBase)throw new Error('目标环境未启用');
 if(name==='development'&&!/^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):[0-9]+$/.test(config.apiBase))throw new Error('Development仅允许本机API');
 if(name==='staging'&&!/^https:\/\/[a-z0-9.-]+\.app\.tcloudbase\.com$/.test(config.apiBase))throw new Error('Staging网关配置无效');
 if(name==='production'&&config.apiBase!=='https://admin.yorray.com')throw new Error('正式API必须使用已核定自有域名');
 active=Object.freeze({name,apiBase:config.apiBase,label:config.label,identityMode:config.identityMode as 'development'|'wechat',showDebug:version==='develop'});
 return active;
}
export function visitorTokenKey(): string {return 'hq-visitor-token:'+getEnvironment().name;}
export function hasVisitorIdentity(): boolean {try{return !!wx.getStorageSync(visitorTokenKey());}catch{return false;}}
