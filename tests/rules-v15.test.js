import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand,emptyTurnPenalty,legalCommands} from '../src/engine.js';
import {PROPS,PROP_IDS} from '../src/catalog.js';
import {describe} from '../src/info.js';
import {chooseCommand} from '../src/ai.js';
import {LocalSession} from '../src/session.js';
import {actionDuration,ITEM_NOTICE_MS,ITEM_READ_MS} from '../src/presentation.js';
const run=(s,c)=>applyCommand(s,{...c,actor:s.active,revision:s.revision});
const fixture=id=>{const s=createGame(6);s.phase='action';s.events=[];s.players.forEach(p=>p.props=[]);s.players[0].props=[id];return s;};

test('grace heals each player by their own sum, independently capped and immutable',()=>{
 for(const actor of [0,1]){
  const s=fixture('grace');s.active=actor;s.players[actor].props=['grace'];
  Object.assign(s.players[0],{hp:95,hands:[8,9]});Object.assign(s.players[1],{hp:60,hands:[2,3]});
  const before=structuredClone(s),n=run(s,{type:'prop',slot:0,target:actor});
  assert.deepEqual(n.players.map(p=>p.hp),[99,65]);assert.deepEqual(s,before);
  assert.ok(n.log.some(l=>l.includes('蓝方回复 4 HP')&&l.includes('红方回复 5 HP')));
 }
 const z=fixture('grace');z.players[0].hands=[0,0];z.players[0].hp=30;
 assert.equal(run(z,{type:'prop',slot:0,target:0}).players[0].hp,30);
});

test('ruin takes absolute difference in both directions, including zero and defenses',()=>{
 for(const [ours,theirs,amount] of [[[9,9],[5,1],12],[[1,2],[5,9],11],[[2,4],[5,1],0]])for(const peace of [0,2]){
  const s=fixture('ruin');Object.assign(s.players[0],{hands:ours,weak:5,knuckles:3,wine:2});Object.assign(s.players[1],{hands:theirs,foam:2,peace});
  const n=run(s,{type:'prop',slot:0,target:1}),event=n.events.find(e=>e.type==='damage');
  assert.equal(event.raw,amount);assert.equal(event.amount,peace?0:amount);assert.equal(event.trueDamage,true);
  assert.deepEqual(n.players[1].hands,theirs);assert.equal(n.players[1].foam,2);assert.equal(n.players[0].hp,99);
 }
});

test('greed resets hands with or without resilience; forced end alone exempts penalty',()=>{
 for(const resilience of [0,3]){
  const s=fixture('greed');Object.assign(s.players[0],{hands:[9,9],resilience});
  const n=run(s,{type:'prop',slot:0,target:0});
  assert.deepEqual(n.players[0].hands,[1,1]);assert.equal(n.players[0].props.length,2);assert.equal(n.players[0].hp,99);
  assert.equal(n.active,resilience?0:1);
  if(resilience){assert.equal(emptyTurnPenalty(n),10);assert.equal(run(n,{type:'end'}).players[0].hp,89);}
 }
});

test('removed boon and old saves are rejected; catalog descriptions separate rules',()=>{
 assert.equal(PROPS.boon,undefined);assert.equal(PROP_IDS.length,13);
 const save=new LocalSession().exportSave();assert.throws(()=>LocalSession.restore({...save,rulesVersion:14}),/不兼容/);
 assert.equal(describe('prop:boon:0',fixture('wine')),null);
 const s=fixture('wine');assert.equal(describe('prop:wine:0',s).body,'下一次攻击伤害 +10');
 for(const id of PROP_IDS)assert.ok(describe(`prop:${id}:0`,s).note);
 assert.doesNotMatch(describe('prop:sub:0',s).body,/\[0\]/);assert.match(describe('prop:sub:0',s).note,/可以对任意玩家使用。\[0\] 变成 \[9\]/);
});

test('item impacts happen within one second while readable receipts outlast the action lock',()=>{
 const s=fixture('add'),c={type:'prop',slot:0,target:0,targetHand:0},n=run(s,c);
 assert.ok(ITEM_NOTICE_MS<=1000);assert.equal(actionDuration(s,n,c),1700);assert.ok(ITEM_READ_MS>=6000);
});

for(const level of ['advanced','master'])test(`${level} sees lethal difference damage and avoids a harmful grace`,()=>{
 const lethal=fixture('ruin');lethal.players[0].hands=[9,8];Object.assign(lethal.players[1],{hands:[1,2],hp:10});
 const c=chooseCommand(lethal,level);assert.equal(c.type,'prop');assert.equal(run(lethal,c).winner,0);
 const bad=fixture('grace');bad.calculated=true;bad.acted=true;bad.players[1].hands=[9,8];bad.players[1].hp=10;
 assert.equal(chooseCommand(bad,level).type,'end');
 const greed=fixture('greed');greed.players[0].hands=[9,9];greed.players[0].nine=1;
 const choice=chooseCommand(greed,level);assert.equal(choice.type,'forge');assert.equal(choice.weapon,'unify');
 assert.ok(legalCommands(greed).some(c=>JSON.stringify(c)===JSON.stringify(choice)));
});
