import {fixture} from './admin-business-fixture.mjs';
import {seedSkuProducts} from '../server/sku-seed.mjs';
import {planSkus} from '../shared/sku-model.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,copyFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
export function editProduct(service,actor,product,patch={},change=()=>{}){
 const {id,kind,name,state,sort,version,skus,specs,...data}=service.content(product.id,false);
 Object.assign(data,patch);const plan=planSkus(data.variantMode,data.options,product.variantMode,skus);
 if(plan.error)throw new Error(plan.error);
 const payload={kind,name,state,sort,version,data,skus:plan.current};change(payload);
 return service.saveContent(actor,payload,id);
}
export async function sku2Fixture(){
 const f=await fixture(),products=seedSkuProducts(f.db),media=[];mkdirSync(join(f.dir,'uploads'),{recursive:true});
 for(const name of ['hero-violin.jpg','workshop.jpg','city.jpg']){const id=randomUUID(),filename=id+'.jpg',bytes=readFileSync(join(f.root,'images',name));copyFileSync(join(f.root,'images',name),join(f.dir,'uploads',filename));f.db.prepare('INSERT INTO media VALUES (?,?,?,?,?,?,?,?,?)').run(id,name,'image/jpeg',bytes.length,createHash('sha256').update(bytes).digest('hex'),filename,'',null,new Date().toISOString());media.push('/api/media/'+id);}
 products[1]=editProduct(f.service,f.actor,products[1],{images:[media[0],media[1]],price:450},p=>{p.skus[1].enabled=false;p.skus[8].reference_price=0;p.skus[9].reference_price=480;p.skus[9].images=[media[2]];});
 return {...f,products,media,consultProduct:(product,sku,extra={},key=randomUUID())=>f.service.createConsultation(f.visitor,{contentId:product.id,skuId:sku.id,source:'SKU隔离验证',contactName:'合成访客',phone:'13800000000',message:'了解此规格，仅隔离测试',consent:true,...extra},key)};
}
