import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand} from '../src/engine.js';
const run=(s,c)=>applyCommand(s,{actor:s.active,revision:s.revision,...c});
const act=s=>{s.phase='action';s.players[s.active].weapon='foam';return run(s,{type:'attack'});};
test('second consecutive skipped turn grants five future turns, clears queued skips, normal turns break streak',()=>{
 let s=createGame();s.players[1].skip=6;s=act(s);
 assert.equal(s.skipping,true);s=run(s,{type:'advance'});assert.equal(s.players[1].skippedTurns,1);
 s=act(s);s=run(s,{type:'advance'});assert.equal(s.players[1].resilience,5);assert.equal(s.players[1].skip,0);
 for(let i=5;i>0;i--){s=act(s);assert.equal(s.skipping,false);assert.equal(s.players[1].resilience,i);s=act(s);assert.equal(s.players[1].resilience,i-1);}
 s=createGame();s.players[0].skippedTurns=1;s=act(s);assert.equal(s.players[0].skippedTurns,0);
});
test('greed and adrenaline count as skipped actions, but do not end the turn under resilience',()=>{
 for(const id of ['greed','adrenaline']) {
  let s=createGame();s.phase='planning';s.players[0].props=[id];s.players[0].skippedTurns=1;
  let n=run(s,{type:'prop',slot:0,target:0});assert.equal(n.active,1);assert.equal(n.players[0].resilience,5);assert.equal(n.players[0].skip,0);
  s.players[0].resilience=3;n=run(s,{type:'prop',slot:0,target:0});assert.equal(n.active,0);assert.equal(n.phase,'planning');assert.equal(n.players[0].resilience,3);
 }
});
test('resilience prevents both hostile and self skips, transfers through steal, and survives unify',()=>{
 for(const id of ['taser','buddha','serious']){
  let s=createGame();s.phase='action';s.players[0].weapon=id;s.players[0].resilience=5;s.players[1].resilience=5;
  const n=run(s,{type:'attack'});assert.equal(n.players[0].skip,0);assert.equal(n.players[1].skip,0);assert.equal(n.skipping,false);
 }
 let s=createGame();s.phase='action';s.players[0].weapon='steal';s.players[0].skip=3;s.players[1].resilience=4;
 let n=run(s,{type:'attack'});assert.equal(n.players[0].resilience,4);assert.equal(n.players[1].resilience,0);assert.equal(n.players[0].skip,0);
 n.phase='action';n.players[1].weapon='unify';n.players[1].resilience=2;n=run(n,{type:'attack'});assert.equal(n.players[1].resilience,1);
});
test('declining a recipe ends turn without changing hands or earning resilience; no-target end does not count',()=>{
 let s=createGame();s.phase='synthesis';s.players[0].hands=[5,5];s.players[0].skippedTurns=1;
 let n=run(s,{type:'decline'});assert.equal(n.active,1);assert.deepEqual(n.players[0].hands,[5,5]);assert.equal(n.players[0].skippedTurns,0);assert.equal(n.players[0].resilience,0);
 s=createGame();s.phase='planning';s.players[0].locks=[true,true];n=run(s,{type:'advance'});assert.equal(n.active,1);assert.equal(n.players[0].skippedTurns,0);
});

test('seal permits at most one hand per player, rejects repeat without consumption, and respects resilience',()=>{
 let s=createGame();s.phase='planning';s.players[0].props=['lock','lock','lock'];s.players[1].resilience=5;
 s=run(s,{type:'prop',slot:0,target:1,targetHand:0});assert.deepEqual(s.players[1].locks,[true,false]);
 for(const targetHand of [0,1])assert.throws(()=>run(s,{type:'prop',slot:0,target:1,targetHand}),/已有/);
 assert.equal(s.players[0].props.length,2);
 s=run(s,{type:'prop',slot:0,target:0,targetHand:1});assert.deepEqual(s.players[0].locks,[false,true]);
});
