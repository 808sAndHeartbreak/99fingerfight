import test from 'node:test';
import assert from 'node:assert/strict';
import {handPropNumber,PROPS,PROP_IDS} from '../src/catalog.js';
test('new item pool contains fifteen supported items without removed healing/poison',()=>{
 assert.equal(PROP_IDS.length,15);assert.equal(PROPS.heal,undefined);assert.equal(PROPS.poison,undefined);assert.equal(PROPS.sub.name,'退化');
});
test('civil war and doubling preserve decimal hands across all input pairs',()=>{
 for(let a=0;a<10;a++)for(let b=0;b<10;b++){
  const hands=[a,b];
  assert.equal(handPropNumber('civil',hands,0),(a-b+10)%10);
  assert.equal(handPropNumber('civil',hands,1),(b-a+10)%10);
  assert.equal(handPropNumber('double',hands,0),a*2%10);
  assert.equal(handPropNumber('double',hands,1),b*2%10);
  assert.deepEqual(hands,[a,b]);
 }
});
import {createGame,applyCommand,legalCommands,calculationOutcome,supplyIn} from '../src/engine.js';
import {handPreview,comboRoutes} from '../src/guidance.js';
import {touchVisualSteps} from '../src/motion.js';
const run=(s,c)=>applyCommand(s,{actor:s.active,revision:s.revision,...c});
const planning=()=>run(createGame(17),{type:'advance'});
const use=(id,{hands=[1,1],enemy=[1,1],target=0,targetHand,props=[id]}={})=>{
 const s=planning();s.players[0].hands=hands;s.players[1].hands=enemy;s.players[0].props=props;
 return [s,run(s,{type:'prop',slot:0,target,...(targetHand===undefined?{}:{targetHand})})];
};
test('99 starting life and every new item can appear in deterministic turn supplies',()=>{
 const seen=new Set();for(let seed=0;seed<512;seed++){const s=createGame(seed);assert.deepEqual(s.players.map(p=>p.hp),[99,99]);seen.add(s.players[0].props[0]);assert.equal(s.events[0].source,'回合补给');}
 assert.equal(seen.size,15);assert.equal(supplyIn({turns:1}),3);assert.equal(supplyIn({turns:3}),1);
});
test('hand items may affect either side including locked hands; no implicit forge',()=>{
 for(const id of ['civil','double','add','sub'])for(const target of [0,1])for(const targetHand of [0,1]){
  const s=planning();s.players[0].props=[id];s.players[target].hands=[2,7];s.players[target].locks=[true,true];
  const n=run(s,{type:'prop',slot:0,target,targetHand});assert.equal(n.players[target].hands[targetHand],handPropNumber(id,[2,7],targetHand));assert.equal(n.players[target].weapon,null);assert.deepEqual(n.players[target].locks,[true,true]);
 }
});
test('echo and mirror combinations match previews and visual writes across all digits and seats',()=>{
 for(const actor of [0,1])for(const echo of [false,true])for(const mirror of [false,true])for(let a=0;a<10;a++)for(let b=0;b<10;b++){
  const s=createGame();s.active=actor;s.phase='action';s.players[actor].hands=[a,7];s.players[1-actor].hands=[b,3];Object.assign(s.players[actor],{echo,mirror});
  const c={type:'add',actor,revision:s.revision,hand:0,targetHand:0},copy=structuredClone(s),out=calculationOutcome(s,c),next=run(s,c),n=(a+b)%10;
  assert.deepEqual(s,copy);assert.deepEqual(next.players[actor].hands,mirror?[a,7]:echo?[n,n]:[n,7]);assert.deepEqual(next.players[1-actor].hands,mirror?(echo?[n,n]:[n,3]):[b,3]);
  assert.equal(next.players[actor].echo,next.active===actor?echo:false);assert.equal(next.players[actor].mirror,next.active===actor?mirror:false);
  const preview=handPreview(s,{kind:'hand',hand:0},1-actor,0);assert.equal(preview.number,n);
  const steps=touchVisualSteps(s,c);assert.equal(steps.length,echo?2:1);assert.ok(steps.every(step=>step.visualResult===n));
  const visual=structuredClone(s.players.map(p=>p.hands));for(const step of steps)for(const w of step.visualWrites)visual[w.owner][w.hand]=w.value;
  assert.deepEqual(visual,next.players.map(p=>p.hands));assert.equal(out.writes[0].value,n);
 }
});
test('echo copies into a locked secondary hand and mirror never advertises a changed own recipe',()=>{
 const s=createGame();s.phase='action';s.players[0].hands=[4,2];s.players[0].echo=true;s.players[0].locks[1]=true;
 const n=run(s,{type:'add',hand:0,targetHand:0});assert.deepEqual(n.players[0].hands,[5,5]);
 s.players[0].mirror=true;assert.ok(comboRoutes(s,0,0).every(r=>!r.ready));
});
test('silence lasts until the affected player explicitly ends their next turn',()=>{
 const [,next]=use('silence',{target:1});let n=next;n.phase='action';n=run(n,{type:'add',hand:0,targetHand:0});
 assert.equal(n.players[1].silenced,true);n=run(n,{type:'end'});assert.equal(n.players[1].props.length,1);n=run(n,{type:'advance'});
 assert.ok(legalCommands(n).some(c=>c.type==='add'));assert.ok(legalCommands(n).every(c=>c.type!=='prop'));
 assert.throws(()=>run(n,{type:'prop',slot:0,target:1}),/沉默/);n=run(n,{type:'add',hand:0,targetHand:0});
 assert.equal(n.players[1].silenced,true);n=run(n,{type:'end'});assert.equal(n.players[1].silenced,false);
});

