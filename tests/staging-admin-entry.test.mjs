import test from 'node:test';
import assert from 'node:assert/strict';
import {startAdmin, STAGING_STATIC_ORIGIN, STAGING_ADMIN_ORIGIN} from '../admin/src/staging-entry.mjs';

test('Static Staging entry redirects before mounting or starting Admin requests', () => {
  const events=[];
  const result=startAdmin({origin:STAGING_STATIC_ORIGIN, search:'?next=https://untrusted.invalid&token=private', replace:url=>events.push(['redirect',url])},()=>events.push(['mount']));
  assert.equal(result,'redirected');
  assert.deepEqual(events,[['redirect',STAGING_ADMIN_ORIGIN+'/']]);
});

test('Canonical Staging mounts once without a redirect loop; unrelated origins remain unchanged', () => {
  for (const origin of [STAGING_ADMIN_ORIGIN,'http://127.0.0.1:5173','https://production.invalid',STAGING_STATIC_ORIGIN+'.untrusted.invalid',STAGING_STATIC_ORIGIN.replace('https:','http:')]) {
    const events=[];
    assert.equal(startAdmin({origin,replace:()=>events.push('redirect')},()=>events.push('mount')),'mounted');
    assert.deepEqual(events,['mount']);
  }
});
