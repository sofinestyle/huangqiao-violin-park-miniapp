import {fileURLToPath} from 'node:url';
import {openDatabase} from './db.mjs';
import {seed} from './seed.mjs';
import {createHttpServer} from './http.mjs';
import {configuration} from './config.mjs';
import {LocalStorage,CloudBaseStorage} from './storage/index.mjs';
const config=configuration(),db=openDatabase(config.database);
try{
 await db.one('SELECT version FROM migrations WHERE version=1');
 if(config.seed==='development')await seed(db,{environment:config.environment});
 const storage=config.storage==='local'?new LocalStorage(config.uploads):new CloudBaseStorage(config.cloudbase);
 const {server,videoWorker}=createHttpServer({...config,db,storage,root:fileURLToPath(new URL('../',import.meta.url))});
 const videoTimer=setInterval(()=>void videoWorker.tick(),15000);videoTimer.unref();void videoWorker.tick();
 server.listen(config.port,config.environment==='development'?'127.0.0.1':'0.0.0.0',()=>console.log(`业务服务已启动，端口${config.port}，环境${config.environment}`));
 let closing=false;
 const shutdown=()=>{if(closing)return;closing=true;clearInterval(videoTimer);const timer=setTimeout(()=>process.exit(1),15000);timer.unref();server.close(async()=>{await db.close();clearTimeout(timer);});server.closeIdleConnections();};
 process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}catch{await db.close();console.error('服务启动失败：请检查数据库配置、连接及迁移状态。');process.exitCode=1;}