test('balance redraws post-consumption counts, boon fills both, greed ends once with capped inventory',()=>{
 const s=planning();s.players[0].props=['balance','echo','lock'];s.players[1].props=['civil','double','ruin'];
 const n=run(s,{type:'prop',slot:0,target:0});assert.deepEqual(n.players.map(p=>p.props.length),[2,3]);assert.equal(n.events.filter(e=>e.type==='draw').length,5);assert.deepEqual(n,run(s,{type:'prop',slot:0,target:0}));
 const [,b]=use('boon');assert.deepEqual(b.players.map(p=>p.props.length),[3,3]);
 const [g]=use('greed',{props:['greed','echo','mirror']});g.players[0].echo=true;g.players[0].mirror=true;
 const gn=run(g,{type:'prop',slot:0,target:0});assert.equal(gn.turn,g.turn+1);assert.equal(gn.active,1);assert.equal(gn.players[0].props.length,3);assert.equal(gn.players[0].echo,false);assert.equal(gn.players[0].mirror,false);
});
test('grace caps healing and ruin uses enemy sum, bypassing and preserving shields',()=>{
 const [s]=use('grace',{hands:[9,9]});s.players[0].hp=95;const n=run(s,{type:'prop',slot:0,target:0});assert.equal(n.players[0].hp,99);
 const [r]=use('ruin',{enemy:[5,9],target:1});r.players[1].hp=13;const rn=run(r,{type:'prop',slot:0,target:1});assert.equal(rn.winner,0);assert.equal(rn.players[1].hp,0);assert.deepEqual(rn.players[1].hands,[5,9]);
 assert.throws(()=>run(s,{type:'prop',slot:0,target:1}),/自己/);assert.throws(()=>run(r,{type:'prop',slot:0,target:0}),/对手/);
 const [,z]=use('grace',{hands:[0,0]});assert.equal(z.players[0].props.length,0);assert.equal(z.players[0].hp,99);
});
test('turn-limited modifiers expire on attack or no legal calculation and do not accumulate uses',()=>{
 const [s]=use('echo',{props:['echo','echo','mirror']});let n=run(s,{type:'prop',slot:0,target:0});n=run(n,{type:'prop',slot:0,target:0});assert.equal(n.players[0].echo,true);
 n=run(n,{type:'prop',slot:0,target:0});n.players[0].hands=[9,9];n=run(n,{type:'forge',weapon:'unify'});assert.equal(n.players[0].echo,true);
 n=run(n,{type:'attack'});assert.equal(n.players[0].echo,true);n=run(n,{type:'add',hand:0,targetHand:0});n=run(n,{type:'end'});assert.equal(n.players[0].echo,false);assert.equal(n.players[0].mirror,false);
 const b=planning();b.players[0].echo=true;b.players[0].mirror=true;b.players[0].locks=[true,true];const bn=run(b,{type:'end'});assert.equal(bn.active,1);assert.equal(bn.players[0].echo,false);assert.equal(bn.players[0].mirror,false);
});
