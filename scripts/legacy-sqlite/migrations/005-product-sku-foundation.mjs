export function migrateProductSku(db){
 db.exec('BEGIN IMMEDIATE');
 try{
  if(!db.prepare('SELECT 1 FROM migrations WHERE version=5').get()){
   db.exec(`CREATE TABLE product_skus (
    id TEXT PRIMARY KEY NOT NULL,
    product_id TEXT NOT NULL REFERENCES content(id),
    sku_code TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK(length(sku_code) BETWEEN 1 AND 64 AND sku_code=trim(sku_code) AND sku_code NOT GLOB '*[^A-Za-z0-9_-]*'),
    option_values TEXT NOT NULL CHECK(json_valid(option_values) AND json_type(option_values)='object'),
    combination_key TEXT NOT NULL,
    reference_price REAL CHECK(reference_price IS NULL OR (typeof(reference_price) IN ('integer','real') AND reference_price>=0 AND reference_price<=10000000)),
    images TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(images) AND json_type(images)='array'),
    enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
    sort_order INTEGER NOT NULL CHECK(typeof(sort_order)='integer' AND sort_order BETWEEN 0 AND 10000),
    disable_reason TEXT NOT NULL DEFAULT '' CHECK(disable_reason IN ('','manual','structure')),
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
    UNIQUE(product_id,combination_key));
    CREATE INDEX product_skus_product_id ON product_skus(product_id);`);
   db.prepare('INSERT INTO migrations VALUES (5,?)').run(new Date().toISOString());
  }
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function rollbackProductSku(db){
 db.exec('BEGIN IMMEDIATE');
 try{
  if(db.prepare("SELECT 1 FROM sqlite_master WHERE name='product_skus'").get()){
   if(db.prepare('SELECT 1 FROM product_skus LIMIT 1').get() || db.prepare("SELECT 1 FROM content WHERE json_extract(data,'$.variantModelVersion')=2 LIMIT 1").get())throw new Error('SKU数据已存在，禁止破坏性回滚；请使用经验证的备份恢复流程');
   db.exec('DROP TABLE product_skus');
  }
  db.prepare('DELETE FROM migrations WHERE version=5').run();db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
