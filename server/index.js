import { RULES_VERSION } from "../src/engine.js";
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { MatchHub } from './hub.js';
const root=resolve(fileURLToPath(new URL('../dist',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webp':'image/webp','.png':'image/png','.wav':'audio/wav','.woff2':'font/woff2','.ttf':'font/ttf'};
export function createServer({file=process.env.STATE_FILE||resolve('data/rooms.json'),graceMs=Number(process.env.RECONNECT_GRACE_MS||60000),hubOptions={}}={}) {
 const hub=new MatchHub({file,graceMs,...hubOptions});
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  if(req.url==='/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true,rulesVersion:RULES_VERSION,protocolVersion:2}));return;}
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
   const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
   const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
   if(!path.startsWith(root+sep)||! (await stat(path)).isFile()){res.writeHead(404);res.end();return;}
   res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');
   res.setHeader('Cache-Control',/index\.html$/.test(path)?'no-store':/[-][\w-]{8}\.js$/.test(path)?'public,max-age=31536000,immutable':'public,max-age=3600');
   res.end(req.method==='HEAD'?undefined:await readFile(path));
  }catch{res.writeHead(404);res.end();}
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:16384,perMessageDeflate:false});
 server.on('upgrade',(req,socket,head)=>{
  const origin=req.headers.origin;
  let allowed=!origin;
  try{allowed||=new URL(origin).host===req.headers.host||origin===process.env.ALLOWED_ORIGIN;}catch{}
  if(req.url!=='/ws'||!allowed||wss.clients.size>=500){socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');socket.destroy();return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
 });
 wss.on('connection',ws=>{
  ws.alive=true;let count=0,windowAt=hub.now();const helloTimer=setTimeout(()=>{if(!ws.userId)ws.close(4002,'Authentication timeout');},5000);
  ws.on('pong',()=>ws.alive=true);
  ws.on('message',raw=>{
   let m;
   try{
    if(hub.now()-windowAt>5000){count=0;windowAt=hub.now();}if(++count>40){ws.close(4003,'Rate limited');return;}
    m=JSON.parse(raw.toString());if(!m||typeof m!=='object')throw new Error('无效消息');
    if(m.type==='hello'&&!ws.userId){hub.hello(ws,m);clearTimeout(helloTimer);}else if(m.type==='request')hub.request(ws,m);else throw new Error('请重新连接');
   }catch(e){ws.send(JSON.stringify({type:'error',id:typeof m?.id==='string'?m.id:null,message:e.message}));const u=hub.userById(ws.userId);if(u)hub.emit(u);}
  });
  ws.on('close',()=>{clearTimeout(helloTimer);hub.disconnect(ws);});ws.on('error',()=>{});
 });
 const timer=setInterval(()=>hub.tick(),250);
 const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive){ws.terminate();continue;}ws.alive=false;ws.ping();}},15000);
 return {server,hub,close:()=>new Promise(done=>{clearInterval(timer);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();wss.close();server.close(done);})};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const app=createServer();app.server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Finger Fight server listening'));
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)));
}
