import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand,legalCommands} from '../src/engine.js';
import {guidance} from '../src/guidance.js';
import {phaseCue} from '../src/phase-cue.js';
import {presentationDuration} from '../src/presentation.js';
import {MatchHub} from '../server/hub.js';
const run=(s,c)=>applyCommand(s,{actor:s.active,revision:s.revision,...c});
test('out-of-turn scissors creates zero recipe offered only on the receiving turn after transition',()=>{
 let s=run(createGame(),{type:'advance'});s.players[0].hands=[2,2];s.players.forEach(p=>p.props=[]);
 s=run(run(s,{type:'forge',weapon:'scissors'}),{type:'attack'});
 assert.deepEqual(s.players[1].hands,[0,0]);assert.equal(legalCommands(s).some(c=>c.type==='forge'),false);
 const next=run(s,{type:'end'});assert.equal(phaseCue(s,next).duration,1200);
 assert.equal(guidance(next,null,true,true).step,'resolving');assert.equal(legalCommands(next).some(c=>c.type==='forge'),false);
 s=run(next,{type:'advance'});assert.equal(guidance(s,null,true,false).step,'synthesis');assert.ok(legalCommands(s).some(c=>c.weapon==='serious'));
});
test('server retains recipe through forge, resolves damage, and reserves release and handoff time',()=>{
 let now=1000;const hub=new MatchHub({now:()=>now});const s=run(createGame(),{type:'advance'});s.players[0].hands=[6,6];s.players[1].hands=[5,1];
 const room={state:s,status:'playing',readyAt:now,deadlineAt:now+17000};
 hub.step(room,{type:'forge',weapon:'frag',actor:0,revision:s.revision});
 assert.deepEqual(room.state.players[0].hands,[6,6]);assert.equal(room.deadlineAt-room.readyAt,17000);
 const forged=structuredClone(room.state);now=room.readyAt;hub.step(room,{type:'attack',actor:0,revision:forged.revision});
 assert.deepEqual(room.state.players[0].hands,[1,1]);assert.equal(room.state.players[1].hp,84);
 assert.deepEqual(room.state.events.find(e=>e.type==='damage').hands,[1,1]);
 assert.equal(room.readyAt-now,presentationDuration(forged,room.state,{type:'attack'}));assert.equal(room.deadlineAt-room.readyAt,17000);
 const after=structuredClone(room.state);now=room.readyAt;hub.step(room,{type:'end',actor:0,revision:after.revision});
 assert.ok(room.readyAt-now>=1200);assert.equal(room.deadlineAt,room.readyAt);
 now=room.readyAt;hub.step(room,{type:'advance',actor:1,revision:room.state.revision});assert.equal(room.deadlineAt-room.readyAt,30000);
});
