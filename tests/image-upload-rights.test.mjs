import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase} from '../server/db.mjs';
import {upload} from '../server/media.mjs';
const actor={id:'image-upload-test',roles:['content']};
function setup(t){const dir=mkdtempSync(join(tmpdir(),'hq-image-rights-'));const db=openDatabase(join(dir,'isolated.sqlite'));t.after(()=>{db.close();rmSync(dir,{recursive:true,force:true});});return {db,dir};}
function request(mime,rights){const body=mime==='image/png'?Buffer.from('89504e470d0a1a0a00000000','hex'):mime==='image/jpeg'?Buffer.from('ffd8ffe000000000','hex'):Buffer.from('000000186674797069736f6d00000000','hex');const r=Readable.from([body]);r.headers={'content-type':mime,'content-length':String(body.length),'x-file-name':'synthetic-file',...(rights===undefined?{}:{'x-media-rights':encodeURIComponent(rights)})};return r;}
test('图片上传可省略说明，旧客户端说明仍保留且限制800字符',async t=>{const {db,dir}=setup(t);for(const mime of ['image/png','image/jpeg']){const m=await upload(db,actor,request(mime),dir);assert.equal(m.rights,'');assert.equal(db.prepare('SELECT rights FROM media WHERE id=?').get(m.id).rights,'');}const old=await upload(db,actor,request('image/png','既有说明'),dir);assert.equal(old.rights,'既有说明');await assert.rejects(upload(db,actor,request('image/png','长'.repeat(801)),dir));});
test('视频仍要求说明；图片上传权限保持',async t=>{const {db,dir}=setup(t);await assert.rejects(upload(db,actor,request('video/mp4'),dir),/权属说明/);assert.ok((await upload(db,actor,request('video/mp4','合成测试视频'),dir)).id);await assert.rejects(upload(db,{id:'reception',roles:['reception']},request('image/png'),dir),e=>e.status===403);assert.equal(db.prepare('SELECT count(*) n FROM media').get().n,1);});
