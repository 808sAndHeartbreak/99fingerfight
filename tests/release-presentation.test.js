import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand} from '../src/engine.js';
import {actionBeats,actionDuration,presentationDuration,SKILL_MOTION} from '../src/presentation.js';
import {WEAPONS,PROPS} from '../src/catalog.js';
import {MatchHub} from '../server/hub.js';
const run=(s,c)=>applyCommand(s,{actor:s.active,revision:s.revision,...c});
test('every skill and item has dedicated art and readable authoritative beats',()=>{
 assert.equal(Object.keys(SKILL_MOTION).length,20);
 for(const w of WEAPONS){const s=createGame();s.phase='action';s.players[0].weapon=w.id;const c={type:'attack'},n=run(s,c);assert.equal(w.image,`ink-mono/${w.id}.webp`);assert.ok(actionBeats(s,n,c).length);assert.ok(actionDuration(s,n,c)>=1400);assert.ok(presentationDuration(s,n,c)>=actionDuration(s,n,c));}
 for(const [id,p] of Object.entries(PROPS))assert.equal(p.image,`ink-mono/${id}.webp`);
});
test('dual-gun presentation preserves per-hit shield resolution and never invents extra bullets after lethal damage',()=>{
 const s=createGame();s.phase='action';s.players[0].weapon='dual';s.players[1].hands=[5,3];s.players[1].foam=2;
 let n=run(s,{type:'attack'}),beats=actionBeats(s,n,{type:'attack'}).filter(e=>e.type==='damage');assert.deepEqual(beats.map(e=>e.amount),[0,0,3,5]);assert.equal(beats[0].label,'盾墙');
 s.players[1].hands=[1,1];s.players[1].foam=0;s.players[1].hp=4;n=run(s,{type:'attack'});assert.equal(actionBeats(s,n,{type:'attack'}).length,1);
});
test('nine mark acquisition and forced win have separate pacing and outcomes',()=>{
 const s=createGame();s.phase='action';s.players[0].weapon='unify';const first=run(s,{type:'attack'});assert.equal(actionDuration(s,first,{type:'attack'}),1800);assert.equal(first.winner,null);
 s.players[0].nine=1;const last=run(s,{type:'attack'});assert.equal(actionDuration(s,last,{type:'attack'}),3200);assert.equal(actionBeats(s,last,{type:'attack'}).at(-1).label,'九九归一');
});
test('server protects same-phase item presentation without granting a fresh planning clock',()=>{
 let now=10000;const h=new MatchHub({now:()=>now});const s=run(createGame(),{type:'advance'});s.players[0].props=['double','add'];
 const r={state:s,deadlineAt:18000,readyAt:0,status:'playing',matchId:'test'};const old=structuredClone(s),c={type:'prop',actor:0,revision:s.revision,slot:0,target:0,targetHand:0};h.step(r,c);
 const duration=presentationDuration(old,r.state,c);assert.equal(r.readyAt,now+duration);assert.equal(r.deadlineAt,18000+duration);assert.equal(r.deadlineAt-r.readyAt,8000);
});
test('all ordinary and true direct skills agree with defense priority for every opponent digit pair',()=>{
 const amounts={serious:30,scissors:5,fan:10,claw:5,buddha:10,dragon:50,frag:30,sniper:30,taser:1,sorrow:20};
 for(const [id,amount] of Object.entries(amounts))for(let a=0;a<10;a++)for(let b=0;b<10;b++)for(const foam of [0,2])for(const boost of [false,true]){
  const s=createGame();s.phase='action';s.players[0].weapon=id;s.players[0].hp=79;s.players[0].knuckles=boost;s.players[1].hands=[a,b];s.players[1].foam=foam;
  const n=run(s,{type:'attack'}),raw=amount+(boost?10:0),truth=['serious','claw','sniper'].includes(id),expected=truth?raw:a===5&&b===5?0:foam?0:a===5||b===5?Math.ceil(raw/2):raw;
  assert.equal(n.events.find(e=>e.type==='damage').amount,expected,`${id}/${a}${b}/${foam}/${boost}`);
 }
});
import {existsSync,statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
test('all production illustrations exist with nonempty files and no placeholder aliases',()=>{
 const files=[...WEAPONS.map(w=>w.image),...Object.values(PROPS).map(p=>p.image),'ink-mono/nine-seal.webp'];assert.equal(new Set(files).size,34);
 for(const file of files){const path=fileURLToPath(new URL('../public/assets/'+file,import.meta.url));assert.ok(existsSync(path),file);assert.ok(statSync(path).size>1000,file);}
});
test('terminal attacks preserve the final cinematic window while ending the match immediately',()=>{
 const h=new MatchHub({now:()=>10000});const s=createGame();s.phase='action';s.players[0].weapon='unify';s.players[0].nine=1;const r={state:s,status:'playing',readyAt:0,deadlineAt:12000};const c={type:'attack',actor:0,revision:s.revision};h.step(r,c);assert.equal(r.status,'finished');assert.equal(r.deadlineAt,null);assert.equal(r.state.winner,0);assert.equal(r.readyAt,10000+presentationDuration(s,r.state,c));
});
import {OnlineClient} from '../src/online.js';
test('late callbacks from a replaced socket cannot overwrite the current connection',()=>{
 const saved={WebSocket:globalThis.WebSocket,window:globalThis.window,location:globalThis.location};
 class FakeSocket {static OPEN=1;constructor(){this.readyState=1;}send(){}close(){this.readyState=3;}}
 globalThis.WebSocket=FakeSocket;globalThis.window={sessionStorage:{getItem:()=>null,setItem(){}},localStorage:{getItem:()=>null}};globalThis.location={href:'http://localhost/'};
 try{const client=new OnlineClient(()=>{},()=>{});client.connect();const old=client.socket;client.connect();const current=client.socket;current.onmessage({data:JSON.stringify({type:'welcome',token:'new'})});old.onclose({code:4001});assert.equal(client.status,'connected');old.onmessage({data:JSON.stringify({type:'snapshot',serverNow:0,profile:{displayName:'stale'}})});assert.equal(client.packet,null);client.close();}
 finally{Object.assign(globalThis,saved);}
});
