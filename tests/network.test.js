import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join,resolve,sep } from 'node:path';
import { MatchHub } from '../server/hub.js';
import { createServer } from '../server/index.js';
import { WebSocket } from 'ws';
const socket=()=>({messages:[],send(s){this.messages.push(JSON.parse(s));},close(){this.closed=true;}});
function harness(options={}) {
 let time=1000;const h=new MatchHub({now:()=>time,animationMs:0,...options});
 const a=socket(),b=socket();h.hello(a,{protocolVersion:2,rulesVersion:4,displayName:'一'});h.hello(b,{protocolVersion:2,rulesVersion:4,displayName:'二'});
 let seq=0;const req=(ws,op,fields={})=>h.request(ws,{id:String(++seq),op,...fields});
 const room=()=>h.rooms.get(h.userById(a.userId).room);
 const tick=ms=>{time+=ms;h.tick();};
 const ready=()=>{req(a,'create');req(b,'join',{code:room().code});req(a,'ready',{ready:true});req(b,'ready',{ready:true});tick(1001);};
 return {h,a,b,req,room,tick,ready};
}
test('rooms start only after both ready; public snapshots hide RNG and identity tokens',()=>{
 const x=harness();x.req(x.a,'create');x.req(x.a,'ready',{ready:true});assert.equal(x.room().status,'waiting');
 x.req(x.b,'join',{code:x.room().code});x.req(x.b,'ready',{ready:true});assert.equal(x.room().status,'playing');
 const packet=x.h.packet(x.h.userById(x.a.userId));assert.equal(packet.room.state.rng,undefined);assert.equal(packet.room.participants[1].displayName,'二');
 assert.equal(packet.room.participants[0].id,undefined);assert.equal(packet.room.seat,0);
});
test('server binds actor, rejects stale/mismatched commands and deduplicates accepted command IDs',()=>{
 const x=harness();x.ready();x.tick(1100);
 const room=x.room(),revision=room.state.revision;
 assert.throws(()=>x.req(x.b,'command',{matchId:room.matchId,command:{type:'advance',actor:0,revision}}),/轮到/);
 assert.throws(()=>x.req(x.a,'command',{matchId:'wrong',command:{type:'advance',revision}}),/更新/);
 const m={id:'stable',op:'command',matchId:room.matchId,command:{type:'advance',actor:1,revision}};
 x.h.request(x.a,m);const after=room.state.revision;x.h.request(x.a,m);assert.equal(room.state.revision,after);
 assert.equal(x.a.messages.at(-2).type,'ack');x.tick(1100);
 assert.throws(()=>x.req(x.a,'command',{matchId:room.matchId,command:{type:'add',revision,hand:0,targetHand:0}}),/更新/);
});
test('matchmaking, cancel, live rename, reconnect grace and rematch agreement',()=>{
 const x=harness();x.req(x.a,'queue');x.req(x.a,'cancel');assert.equal(x.h.queue.length,0);
 x.req(x.a,'queue');x.req(x.b,'queue');assert.equal(x.room().status,'playing');
 x.req(x.b,'name',{name:'新名字⚡'});assert.equal(x.h.packet(x.h.userById(x.a.userId)).room.participants[1].displayName,'新名字⚡');
 const token=x.a.messages.find(m=>m.type==='welcome').token;
 x.h.disconnect(x.a);x.tick(2000);const c=socket();x.h.hello(c,{token,protocolVersion:2,rulesVersion:4});assert.equal(c.userId,x.a.userId);
 x.h.disconnect(c);x.tick(60001);assert.equal(x.room().state.winner,1);assert.equal(x.room().status,'finished');
 x.h.hello(c,{token,protocolVersion:2,rulesVersion:4});const oldId=x.room().matchId;
 x.req(c,'rematch');assert.equal(x.room().matchId,oldId);x.req(x.b,'rematch');assert.notEqual(x.room().matchId,oldId);
 assert.deepEqual(x.room().state.players.map(p=>p.hp),[99,99]);
});
test('leaving awards the other seat without changing its identity; occupied rooms reject third users',()=>{
 const x=harness();x.ready();const c=socket();x.h.hello(c,{protocolVersion:2,rulesVersion:4});
 assert.throws(()=>x.req(c,'join',{code:x.room().code}));const room=x.room();x.req(x.a,'name',{name:'离场前新名字'});x.req(x.a,'leave');
 const p=x.h.packet(x.h.userById(x.b.userId));assert.equal(p.room.seat,1);assert.equal(p.room.state.winner,1);assert.equal(p.room.participants[1].displayName,'二');
 assert.equal(p.room.participants[0].displayName,'离场前新名字');assert.equal(p.room.participants[0].departed,true);assert.equal(p.room.participants[1].departed,false);
 assert.throws(()=>x.req(x.b,'rematch'),/离开/);x.req(x.b,'leave');assert.equal(x.h.rooms.has(room.code),false);
});
test('room state survives process restart and resume token recovers the same seat',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-hub-'));
 try{const file=join(dir,'state.json'),x=harness({file});x.ready();const token=x.a.messages.find(m=>m.type==='welcome').token,matchId=x.room().matchId;
 const restored=new MatchHub({file,now:()=>4000});const c=socket();restored.hello(c,{token,protocolVersion:2,rulesVersion:4});const p=restored.packet(restored.userById(c.userId));assert.equal(p.room.matchId,matchId);assert.equal(p.room.seat,0);
 }finally{assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));rmSync(dir,{recursive:true,force:true});}
});

