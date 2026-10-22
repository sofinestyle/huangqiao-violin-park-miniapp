import {requireValue} from './security.mjs';
import {timingSafeEqual} from 'node:crypto';

// An entry-point guard for ordinary legacy clients, not client identity.
// Forwarded/client environment headers cannot bypass it. CloudBase Host
// preservation must be verified before a future production deployment.
export function canonicalHostMatches(req,adminOrigin) {
 let authority;try{const origin=new URL(adminOrigin);if(origin.protocol==='https:'&&origin.origin===adminOrigin)authority=origin.host.toLowerCase();}catch{}
 return !!(authority&&typeof req.headers.host==='string'&&req.headers.host.toLowerCase()===authority);
}
export function canonicalEntryMatches(req,{adminOrigin,gatewayToken}) {
 const supplied=req.headers['x-hq-gateway-token'];
 return canonicalHostMatches(req,adminOrigin)&&typeof gatewayToken==='string'&&/^[a-f0-9]{64}$/.test(gatewayToken)&&typeof supplied==='string'&&/^[a-f0-9]{64}$/.test(supplied)&&timingSafeEqual(Buffer.from(supplied),Buffer.from(gatewayToken));
}
export function checkProductionEntry(req,path,{environment,adminOrigin,gatewayToken}) {
 if(environment!=='production'||!path.startsWith('/api/')||(path==='/api/health'&&req.method==='GET'))return;
 requireValue(canonicalEntryMatches(req,{adminOrigin,gatewayToken}),
  '旧测试入口不可访问正式API，请使用最新正式版本',403,'PRODUCTION_ENTRY_REQUIRED');
}
