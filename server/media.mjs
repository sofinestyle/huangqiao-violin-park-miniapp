import { visibleProductSkus } from './public-product.mjs';
import { randomUUID, createHash } from 'node:crypto';
import { createWriteStream, createReadStream } from 'node:fs';
import { join } from 'node:path';
import { once } from 'node:events';
import { requireValue, permit, text, audit } from './security.mjs';
import { now, decode } from './db.mjs';
import { storageProvider } from './storage/index.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
export const MAX_UPLOAD = 64 * 1024 * 1024; // Local validation limit; production budget and format policy remain pending.
export async function listMedia(db) {
    const contents = (await db.many("SELECT id,kind,name,state,data FROM content", [])).map(c => ({ ...c, data: decode(c.data) }));
    const skuRefs = (await db.many("SELECT product_id,images FROM product_skus", [])).map(s => ({ ...s, images: decode(s.images) }));
    return (await db.many("SELECT id,filename,mime,size,sha256,rights,duration,created_at FROM media ORDER BY created_at DESC", [])).map(m => ({ ...m, usedBy: contents.filter(c => skuRefs.some(s => s.product_id === c.id && s.images.includes(`/api/media/${m.id}`)) || c.data.mediaId === m.id || c.data.images?.includes(`/api/media/${m.id}`) || c.data.specs?.some(s => s.images?.includes(`/api/media/${m.id}`))).map(({ id, kind, name, state }) => ({ id, kind, name, state })) }));
}
function validHeader(mime, buffer) {
    if (mime === 'video/mp4')
        return buffer.length > 12 && buffer.subarray(4, 8).toString() === 'ftyp';
    if (mime === 'video/webm')
        return buffer.subarray(0, 4).toString('hex') === '1a45dfa3';
    if (mime === 'image/png')
        return buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a';
    if (mime === 'image/jpeg')
        return buffer.subarray(0, 3).toString('hex') === 'ffd8ff';
    return false;
}
export async function upload(db, actor, request, uploads, authorizeCommit) {
    permit(actor, 'content');
    const mime = request.headers['content-type']?.split(';')[0];
    requireValue(['video/mp4', 'video/webm', 'image/png', 'image/jpeg'].includes(mime), '支持MP4、WebM、PNG、JPG文件', 415);
    const rights = text(decodeURIComponent(request.headers['x-media-rights'] || ''), '权属说明', 800, mime.startsWith('image/'));
    const filename = text(decodeURIComponent(request.headers['x-file-name'] || ''), '文件名', 180);
    const expected = Number(request.headers['content-length']);
    requireValue(Number.isFinite(expected) && expected > 0 && expected <= MAX_UPLOAD, '文件为空或超过64MB上传上限', 413);
    const provider = storageProvider(uploads);
    const temporary = mkdtempSync(join(tmpdir(), 'hq-upload-'));
    const key = randomUUID(), storedName = key + ({ 'video/mp4': '.mp4', 'video/webm': '.webm', 'image/png': '.png', 'image/jpeg': '.jpg' }[mime]);
    const path = join(temporary, storedName), out = createWriteStream(path, { flags: 'wx', mode: 0o600 });
    const hash = createHash('sha256');
    let size = 0, header = Buffer.alloc(0), failed;
    out.on('error', e => { failed = e; });
    try {
        for await (const chunk of request) {
            size += chunk.length;
            requireValue(size <= MAX_UPLOAD && size <= expected, '文件大小超出声明或上传限制', 413);
            if (header.length < 32)
                header = Buffer.concat([header, chunk]).subarray(0, 32);
            if (failed)
                throw failed;
            hash.update(chunk);
            if (!out.write(chunk))
                await once(out, 'drain');
        }
        out.end();
        await once(out, 'finish');
        requireValue(size === expected && validHeader(mime, header), '文件格式或内容无效', 415);
        const sha = hash.digest('hex');
        await provider.put(storedName, createReadStream(path), { mime, size });
        try {
            await db.transaction(async () => { if(authorizeCommit)await authorizeCommit(); await db.execute('INSERT INTO media VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [key, filename, mime, size, sha, storedName, rights, null, now()]); await audit(db, actor, 'media.upload', key, { filename, mime, size, sha256: sha }); });
        }
        catch (e) {
            try {
                if (!await db.maybeOne('SELECT id FROM media WHERE id=$1', [key]))
                    await provider.delete(storedName);
            }
            catch {
                console.error('上传补偿待核查', { mediaId: key });
            }
            throw e;
        }
        return { id: key, filename, mime, size, rights, url: `/api/media/${key}`, previewUrl: `/api/admin/media/${key}/file` };
    }
    catch (e) {
        out.destroy();
        throw e;
    }
    finally {
        rmSync(temporary, { recursive: true, force: true });
    }
}
export async function serveMedia(db, request, response, key, uploads, admin = false) {
    const media = (await db.maybeOne("SELECT * FROM media WHERE id=$1", [key]));
    requireValue(media, '媒体不存在', 404);
    if (!admin) {
        const refs = (await db.many("SELECT id,kind,data FROM content WHERE state='published'", []));
        let allowed = false;
        const allSkus = await db.many('SELECT * FROM product_skus');
        for (const r of refs) {
            const d = { id: r.id, kind: r.kind, ...decode(r.data) };
            if (d.mediaId === key || d.images?.includes(`/api/media/${key}`) || (r.kind === 'product' && (await visibleProductSkus(db, d, allSkus.filter(s => s.product_id === r.id))).some(s => s.images.includes(`/api/media/${key}`)))) {
                allowed = true;
                break;
            }
        }
        requireValue(allowed, '内容已下架或尚未发布', 410, 'MEDIA_UNAVAILABLE');
    }
    const provider = storageProvider(uploads);
    let size;
    try {
        size = (await provider.metadata(media.object_key)).size;
    }
    catch {
        requireValue(false, '媒体文件不可用', 404);
    }
    const headers = { 'Content-Type': media.mime, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': admin ? 'same-origin' : 'cross-origin', ...(!admin ? { 'Access-Control-Allow-Origin': '*' } : {}) };
    let start = 0, end = size - 1, status = 200;
    if (request.headers.range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        if (!m || (!m[1] && !m[2])) {
            response.writeHead(416, { 'Content-Range': `bytes */${size}` });
            response.end();
            return;
        }
        if (m[1]) {
            start = Number(m[1]);
            end = m[2] ? Number(m[2]) : end;
        }
        else {
            start = Math.max(0, size - Number(m[2]));
        }
        if (start >= size || start > end || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
            response.writeHead(416, { 'Content-Range': `bytes */${size}` });
            response.end();
            return;
        }
        end = Math.min(end, size - 1);
        status = 206;
        headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    }
    response.writeHead(status, { ...headers, 'Content-Length': end - start + 1 });
    if (request.method === 'HEAD') {
        response.end();
        return;
    }
    const stream = await provider.read(media.object_key, { start, end });
    // Check publication for every new request; downloaded buffers cannot be revoked.
    stream.on('error', () => response.destroy());
    response.on('close', () => stream.destroy());
    stream.pipe(response);
}
