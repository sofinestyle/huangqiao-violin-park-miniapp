const GENERIC_NETWORK_MESSAGE='暂时无法连接服务，请稍后重试';
// Trial-only, fixed vocabulary. Never display raw SDK text, URLs, headers or data.
const ENGINE_CODES=['ERR_NAME_NOT_RESOLVED','ERR_CONNECTION_RESET','ERR_CONNECTION_REFUSED','ERR_CONNECTION_CLOSED','ERR_NETWORK_CHANGED','ERR_INTERNET_DISCONNECTED','ERR_CERT_AUTHORITY_INVALID','ERR_CERT_DATE_INVALID','ERR_SSL_PROTOCOL_ERROR','ERR_TIMED_OUT','ERR_FAILED'];
export function networkFailureMessage(reason: string,version: string,errno?: number): string {
 if(version!=='trial')return GENERIC_NETWORK_MESSAGE;
 let category='NETWORK_ERROR';
 if(/not in domain|domain list|domain.*not.*allow/i.test(reason))category='DOMAIN_NOT_ALLOWED';
 else if(/ssl|certificate|\btls\b|\bcert\b/i.test(reason))category='TLS_CERTIFICATE_ERROR';
 else if(/timeout|timed.?out/i.test(reason))category='REQUEST_TIMEOUT';
 else if(/abort|cancel/i.test(reason))category='REQUEST_CANCELLED';
 else if(/offline|no network|network is down/i.test(reason))category='OFFLINE';
 else if(/invalid url/i.test(reason))category='INVALID_URL';
 else if(/permission|not authorized/i.test(reason))category='REQUEST_PERMISSION_DENIED';
 const engine=ENGINE_CODES.find(code=>reason.includes(code));
 const numeric=typeof errno==='number'&&Number.isInteger(errno)&&Math.abs(errno)<2147483648?'; errno='+errno:'';
 return GENERIC_NETWORK_MESSAGE+'（体验版诊断：'+category+(engine?'; '+engine:'')+numeric+'）';
}
