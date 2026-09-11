import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand,legalCommands,hasTurnOptions,RULES_VERSION} from '../src/engine.js';
import {LocalSession} from '../src/session.js';
import {MatchHub} from '../server/hub.js';
const run=(s,c)=>applyCommand(s,{actor:s.active,revision:s.revision,...c});
const ready=()=>{const s=run(createGame(),{type:'advance'});s.players[0].hands=[2,2];s.players[0].props=['echo','add'];s.players[1].hands=[2,2];return s;};
test('items, synthesis and calculation interleave in one turn without granting a second calculation',()=>{
 let s=ready();s=run(s,{type:'prop',slot:0,target:0});s=run(s,{type:'forge',weapon:'scissors'});
 assert.throws(()=>run(s,{type:'end'}));assert.throws(()=>run(s,{type:'prop',slot:0,target:0,targetHand:0}));
 s=run(s,{type:'attack'});assert.equal(s.active,0);assert.equal(s.calculated,false);
 s=run(s,{type:'add',hand:0,targetHand:1});assert.deepEqual(s.players[0].hands,[2,2]);assert.equal(s.calculated,true);
 s=run(s,{type:'forge',weapon:'scissors'});s=run(s,{type:'attack'});
 assert.equal(s.players[1].hp,89);assert.equal(s.active,0);assert.ok(legalCommands(s).some(c=>c.type==='prop'));
 s=run(s,{type:'prop',slot:0,target:0,targetHand:0});assert.throws(()=>run(s,{type:'add',hand:0,targetHand:0}),/一次/);
 assert.equal(hasTurnOptions(s),false);assert.deepEqual(legalCommands(s).map(c=>c.type),['end']);
 s=run(s,{type:'end'});assert.equal(s.active,1);assert.equal(s.calculated,false);
});
test('a recipe never locks out calculation or items and does not need a decline command',()=>{
 let s=ready();for(const type of ['prop','forge','add'])assert.ok(legalCommands(s).some(c=>c.type===type));
 s.players[0].mirror=true;s=run(s,{type:'add',hand:0,targetHand:0});assert.deepEqual(s.players[0].hands,[2,2]);
 assert.ok(legalCommands(s).some(c=>c.type==='forge'));assert.ok(legalCommands(s).some(c=>c.type==='prop'));
 assert.throws(()=>run(s,{type:'decline'}));assert.throws(()=>run(s,{type:'advance'}));
});
test('serious ends current turn; resilience only prevents its future skip',()=>{
 for(const resilient of [0,3]){let s=ready();s.players[0].weapon='serious';s.players[0].resilience=resilient;s.players[0].skippedTurns=1;s=run(s,{type:'attack'});assert.equal(s.active,1);assert.equal(s.players[0].skippedTurns,0);assert.equal(s.players[0].skip,resilient?0:1);}
});
test('server preserves exact remaining turn time across item, forge and attack animations',()=>{
 let now=10000;const hub=new MatchHub({now:()=>now});const room={state:ready(),status:'playing',readyAt:10000,deadlineAt:40000};
 now+=2345;hub.step(room,{type:'prop',slot:0,target:0,actor:0,revision:room.state.revision});assert.equal(room.deadlineAt-room.readyAt,27655);
 now=room.readyAt+421;hub.step(room,{type:'forge',weapon:'scissors',actor:0,revision:room.state.revision});assert.equal(room.deadlineAt-room.readyAt,27234);
 now=room.readyAt;hub.step(room,{type:'attack',actor:0,revision:room.state.revision});assert.equal(room.deadlineAt-room.readyAt,27234);
 now=room.readyAt+123;hub.step(room,{type:'end',actor:0,revision:room.state.revision});assert.equal(room.state.active,1);
 now=room.readyAt;hub.step(room,{type:'advance',actor:1,revision:room.state.revision});assert.equal(room.deadlineAt-room.readyAt,30000);
});
test('timeout ends the turn without spending an item or running another calculation',()=>{
 let now=10000;const hub=new MatchHub({now:()=>now});const s=ready(),room={code:'TEST',seats:[],state:s,status:'playing',readyAt:10000,deadlineAt:15000};hub.rooms.set('TEST',room);
 now=14999;hub.tick();assert.equal(room.state.revision,s.revision);
 now=15000;hub.tick();assert.equal(room.state.active,1);assert.deepEqual(room.state.players[0].hands,s.players[0].hands);assert.deepEqual(room.state.players[0].props,s.players[0].props);
});
test('PVE restore replays exact RNG, revision and names; old rule saves reject',async()=>{
 const s=new LocalSession(456);s.rename(0,'存档玩家');for(let i=0;i<8;i++){const state=s.getSnapshot();await s.send(legalCommands(state).find(c=>c.type==='advance'||c.type==='end')||legalCommands(state)[0]);}
 const save=s.exportSave(),restored=LocalSession.restore(save);assert.deepEqual(restored.getSnapshot(),s.getSnapshot());assert.deepEqual(restored.getParticipants(),s.getParticipants());assert.throws(()=>LocalSession.restore({...save,rulesVersion:RULES_VERSION-1}));assert.throws(()=>LocalSession.restore({...save,commands:[{type:'invalid'}]}));
});

test('calculation-only items remain in inventory after calculation and do not hide end-turn guidance',()=>{
 let s=ready();s.players[0].hands=[1,1];s.players[0].props=['echo','mirror'];
 assert.equal(legalCommands(s).filter(c=>c.type==='prop').length,2);
 s=run(s,{type:'add',hand:0,targetHand:0});
 assert.equal(hasTurnOptions(s),false);
 for(const slot of [0,1])assert.throws(()=>run(s,{type:'prop',slot,target:0}),/计算已完成/);
 assert.deepEqual(s.players[0].props,['echo','mirror']);
});
