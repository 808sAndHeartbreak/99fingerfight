import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand} from '../src/engine.js';
import {PROP_WEIGHTS} from '../src/catalog.js';
import {turnSeconds} from '../src/phase-cue.js';
import {describe} from '../src/info.js';
import {propUseDetail} from '../src/guidance.js';
import {MatchHub} from '../server/hub.js';
const run=(s,c)=>applyCommand(s,{actor:s.active,revision:s.revision,...c});
const fixture=(weapon='dual')=>{const s=createGame(27);s.phase='action';s.players[0].weapon=weapon;s.players.forEach(p=>{p.props=[];p.turns=1;});return s;};
// These duration tests resolve skills after the turn's calculation.
const attack=s=>{const n=run({...s,calculated:true},{type:'attack'});if(n.winner!==null||n.active!==s.active)return n;const ended=run(n,{type:'end'});ended.events=[...n.events,...ended.events];return ended;};
const damage=n=>n.events.filter(e=>e.type==='damage');
const touch=s=>{s.phase='action';s.calculated=false;s.players[s.active].weapon=null;const n=run(s,{type:'add',hand:0,targetHand:0});return n.winner===null?run(n,{type:'end'}):n;};

test('wine and adrenaline are tier B and wine stacks for only the next first direct segment',()=>{
 assert.equal(PROP_WEIGHTS.wine,2);assert.equal(PROP_WEIGHTS.adrenaline,2);
 let s=fixture();s.phase='action';s.players[0].weapon=null;s.players[0].props=['wine','wine'];
 s=run(s,{type:'prop',slot:0,target:0});s=run(s,{type:'prop',slot:0,target:0});assert.equal(s.players[0].wine,2);
 for(const id of ['dual','drunken','claw']){
  const t=structuredClone(s);t.phase='action';t.players[0].weapon=id;const n=attack(t),hits=damage(n);
  assert.equal(hits[0].raw,25);assert.ok(hits.slice(1).every(e=>e.raw===5));assert.equal(n.players[0].wine,0);
 }
});

test('wine persists through calculation, harmless skills and end-turn items but is consumed on blocked direct attacks',()=>{
 for(const id of ['peace','foam','knuckles','unify','serpent']){const s=fixture(id);s.players[0].wine=3;assert.equal(attack(s).players[0].wine,3);}
 const s=fixture();s.players[0].wine=3;assert.equal(touch(structuredClone(s)).players[0].wine,3);
 s.players[1].peace=3;let n=attack(s);assert.equal(n.players[0].wine,0);assert.ok(damage(n).every(e=>e.amount===0));
 s.phase='action';s.players[0].weapon=null;s.players[0].props=['adrenaline'];n=run(s,{type:'prop',slot:0,target:0});assert.equal(n.players[0].wine,3);
});

test('adrenaline ends current turn, lasts three subsequent own turns, repeats extend not intensity',()=>{
 let s=fixture();s.phase='action';s.players[0].weapon=null;s.players[0].props=['adrenaline'];s.players[0].hands=[9,9];s.players[0].weapon=null;
 s=run(s,{type:'prop',slot:0,target:0});assert.equal(s.active,1);assert.equal(s.players[0].adrenaline,3);assert.equal(s.players[0].weapon,null);assert.equal(s.players[0].nine,0);
 for(let i=0;i<3;i++){s=touch(s);assert.equal(s.players[0].adrenaline,3-i);s=touch(s);}
 assert.equal(s.players[0].adrenaline,0);
 s.phase='action';s.active=0;s.players[0].adrenaline=2;s.players[0].adrenalineSince=0;s.players[0].props=['adrenaline'];s=run(s,{type:'prop',slot:0,target:0});assert.equal(s.players[0].adrenaline,4);
});

test('adrenaline combines with wine, knuckles and weakness before flooring, then incoming reduction before shields',()=>{
 const s=fixture('dual');Object.assign(s.players[0],{adrenaline:3,wine:2,knuckles:1,weak:2});Object.assign(s.players[1],{adrenaline:3,foam:1,hands:[5,1]});
 const n=attack(s);assert.deepEqual(damage(n).map(e=>e.raw),[35,15,15,15]);assert.deepEqual(damage(n).map(e=>e.amount),[0,5,10,10]);
 const t=fixture('taser');t.players[0].weak=3;t.players[0].adrenaline=3;assert.equal(damage(attack(t))[0].raw,1);
 const z=fixture('dual');z.players[1].adrenaline=3;z.players[1].foam=2;const zero=attack(z);assert.ok(damage(zero).every(e=>e.amount===0));assert.equal(zero.players[1].foam,2);
});

test('adrenaline applies to true, item and DOT damage with matching tooltip values, never modifies healing',()=>{
 const t=fixture('sniper');t.players[0].adrenaline=3;t.players[1].adrenaline=3;assert.equal(damage(attack(t))[0].amount,30);
 const s=fixture('foam');s.players[0].adrenaline=3;s.players[1].seven=1;s.players[1].dark=true;s.players[1].poison=1;
 assert.deepEqual(damage(attack(s)).map(e=>e.raw),[12,10,7]);
 s.phase='action';s.players[0].weapon=null;s.players[0].props=['ruin'];s.players[1].hands=[3,4];assert.match(describe('prop:ruin:0',s).body,/当前伤害 12/);assert.match(propUseDetail(s,'ruin'),/造成 12/);assert.equal(damage(run(s,{type:'prop',slot:0,target:1}))[0].amount,12);
 s.players[0].props=['grace'];s.players[0].hp=50;s.players[0].hands=[3,4];assert.equal(run(s,{type:'prop',slot:0,target:0}).players[0].hp,57);
});

test('steal transfers consumable and timed buffs but never nine; unify retains both beneficial buffs',()=>{
 const s=fixture('steal');s.players[0].wine=2;Object.assign(s.players[1],{wine:3,adrenaline:4,nine:1});const n=attack(s);
 assert.equal(n.players[0].wine,5);assert.equal(n.players[1].wine,0);assert.equal(n.players[0].adrenaline,4);assert.equal(n.players[1].adrenaline,0);assert.equal(n.players[1].nine,1);
 const u=fixture('unify');Object.assign(u.players[0],{wine:3,adrenaline:3,adrenalineSince:1});const v=attack(u);assert.equal(v.players[0].wine,3);assert.equal(v.players[0].adrenaline,3);
});

test('empty or silenced inventory never creates a separate timer',()=>{
 const s=fixture();s.players[0].weapon=null;assert.equal(turnSeconds(s),30);
 s.players[0].props=['wine'];assert.equal(turnSeconds(s),30);s.players[0].silenced=true;assert.equal(turnSeconds(s),30);s.players[0].silenced=false;
 const h=new MatchHub({now:()=>10000}),r={state:s,status:'playing',readyAt:0,deadlineAt:20000};h.step(r,{type:'prop',actor:0,revision:s.revision,slot:0,target:0});assert.equal(r.deadlineAt-r.readyAt,10000);
});