test('disconnect clears rematch consent and rejected offline rematch does not trap both seats',()=>{
 const x=harness();x.ready();x.h.finish(x.room(),0,'测试结算');
 const token=x.b.messages.find(m=>m.type==='welcome').token;
 x.req(x.b,'rematch');x.h.disconnect(x.b);
 assert.deepEqual(x.room().rematch,[false,false]);
 assert.throws(()=>x.req(x.a,'rematch'),/重连/);
 assert.deepEqual(x.room().rematch,[false,false]);
 const resumed=socket();x.h.hello(resumed,{token,protocolVersion:2,rulesVersion:4});
 x.req(x.a,'rematch');x.req(resumed,'rematch');assert.equal(x.room().status,'playing');
});
test('HTTP health, static source isolation, and live WebSocket hello',async()=>{
 const app=createServer({file:null});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const port=app.server.address().port;
 try{assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status,200);assert.equal((await fetch(`http://127.0.0.1:${port}/server/hub.js`)).status,404);
 await new Promise((resolve,reject)=>{const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`);ws.on('open',()=>ws.send(JSON.stringify({type:'hello',protocolVersion:2,rulesVersion:4,displayName:'网络测试'})));ws.on('message',data=>{if(JSON.parse(data).type==='snapshot'){ws.close();resolve();}});ws.on('error',reject);});
 }finally{await app.close();}
});

import { chooseCommand } from '../src/ai.js';
test('two real WebSocket clients complete a match with identical revisions and result',async()=>{
 let now=10000;const app=createServer({file:null,hubOptions:{now:()=>now,animationMs:0}});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const url=`ws://127.0.0.1:${app.server.address().port}/ws`;
 const client=()=>new Promise((resolve,reject)=>{const ws=new WebSocket(url), c={ws,packet:null,seq:0,pending:new Map()};
  ws.on('open',()=>ws.send(JSON.stringify({type:'hello',protocolVersion:2,rulesVersion:4,displayName:'联机测试'})));
  ws.on('error',reject);ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='snapshot'){c.packet=m;resolve(c);}if(m.type==='ack')c.pending.get(m.id)?.resolve();if(m.type==='error')c.pending.get(m.id)?.reject(new Error(m.message));});
  c.request=(op,fields={})=>new Promise((resolve,reject)=>{const id=String(++c.seq);const timer=setTimeout(()=>reject(new Error('Request timeout')),3000);c.pending.set(id,{resolve:()=>{clearTimeout(timer);c.pending.delete(id);resolve();},reject:e=>{clearTimeout(timer);c.pending.delete(id);reject(e);}});ws.send(JSON.stringify({type:'request',id,op,...fields}));});
 });
 try {
  const a=await client(),b=await client();await a.request('queue');await b.request('queue');
  await new Promise(r=>setImmediate(r));
  let steps=0;
  while(app.hub.rooms.values().next().value.state.winner===null&&steps++<1200){
   const room=app.hub.rooms.values().next().value;
   if(room.state.phase==='start'){now=room.deadlineAt+1;app.hub.tick();await new Promise(r=>setImmediate(r));continue;}
   now=Math.max(now,room.readyAt+1);
   // Client seat is from the server envelope; commands are chosen from public data only.
   const actor=a.packet?.room?.seat===room.state.active?a:b;
   const publicState=app.hub.publicState(room.state);
   const command=chooseCommand({...publicState,rng:1});
   await actor.request('command',{matchId:room.matchId,command});await new Promise(r=>setImmediate(r));
  }
  assert.ok(steps<1200);
  await new Promise(r=>setTimeout(r,20));
  assert.deepEqual(a.packet.room.state,b.packet.room.state);assert.notEqual(a.packet.room.state.winner,null);
  assert.equal(a.packet.room.state.rng,undefined);a.ws.close();b.ws.close();
 }finally{await app.close();}
});

