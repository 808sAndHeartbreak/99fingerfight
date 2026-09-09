import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from '../server/index.js';
import {OnlineClient} from '../src/online.js';
import {WebSocket} from 'ws';
const storage=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v))};};
const until=async(fn)=>{for(let i=0;i<100;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('socket state timeout');};
test('browser client recovers a room across fresh tab storage using real WebSocket',async()=>{
 const app=createServer({file:null});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const previous={window:globalThis.window,location:globalThis.location,WebSocket:globalThis.WebSocket};
 const clients=[];
 try{
  globalThis.window={localStorage:storage(),sessionStorage:storage()};globalThis.location={href:`http://127.0.0.1:${app.server.address().port}/`};globalThis.WebSocket=WebSocket;
  const first=new OnlineClient(()=>{});clients.push(first);first.connect();await until(()=>first.packet);await first.rename('重连玩家');await first.request('create');await until(()=>first.packet.room);
  const code=first.packet.room.code,token=window.sessionStorage.getItem('ff-token');first.close();await until(()=>first.socket.readyState===WebSocket.CLOSED);
  window.sessionStorage=storage();const fresh=new OnlineClient(()=>{});clients.push(fresh);fresh.connect();await until(()=>fresh.packet);assert.notEqual(window.sessionStorage.getItem('ff-token'),token);
  await fresh.join(code);await until(()=>fresh.packet.room?.code===code);assert.equal(fresh.packet.room.seat,0);assert.equal(fresh.packet.profile.displayName,'重连玩家');assert.equal(window.sessionStorage.getItem('ff-token'),token);
 }finally{clients.forEach(c=>c.close());await app.close();Object.assign(globalThis,previous);}
});
