# Reuse the verified API008 image currently served by API011.
# No database migration, credentials, media, or full project COPY.
FROM ccr.ccs.tencentyun.com/tcb-100011456753-gqyp/ca-pppfmzdq_huangqiao-api@sha256:dae4986644a1026746af37702e99be1acd6446677da4559dcc2a42344253631a
RUN node --input-type=module -e "import{readFileSync}from'node:fs';import{createHash}from'node:crypto';if(createHash('sha256').update(readFileSync('/app/server/pg/foundation.mjs')).digest('hex')!=='9394c4ae6735de1c9eae69323ea6de86e28a505f447f995f0392337e523ae578')throw Error('PROMOTION_BASE_SOURCE_MISMATCH')"
COPY --chown=node:node server/config.mjs server/http.mjs server/production-access.mjs /app/server/
COPY --chown=node:node server/pg/foundation.mjs /app/server/pg/
RUN node --check /app/server/config.mjs && node --check /app/server/http.mjs && node --check /app/server/production-access.mjs && node --check /app/server/pg/foundation.mjs