test('old rule clients cannot join a new-rule server',()=>{
 const h=new MatchHub(),s=socket();assert.throws(()=>h.hello(s,{protocolVersion:2,rulesVersion:3}),/刷新/);assert.equal(s.closed,true);assert.equal(h.users.size,0);
});
test('old persisted games return to preparation without carrying removed items',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ff-v3-'));
 try{const file=join(dir,'state.json'),x=harness({file});x.ready();const code=x.room().code;x.room().state.rulesVersion=3;x.room().state.players[0].props=['heal'];x.h.save();
 const restored=new MatchHub({file});const room=restored.rooms.get(code);assert.equal(room.state,null);assert.equal(room.status,'waiting');assert.equal(room.seats.length,2);assert.deepEqual(room.ready,[false,false]);assert.equal(room.matchId,null);
 }finally{assert.ok(resolve(dir).startsWith(resolve(tmpdir())+sep));rmSync(dir,{recursive:true,force:true});}
});

test('v4 status counters survive public snapshots, duplicate attacks, and reconnect',()=>{
 const x=harness();x.ready();x.tick(1100);const r=x.room();r.state.phase='action';r.state.players[0].weapon='buddha';r.state.players[1].hands=[5,5];r.state.players[1].seven=3;r.state.players[1].dark=true;r.state.players[1].foam=4;
 const message={id:'new-skill',op:'command',matchId:r.matchId,command:{type:'attack',revision:r.state.revision}};
 x.h.request(x.a,message);const after=structuredClone(r.state);x.h.request(x.a,message);assert.deepEqual(r.state,after);assert.equal(after.players[1].hp,87);assert.equal(after.players[1].skip,2);assert.equal(after.skipping,true);
 const token=x.b.messages.find(m=>m.type==='welcome').token;x.h.disconnect(x.b);const b=socket();x.h.hello(b,{token,protocolVersion:2,rulesVersion:4});assert.deepEqual(b.messages.at(-1).room.state,x.h.publicState(after));
 x.tick(5000);assert.equal(r.state.active,0);assert.equal(r.state.players[1].skip,2);
});

test('production handoff has no cut-in delay',()=>{
 const x=harness({animationMs:null});x.req(x.a,'create');x.req(x.b,'join',{code:x.room().code});x.req(x.a,'ready',{ready:true});x.req(x.b,'ready',{ready:true});
 assert.equal(x.room().readyAt,1000);assert.equal(x.room().deadlineAt,1000);
 x.tick(1);assert.equal(x.room().state.phase,'planning');
 assert.equal(x.room().deadlineAt-x.room().readyAt,30000);
});


test('unnamed online seats are distinct and submitted names survive reconnect',()=>{
 const x=harness();x.req(x.a,'name',{name:''});x.req(x.b,'name',{name:''});x.ready();
 let packet=x.h.packet(x.h.userById(x.a.userId));
 assert.deepEqual(packet.room.participants.map(p=>p.displayName),['玩家一','玩家二']);
 x.req(x.b,'name',{name:'红方昵称⚡'});
 const token=x.b.messages.find(m=>m.type==='welcome').token;
 x.h.disconnect(x.b);const b=socket();x.h.hello(b,{token,displayName:'',protocolVersion:2,rulesVersion:4});
 packet=x.h.packet(x.h.userById(x.a.userId));assert.equal(packet.room.participants[1].displayName,'红方昵称⚡');
});

test('planning to calculation has no artificial animation lock',()=>{
 const x=harness({animationMs:null});x.req(x.a,'create');x.req(x.b,'join',{code:x.room().code});x.req(x.a,'ready',{ready:true});x.req(x.b,'ready',{ready:true});x.tick(451);
 const r=x.room();assert.equal(r.state.phase,'planning');
 x.req(x.a,'command',{matchId:r.matchId,command:{type:'advance',revision:r.state.revision}});
 assert.equal(r.state.phase,'action');
 x.req(x.a,'command',{matchId:r.matchId,command:{type:'add',hand:0,targetHand:1,revision:r.state.revision}});
 assert.equal(r.state.players[0].hands[0],2);
});
