# Staging-only overlay: preserve every existing runtime file except these two.
# Digest verified in the original API003 CloudBase build log.
FROM ccr.ccs.tencentyun.com/tcb-100011456753-gqyp/ca-pppfmzdq_huangqiao-api@sha256:3666e8ebf4544ca0ee84836945f1a064deffed9d6b476d08f80854a690fc24bd
RUN node --input-type=module -e "import{readFileSync}from'node:fs';import{createHash}from'node:crypto';if(createHash('sha256').update(readFileSync('/app/server/pg/foundation.mjs')).digest('hex')!=='870212b6b8fececfe7f1ba23a0e4844a4d80fc51c07ac2bdab8911e318f54246')throw Error('STAGING_BASE_SOURCE_MISMATCH')"
COPY --chown=node:node server/pg/foundation.mjs /app/server/pg/foundation.mjs
COPY --chown=node:node shared/teaching-types.mjs /app/shared/teaching-types.mjs
RUN node --check /app/server/pg/foundation.mjs && node --check /app/shared/teaching-types.mjs
