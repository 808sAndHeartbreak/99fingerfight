import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand,legalCommands} from '../src/engine.js';
import {LocalSession} from '../src/session.js';
import {MatchHub} from '../server/hub.js';
const run=(s,c)=>applyCommand(s,{actor:s.active,revision:s.revision,...c});
const ready=()=>{const s=createGame();s.phase='planning';s.players[0].hands=[2,2];s.players[0].echo=true;s.players[1].hands=[2,2];return run(s,{type:'advance'});};
test('one calculation can connect two syntheses; attacks preserve the unspent calculation',()=>{
 let s=ready();s=run(s,{type:'forge',weapon:'scissors'});s=run(s,{type:'attack'});assert.equal(s.active,0);assert.equal(s.phase,'action');assert.equal(s.calculated,false);assert.equal(s.players[1].hp,94);
 s=run(s,{type:'add',hand:0,targetHand:1});assert.equal(s.phase,'synthesis');assert.equal(s.calculated,true);assert.deepEqual(s.players[0].hands,[2,2]);assert.ok(legalCommands(s).every(c=>c.type!=='add'));
 s=run(s,{type:'forge',weapon:'scissors'});assert.throws(()=>run(s,{type:'add',hand:0,targetHand:0}));s=run(s,{type:'attack'});assert.equal(s.active,1);assert.equal(s.players[1].hp,89);
});
test('decline remembers only that numeric pair; unchanged mirror cannot re-prompt but new pair can',()=>{
 let s=run(ready(),{type:'decline'});assert.equal(s.active,0);assert.equal(s.phase,'action');s=run(s,{type:'add',hand:0,targetHand:0});assert.equal(s.phase,'synthesis');assert.deepEqual(s.players[0].hands,[4,4]);
 s=ready();s.players[0].mirror=true;s=run(s,{type:'decline'});s=run(s,{type:'add',hand:0,targetHand:0});assert.equal(s.active,1);
});
test('serious always ends current turn normally; resilience only prevents the next skipped turn',()=>{
 for(const resilient of [0,3]){let s=ready();s.phase='action';s.players[0].weapon='serious';s.players[0].resilience=resilient;s.players[0].skippedTurns=1;s=run(s,{type:'attack'});assert.equal(s.active,1);assert.equal(s.players[0].skippedTurns,0);assert.equal(s.players[0].skip,resilient?0:1);}
});
test('server gives full 20-second computation after automatic same-phase attack',()=>{
 const hub=new MatchHub({now:()=>10000});const state=run(ready(),{type:'forge',weapon:'scissors'});const room={state,status:'playing',readyAt:10000,deadlineAt:10000};hub.step(room,{type:'attack',actor:0,revision:state.revision});assert.equal(room.state.phase,'action');assert.equal(room.deadlineAt-room.readyAt,20000);
});
test('PVE restore replays exact RNG, revision and names; incompatible or corrupt saves reject',async()=>{
 const s=new LocalSession(456);s.rename(0,'存档玩家');for(let i=0;i<8;i++){const state=s.getSnapshot();const c=legalCommands(state).find(c=>c.type==='advance')||legalCommands(state).find(c=>c.type==='add')||legalCommands(state)[0];await s.send({...c,actor:state.active,revision:state.revision});}
 const save=s.exportSave(),restored=LocalSession.restore(save);assert.deepEqual(restored.getSnapshot(),s.getSnapshot());assert.deepEqual(restored.getParticipants(),s.getParticipants());assert.throws(()=>LocalSession.restore({...save,rulesVersion:7}));assert.throws(()=>LocalSession.restore({...save,commands:[{type:'invalid'}]}));
});
