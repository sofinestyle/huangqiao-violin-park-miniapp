// Shared by the native mini program and the Admin build; never changes API targets.
export const API_TIMEOUT_MS = 20000;
export const READ_BUDGET_MS = 40000;
export const RETRY_STATUSES = [502, 503, 504];
export function canRetryRead(method: string, attempt: number, status: number, networkFailure = false): boolean {
 return method === 'GET' && attempt === 0 && (networkFailure || RETRY_STATUSES.includes(status));
}
export function retryDelay(): number { return 500 + Math.floor(Math.random() * 501); }
export function retryableNetworkMessage(message: string): boolean {
 return !/abort|cancel|offline|no network|network is down|not in domain|domain list|ssl|certificate|invalid url/i.test(message);
}
