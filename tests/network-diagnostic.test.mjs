import test from 'node:test';import assert from 'node:assert/strict';import ts from 'typescript';import vm from 'node:vm';import {readFileSync} from 'node:fs';
const module={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync('miniprogram/miniprogram/lib/network-diagnostic.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2015}}).outputText,{module,exports:module.exports});const {networkFailureMessage}=module.exports;
test('Trial diagnostics distinguish domain/TLS/timeout/transport failures without displaying raw data',()=>{
 for(const [reason,expected]of [['request:fail url not in domain list','DOMAIN_NOT_ALLOWED'],['request:fail certificate verify failed','TLS_CERTIFICATE_ERROR'],['request:fail timeout','REQUEST_TIMEOUT'],['request:fail net::ERR_NAME_NOT_RESOLVED','ERR_NAME_NOT_RESOLVED'],['request:fail net::ERR_CONNECTION_RESET','ERR_CONNECTION_RESET'],['request:fail offline','OFFLINE']])assert.ok(networkFailureMessage(reason,'trial',-1).includes(expected));
 const value=networkFailureMessage('unrecognized https://private.invalid/?token=synthetic-private-value AppSecret=synthetic-secret Bearer synthetic-token','trial',-101);
 assert.match(value,/NETWORK_ERROR; errno=-101/);assert.doesNotMatch(value,/private|token|Secret|Bearer|https|synthetic/);
 assert.doesNotMatch(networkFailureMessage('unknown','trial',NaN),/errno=/);
});
test('Release, develop and unknown versions retain the ordinary message and never show diagnostic labels',()=>{
 for(const version of ['release','develop','unknown',''])assert.equal(networkFailureMessage('request:fail url not in domain list',''+version,-101),'暂时无法连接服务，请稍后重试');
});
