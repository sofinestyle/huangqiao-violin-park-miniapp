import {requireValue} from './security.mjs';

// An entry-point guard for ordinary legacy clients, not client identity.
// Forwarded/client environment headers cannot bypass it. CloudBase Host
// preservation must be verified before a future production deployment.
export function checkProductionEntry(req,path,{environment,adminOrigin}) {
 if(environment!=='production'||!path.startsWith('/api/')||(path==='/api/health'&&req.method==='GET'))return;
 let authority;try{const origin=new URL(adminOrigin);if(origin.protocol==='https:'&&origin.origin===adminOrigin)authority=origin.host.toLowerCase();}catch{}
 requireValue(authority&&typeof req.headers.host==='string'&&req.headers.host.toLowerCase()===authority,
  '旧测试入口不可访问正式API，请使用最新正式版本',403,'PRODUCTION_ENTRY_REQUIRED');
}
