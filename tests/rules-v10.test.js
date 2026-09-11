import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand,legalCommands} from '../src/engine.js';
import {chooseCommand} from '../src/ai.js';
import {LocalSession} from '../src/session.js';
import {stateChanges} from '../src/state-changes.js';
import {touchVisualSteps} from '../src/motion.js';
import {presentationDuration} from '../src/presentation.js';
const run=(s,c)=>applyCommand(s,{actor:s.active,revision:s.revision,...c});
const ready=()=>run(createGame(44),{type:'advance'});
test('combined mirror and echo updates both enemy hands from the original operands in either item order',()=>{
 for(const props of [['echo','mirror'],['mirror','echo']]){
  let s=ready();s.players[0].props=props;s.players[0].hands=[8,3];s.players[1].hands=[4,7];s.players[1].locks[1]=true;
  s=run(s,{type:'prop',slot:0,target:0});s=run(s,{type:'prop',slot:0,target:0});
  const c={type:'add',actor:0,hand:0,targetHand:0},n=run(s,c),steps=touchVisualSteps(s,c);
  assert.deepEqual(n.players.map(p=>p.hands),[[8,3],[2,2]]);assert.deepEqual(steps.map(x=>x.visualOperands),[[8,4],[8,4]]);
  assert.deepEqual(steps.flatMap(x=>x.visualWrites),[{owner:1,hand:0,value:2},{owner:1,hand:1,value:2}]);
 }
});
test('ending items cannot award missed-action resilience after calculation or skill use',()=>{
 for(const id of ['greed','adrenaline'])for(const actedBy of ['add','attack']){
  let s=ready();s.players[0].props=[id];s.players[0].skippedTurns=1;
  if(actedBy==='attack')s.players[0].weapon='scissors';
  s=run(s,actedBy==='add'?{type:'add',hand:0,targetHand:0}:{type:'attack'});s=run(s,{type:'prop',slot:0,target:0});
  assert.equal(s.players[0].resilience,0);assert.equal(s.players[0].skippedTurns,0);
 }
});
test('master sees lethal wine into sniper and does not depend on the secret random stream',()=>{
 const s=ready();s.players[0].hands=[8,8];s.players[0].props=['wine'];s.players[1].hp=40;
 const command=chooseCommand(s,'master');assert.equal(command.type,'prop');assert.equal(command.slot,0);
 assert.deepEqual(command,chooseCommand({...s,rng:123},'master'));
 const n=run(s,command);assert.equal(chooseCommand(n,'master').weapon,'sniper');
});
test('all difficulties return legal commands without changing the source state',()=>{
 for(const difficulty of ['easy','advanced','master']){
  const s=ready(),copy=structuredClone(s),c=chooseCommand(s,difficulty);assert.deepEqual(s,copy);assert.ok(legalCommands(s).some(x=>JSON.stringify(x)===JSON.stringify(c)));
 }
});
test('PVE saves retain difficulty and rule 9 saves are rejected',()=>{
 const s=new LocalSession(42,{difficulty:'master'}),saved=s.exportSave();assert.equal(LocalSession.restore(saved).difficulty,'master');assert.throws(()=>LocalSession.restore({...saved,rulesVersion:9}),/不兼容/);
});
test('event deltas identify shield loss, copied digits and inventory without treating duplicate items as a removal',()=>{
 const s=ready(),n=structuredClone(s);s.players[0].props=['wine','wine'];n.players[0].props=['wine'];s.players[1].hands=[5,2];n.players[1].hands=[1,2];n.players[1].foam=2;
 const changes=stateChanges(s,n);assert.equal(changes.filter(c=>c.kind==='inventory').length,1);assert.ok(changes.some(c=>c.owner===1&&c.hand===0&&c.label==='[5] → [1]'));assert.ok(changes.some(c=>c.key==='foam'));
});
test('turn-start periodic damage gets reading time and the server can reserve that same duration',()=>{
 const s=ready();s.players[1].seven=2;s.players[1].poison=2;const n=run(s,{type:'end'});assert.equal(n.events.filter(e=>e.type==='damage').length,2);assert.equal(presentationDuration(s,n,{type:'end'}),4200);
});
