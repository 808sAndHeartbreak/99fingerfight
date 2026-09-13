import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand} from '../src/engine.js';
import {describe} from '../src/info.js';
const run=(s,c)=>applyCommand(s,{actor:s.active,revision:s.revision,...c});
const fixture=id=>{const s=createGame(42);s.phase='action';s.players[0].weapon=id;s.players.forEach(p=>{p.props=[];p.turns=1;});return s;};
// These duration tests resolve skills after the turn's calculation.
const attack=s=>{const n=run({...s,calculated:true},{type:'attack'});if(n.winner!==null||n.active!==s.active)return n;const ended=run(n,{type:'end'});ended.events=[...n.events,...ended.events];return ended;};
const touch=s=>{s.phase='action';s.calculated=false;s.players[s.active].weapon=null;const n=run(s,{type:'add',hand:0,targetHand:0});return n.winner===null?run(n,{type:'end'}):n;};

test('peace covers exactly each next three own turns, including DOT and skipped turns',()=>{
 let s=attack(fixture('peace'));assert.deepEqual(s.players.map(p=>p.peace),[3,3]);
 s.players.forEach(p=>{p.seven=8;p.dark=true;p.poison=8;p.foam=4;p.skip=4;});
 for(let i=0;i<6;i++)s=touch(s);
 assert.deepEqual(s.players.map(p=>p.peace),[0,0]);
 // The fourth red turn begins immediately after blue ends its third protected turn.
 assert.equal(s.players[0].hp,99);assert.equal(s.players[1].hp,87);
 assert.equal(s.players[0].foam,4);assert.equal(s.players[1].foam,3);
 let skipped=attack(fixture('peace'));skipped.players[1].skip=2;skipped.skipping=true;
 skipped=run(skipped,{type:'advance'});assert.equal(skipped.players[1].peace,2);
});

test('peace blocks every direct segment and item damage without consuming any defense; effects still apply',()=>{
 for(const id of ['dragon','claw','sniper','dual','drunken','serious']){
  const s=fixture(id);Object.assign(s.players[1],{peace:3,hands:[5,5],foam:4});const n=attack(s);
  assert.equal(n.players[1].hp,99);assert.equal(n.players[1].foam,id==='serious'?0:4);
  assert.ok(n.events.filter(e=>e.type==='damage').every(e=>e.amount===0&&e.blocked==='和平'));
  assert.deepEqual(n.players[1].hands,id==='serious'?[1,1]:[5,5]);
 }
 const s=fixture('fan');s.players[1].peace=3;s.players[1].props=['add'];assert.equal(attack(s).players[1].props.length,0);
 s.phase='action';s.players[0].weapon=null;s.players[0].props=['ruin'];s.players[1].hands=[9,9];
 assert.match(describe('prop:ruin:0',s).note,/实际扣血 0/);
 assert.equal(run(s,{type:'prop',slot:0,target:1}).players[1].hp,99);
});

test('peace repeats extend by three without protecting an extra current turn',()=>{
 const s=fixture('peace');Object.assign(s.players[0],{peace:2,peaceSince:0});Object.assign(s.players[1],{peace:2,peaceSince:0});
 const n=attack(s);assert.deepEqual(n.players.map(p=>p.peace),[4,5]);
});

test('weakness floors each direct segment at zero, preserves shields and combines stacked knuckles',()=>{
 for(const id of ['claw','dual','drunken','taser']){
  const s=fixture(id);s.players[0].weak=5;s.players[1].foam=4;s.players[1].hands=[5,5];
  const n=attack(s);assert.ok(n.events.filter(e=>e.type==='damage').every(e=>e.amount===0));assert.equal(n.players[1].foam,4);assert.equal(n.players[0].weak,4);
 }
 const s=fixture('claw');s.players[0].weak=2;s.players[0].knuckles=3;
 assert.deepEqual(attack(s).events.filter(e=>e.type==='damage').map(e=>e.raw),[30,30]);
 s.phase='action';s.players[0].weapon=null;s.players[0].props=['ruin'];s.players[1].hands=[9,9];assert.equal(run(s,{type:'prop',slot:0,target:1}).players[1].hp,83);
});

test('serpent applies five weakened turns and five shieldable poison starts; repeats extend',()=>{
 let s=fixture('serpent');s.players[1].foam=1;s=attack(s);
 assert.equal(s.players[1].weak,5);assert.equal(s.players[1].poison,4);assert.equal(s.players[1].hp,99);assert.equal(s.players[1].foam,0);
 s=touch(s);assert.equal(s.players[1].weak,4);s.phase='action';s.players[0].weapon='serpent';s=attack(s);
 assert.equal(s.players[1].weak,9);assert.equal(s.players[1].poison,8);assert.equal(s.players[1].hp,97);
 for(let i=0;i<9;i++){s=touch(s);s=touch(s);}assert.equal(s.players[1].weak,0);assert.equal(s.players[1].poison,0);assert.equal(s.players[1].hp,81);
});

test('steal transfers only peace and knuckles, preserves hands, marks and general states, and discards item overflow',()=>{
 const s=fixture('steal');Object.assign(s.players[0],{props:['add','sub'],knuckles:2,peace:2,peaceSince:0});
 Object.assign(s.players[1],{hands:[8,9],props:['double','lock','grace'],knuckles:4,peace:3,foam:5,echo:true,mirror:true,nine:1,weak:2});
 const n=attack(s),[p,e]=n.players;assert.deepEqual(p.props,['add','sub','double']);assert.deepEqual(e.props,[]);assert.deepEqual(p.hands,[1,1]);assert.deepEqual(e.hands,[8,9]);
 assert.equal(p.knuckles,6);assert.equal(e.knuckles,0);assert.equal(p.peace,4);assert.equal(e.peace,0);assert.equal(e.foam,5);assert.equal(e.echo,true);assert.equal(e.mirror,true);assert.equal(e.nine,1);assert.equal(e.weak,2);
 const fresh=fixture('steal');fresh.players[1].peace=3;assert.equal(attack(fresh).players[0].peace,3);
});

test('unify cleanses every own debuff but retains buffs and both nine marks; peace cannot prevent forced victory',()=>{
 const s=fixture('unify');Object.assign(s.players[0],{locks:[true,true],silenced:true,skip:4,seven:5,dark:true,weak:5,poison:5,knuckles:3,foam:4,peace:3,nine:1});
 s.players[1].peace=3;s.players[1].nine=1;const n=attack(s),p=n.players[0];
 for(const key of ['skip','seven','weak','poison'])assert.equal(p[key],0);
 assert.equal(p.dark,false);assert.equal(p.silenced,false);assert.deepEqual(p.locks,[false,false]);assert.equal(p.knuckles,3);assert.equal(p.foam,4);assert.equal(n.winner,0);assert.equal(n.players[1].nine,1);
});

test('serious resets non-five digits too and poison lethal stops later processing',()=>{
 const s=fixture('serious');s.players[1].hands=[7,9];assert.deepEqual(attack(s).players[1].hands,[1,1]);
 const d=fixture('foam');d.players[1].hp=2;d.players[1].poison=2;const n=attack(d);assert.equal(n.winner,0);assert.equal(n.phase,'over');
});
