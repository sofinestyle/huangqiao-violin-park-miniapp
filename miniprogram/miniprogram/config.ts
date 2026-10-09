import settings from './environment-settings';
import target from './build-target';

export type EnvironmentName = 'development' | 'staging';
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
 if(version!=='develop'&&version!=='trial')throw new Error('Production尚未批准，当前版本禁止连接API');
 const requested=version==='develop'?wx.getLaunchOptionsSync().query.miniEnvironment:undefined;
 const name:unknown=version==='trial'?'staging':(requested || target.environment);
 if(name!=='development'&&name!=='staging')throw new Error('环境配置无效，已禁止连接API');
 const config=settings[name];
 if(!config.enabled||!config.apiBase)throw new Error('目标环境未启用');
 if(name==='development'&&!/^http:\/\/(127\.0\.0\.1|localhost|\[::1\]):[0-9]+$/.test(config.apiBase))throw new Error('Development仅允许本机API');
 if(name==='staging'&&!/^https:\/\/[a-z0-9.-]+\.app\.tcloudbase\.com$/.test(config.apiBase))throw new Error('Staging网关配置无效');
 active=Object.freeze({name,apiBase:config.apiBase,label:config.label,identityMode:config.identityMode as 'development'|'wechat',showDebug:version==='develop'});
 return active;
}
export function visitorTokenKey(): string {return 'hq-visitor-token:'+getEnvironment().name;}
export function hasVisitorIdentity(): boolean {try{return !!wx.getStorageSync(visitorTokenKey());}catch{return false;}}
