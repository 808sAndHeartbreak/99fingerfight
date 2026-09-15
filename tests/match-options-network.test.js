import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchHub} from '../server/hub.js';
import {RULES_VERSION} from '../src/engine.js';

function harness() {
 let time=1000,seq=0;const h=new MatchHub({now:()=>time,animationMs:0});
 const client=()=>{const ws={send(){},close(){}};h.hello(ws,{protocolVersion:2,rulesVersion:RULES_VERSION});return ws;};
 const a=client(),b=client(),c=client();
 const req=(ws,op,fields={})=>h.request(ws,{id:String(++seq),op,...fields});
 const room=ws=>h.rooms.get(h.userById(ws.userId).room);
 const tick=ms=>{time+=ms;h.tick();};return {h,a,b,c,req,room,tick};
}
const off={itemsEnabled:false,turnSeconds:10},on={itemsEnabled:true,turnSeconds:60};
test('room host changes options, invalidates ready and broadcasts exact settings',()=>{
 const x=harness();x.req(x.a,'create',{options:off});x.req(x.b,'join',{code:x.room(x.a).code});
 x.req(x.b,'ready',{ready:true});assert.throws(()=>x.req(x.b,'configure',{options:on}),/房主/);
 x.req(x.a,'configure',{options:on});assert.deepEqual(x.room(x.a).ready,[false,false]);
 assert.deepEqual(x.h.packet(x.h.userById(x.b.userId)).room.options,on);
 x.req(x.a,'ready',{ready:true});x.req(x.b,'ready',{ready:true});x.tick(1001);
 assert.equal(x.room(x.a).deadlineAt-x.room(x.a).readyAt,60000);
 assert.deepEqual(x.room(x.a).state.options,on);assert.throws(()=>x.req(x.a,'configure',{options:off}),/对局中/);
});
test('queue pairs only matching options and leaves other queues intact',()=>{
 const x=harness();x.req(x.a,'queue',{options:off});x.req(x.b,'queue',{options:on});
 assert.equal(x.h.rooms.size,0);x.req(x.c,'queue',{options:off});
 assert.equal(x.room(x.a),x.room(x.c));assert.equal(x.h.userById(x.b.userId).queued,true);
 assert.deepEqual(x.room(x.a).state.options,off);assert.deepEqual(x.room(x.a).state.players.map(p=>p.props),[[],[]]);
});
test('invalid settings are rejected before room or queue mutation',()=>{
 const x=harness();for(const op of ['create','queue'])assert.throws(()=>x.req(x.a,op,{options:{itemsEnabled:'false',turnSeconds:5}}),/有效/);
 assert.equal(x.h.rooms.size,0);assert.equal(x.h.queue.length,0);
});
test('10s timeout and same-room rematch preserve no-item rules',()=>{
 const x=harness();x.req(x.a,'create',{options:off});x.req(x.b,'join',{code:x.room(x.a).code});
 x.req(x.a,'ready',{ready:true});x.req(x.b,'ready',{ready:true});x.tick(1001);
 let r=x.room(x.a);assert.equal(r.deadlineAt-r.readyAt,10000);
 x.tick(11001);assert.equal(r.state.active,1);assert.equal(r.state.players[0].hp,89);
 x.h.finish(r,0,'test');x.req(x.a,'rematch');x.req(x.b,'rematch');r=x.room(x.a);
 assert.deepEqual(r.state.options,off);assert.deepEqual(r.state.players.map(p=>p.props),[[],[]]);
});
import {createServer} from '../server/index.js';
import {WebSocket} from 'ws';
test('real WebSocket clients agree on options, action results and reconnect',async()=>{
 const app=createServer({file:null});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const sockets=[];let seq=0;
 const wait=async(fn)=>{for(let i=0;i<250;i++){if(fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('websocket timeout');};
 const connect=async(token)=>{const x={ws:new WebSocket(`ws://127.0.0.1:${app.server.address().port}/ws`),messages:[]};sockets.push(x.ws);x.ws.on('message',data=>{const m=JSON.parse(data);x.messages.push(m);if(m.type==='snapshot')x.packet=m;if(m.type==='welcome')x.token=m.token;});await new Promise(r=>x.ws.once('open',r));x.ws.send(JSON.stringify({type:'hello',protocolVersion:2,rulesVersion:RULES_VERSION,token}));await wait(()=>x.packet);return x;};
 const req=async(x,op,fields={})=>{const id=String(++seq);x.ws.send(JSON.stringify({type:'request',id,op,...fields}));await wait(()=>x.messages.some(m=>m.id===id));const response=x.messages.find(m=>m.id===id);assert.equal(response.type,'ack',response.message);};
 try{const a=await connect(),b=await connect();await req(a,'create',{options:off});await wait(()=>a.packet.room);await req(b,'join',{code:a.packet.room.code});await wait(()=>b.packet.room);assert.deepEqual(b.packet.room.options,off);
 await req(a,'ready',{ready:true});await req(b,'ready',{ready:true});await wait(()=>a.packet.room.state?.phase==='action'&&Date.now()>=a.packet.room.readyAt);
 const r=a.packet.room;await req(a,'command',{matchId:r.matchId,command:{type:'add',hand:0,targetHand:0,revision:r.state.revision}});await wait(()=>b.packet.room.state?.calculated);assert.deepEqual(a.packet.room.state,b.packet.room.state);assert.deepEqual(b.packet.room.state.players.map(p=>p.props),[[],[]]);
 const token=b.token;b.ws.close();await new Promise(r=>b.ws.once('close',r));const resumed=await connect(token);assert.deepEqual(resumed.packet.room.options,off);assert.equal(resumed.packet.room.state.calculated,true);
 }finally{sockets.forEach(ws=>ws.close());await app.close();}
});
