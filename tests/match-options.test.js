import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand,legalCommands} from '../src/engine.js';
import {matchOptions} from '../src/match-options.js';
import {turnSeconds} from '../src/phase-cue.js';
import {LocalSession} from '../src/session.js';
import {chooseCommand} from '../src/ai.js';
import {describe} from '../src/info.js';
import {commandArt} from '../src/presentation.js';
import {effectDetail} from '../src/effect-copy.js';
const run=(s,c)=>applyCommand(s,{...c,actor:s.active,revision:s.revision});
function ready(options={itemsEnabled:false,turnSeconds:10}) {return run(createGame(37,options),{type:'advance'});}
function attack(s,id) {s.players[0].weapon=id;return run(s,{type:'attack'});}

test('options validate exact booleans and allowed durations',()=>{
 assert.deepEqual(matchOptions(),{itemsEnabled:true,turnSeconds:30});
 for(const value of [{itemsEnabled:'false'},{turnSeconds:0},{turnSeconds:20},{turnSeconds:'10'},null])assert.throws(()=>matchOptions(value));
});
test('no-item opening and repeated supplies never issue items or supply events',()=>{
 let s=ready();
 for(let i=0;i<20&&s.winner===null;i++) {
  assert.deepEqual(s.players.map(p=>p.props),[[],[]]);assert.ok(s.events.every(e=>!['draw','supply-full'].includes(e.type)));
  assert.ok(legalCommands(s).every(c=>c.type!=='prop'));
  s=run(s,{type:'add',hand:0,targetHand:0});s=run(s,{type:'end'});if(s.winner===null)s=run(s,{type:'advance'});
 }
 const bad=ready();bad.players[0].props=['add'];assert.throws(()=>run(bad,{type:'prop',slot:0,target:0,targetHand:0}),/未启用/);
});
for(const itemsEnabled of [false,true])test(`fan and dual damage, shields, bonuses and copy agree; items=${itemsEnabled}`,()=>{
 let s=ready({itemsEnabled,turnSeconds:60});s.players.forEach(p=>p.props=[]);
 let n=attack(s,'fan');assert.equal(n.players[1].hp,itemsEnabled?89:79);
 s=ready({itemsEnabled,turnSeconds:60});s.players.forEach(p=>p.props=[]);s.players[1].hands=[5,1];
 n=attack(s,'dual');assert.equal(n.players[1].hp,itemsEnabled?81:64);
 assert.equal(n.players[0].props.length,itemsEnabled?3:0);
 assert.equal(turnSeconds(n),60);
 if(!itemsEnabled){
  assert.doesNotMatch(effectDetail(s,n,{type:'attack'}),/道具|补/);
  assert.match(commandArt(s,{type:'attack'}).detail,/4 次各造成 10/);
  assert.match(describe('weapon:fan',s).body,/20/);
  assert.equal(describe('prop:add:0',s),null);assert.equal(describe('supply:0',s),null);
 }
 s=ready({itemsEnabled,turnSeconds:30});s.players[0].knuckles=1;
 n=attack(s,'dual');assert.equal(n.players[1].hp,itemsEnabled?39:19);
});
test('no-item steal still transfers buffs; no item benefits are advertised',()=>{
 const s=ready();s.players[1].knuckles=2;s.players[1].peace=2;
 const n=attack(s,'steal');assert.equal(n.players[0].knuckles,2);assert.equal(n.players[1].knuckles,0);
 assert.deepEqual(n.players.map(p=>p.props),[[],[]]);
 assert.doesNotMatch(describe('weapon:steal',s).body,/道具/);
});
test('save and replay retain both options and selected difficulty',async()=>{
 const session=new LocalSession(42,{difficulty:'master',options:{itemsEnabled:false,turnSeconds:60}});
 const s=session.getSnapshot();await session.send({type:'advance',actor:s.active,revision:s.revision});
 const saved=session.exportSave(),restored=LocalSession.restore(saved);
 assert.deepEqual(restored.getSnapshot(),session.getSnapshot());assert.equal(restored.difficulty,'master');
 assert.equal(turnSeconds(restored.getSnapshot()),60);assert.equal(restored.getSnapshot().options.itemsEnabled,false);
 assert.throws(()=>LocalSession.restore({...saved,rulesVersion:16}),/不兼容/);
});
for(const level of ['easy','advanced','expert','master'])test(`no-item ${level} recognises compensated dual lethal without changing input`,()=>{
 const s=ready();s.players[0].hands=[8,8];s.players[1].hp=35;const before=structuredClone(s);
 const c=chooseCommand(s,level);assert.equal(c.type,'forge');assert.equal(c.weapon,'dual');assert.deepEqual(s,before);
 assert.deepEqual(c,chooseCommand({...s,rng:999},level));
 const n=run(run(s,c),{type:'attack'});assert.equal(n.winner,0);
});
