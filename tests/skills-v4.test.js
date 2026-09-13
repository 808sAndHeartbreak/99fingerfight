import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand,legalCommands,synthesisOptions} from '../src/engine.js';
import {WEAPONS} from '../src/catalog.js';
import {phaseCue} from '../src/phase-cue.js';
import {describe} from '../src/info.js';
const run=(s,c)=>applyCommand(s,{actor:s.active,revision:s.revision,...c});
const fixture=(id)=>{const s=createGame(27);s.phase='action';s.players[0].weapon=id;s.players.forEach(p=>p.props=[]);return s;};
// These duration tests resolve skills after the turn's calculation.
const attack=s=>{const n=run({...s,calculated:true},{type:'attack'});if(n.winner!==null||n.active!==s.active)return n;const ended=run(n,{type:'end'});ended.events=[...n.events,...ended.events];return ended;};
const damageEvents=s=>s.events.filter(e=>e.type==='damage');
const cycle=s=>{while(s.active===1&&s.winner===null){const cs=legalCommands(s);s=run(s,cs.find(c=>c.type==='advance')||cs.find(c=>c.type==='decline')||cs.find(c=>c.type==='add')||cs[0]);}return s;};
test('20 skills are explicitly selectable only for their recipe, with dedicated image assets',()=>{
 assert.equal(WEAPONS.length,20);
 for(const w of WEAPONS){let s=run(createGame(),{type:'advance'});s.players[0].hands=[...w.recipe];assert.ok(synthesisOptions(s).some(o=>o.id===w.id));s=run(s,{type:'forge',weapon:w.id});assert.deepEqual(s.players[0].hands,w.recipe);assert.equal(s.players[0].weapon,w.id);assert.equal(describe('weapon:'+w.id,s).image,w.image);assert.equal(attack(s).players[0].weapon,null);}
});
test('ordinary single shield rounds up and is consumed; 55 remains indefinitely and follows digits',()=>{
 let s=fixture('scissors');s.players[1].hands=[5,0];let n=attack(s);assert.equal(n.players[1].hp,96);assert.deepEqual(n.players[1].hands,[0,9]);
 s=fixture('dragon');s.players[1].hands=[5,5];s.players[1].foam=2;n=attack(s);assert.equal(n.players[1].hp,99);assert.deepEqual(n.players[1].hands,[5,5]);assert.equal(n.players[1].foam,2);
 s.players[1].hands=[5,4];n=attack(s);assert.equal(n.players[1].foam,1);assert.deepEqual(n.players[1].hands,[5,4]);
 s.players[1].foam=0;n=attack(s);assert.equal(n.players[1].hp,74);assert.deepEqual(n.players[1].hands,[1,4]);
});
test('true damage preserves all defenses except serious punch, which removes all and skips self',()=>{
 for(const id of ['claw','sniper']){const s=fixture(id);s.players[1].hands=[5,5];s.players[1].foam=4;const n=attack(s);assert.equal(n.players[1].hp,id==='claw'?89:69);assert.deepEqual(n.players[1].hands,[5,5]);assert.equal(n.players[1].foam,4);}
 const s=fixture('serious');s.players[1].hands=[5,5];s.players[1].foam=4;const n=attack(s);assert.equal(n.players[1].hp,69);assert.deepEqual(n.players[1].hands,[1,1]);assert.equal(n.players[1].foam,0);assert.equal(n.players[0].skip,1);
 const back=cycle(n);assert.equal(back.skipping,true);assert.equal(back.players[0].skip,0);assert.equal(run(back,{type:'advance'}).active,1);
});
test('dual guns resolve four segments independently and refill; knuckles applies to every segment',()=>{
 for(const bonus of [false,true]){const s=fixture('dual');s.players[0].knuckles=bonus;s.players[1].hands=[5,3];s.players[1].foam=2;const n=attack(s);assert.deepEqual(damageEvents(n).map(e=>e.amount),bonus?[0,0,8,15]:[0,0,3,5]);assert.equal(n.players[1].foam,0);assert.equal(n.players[0].props.length,3);}
 const s=fixture('dual');s.players[1].hands=[5,5];assert.deepEqual(damageEvents(attack(s)).map(e=>e.amount),[0,0,0,0]);
});
test('zero damage never consumes defense, missing HP samples at attack, knuckles adds after sampling',()=>{
 const s=fixture('sorrow');s.players[1].hands=[5,1];s.players[1].foam=2;let n=attack(s);assert.equal(n.players[1].foam,2);assert.equal(n.players[1].hp,99);
 s.players[0].hp=79;s.players[1].foam=0;n=attack(s);assert.equal(n.players[1].hp,89);
 s.players[0].hp=99;s.players[0].knuckles=true;n=attack(s);assert.equal(n.players[1].hp,94);
});
test('buff stacking: foam adds charges, knuckles permanent stacking; true attack bonus excludes DOT and props',()=>{
 const s=fixture('foam');s.players[0].foam=1;assert.equal(attack(s).players[0].foam,3);
 const k=fixture('knuckles');k.players[0].knuckles=true;assert.equal(attack(k).players[0].knuckles,2);
 const t=fixture('sniper');t.players[0].knuckles=true;assert.equal(attack(t).players[1].hp,59);
 const d=fixture('seven');d.players[0].knuckles=true;assert.equal(attack(d).players[1].hp,92);
 const p=run(createGame(),{type:'advance'});p.players[0].knuckles=true;p.players[0].props=['ruin'];p.players[1].hands=[5,5];p.players[1].foam=2;const n=run(p,{type:'prop',slot:0,target:1});assert.equal(n.players[1].hp,91);assert.equal(n.players[1].foam,2);assert.deepEqual(n.players[1].hands,[5,5]);
});
test('seven injury runs for precisely seven target starts, repeats extend count, permanent DOT coexists',()=>{
 let s=fixture('seven');s.players[1].hands=[5,5];s.players[1].foam=2;s=attack(s);assert.equal(s.players[1].seven,6);assert.equal(s.players[1].hp,92);
 for(let i=1;i<8;i++){s=cycle(s);s.phase='action';s.players[0].weapon='foam';s=attack(s);}
 assert.equal(s.players[1].hp,50);assert.equal(s.players[1].seven,0);assert.equal(s.players[1].foam,2);
 s=fixture('seven');s.players[1].seven=3;s.players[1].dark=true;s=attack(s);assert.equal(s.players[1].seven,9);assert.equal(s.players[1].hp,87);assert.deepEqual(damageEvents(s).map(e=>e.source),['七伤拳','玄冥神掌']);
 s=fixture('dark');s.players[1].dark=true;assert.equal(attack(s).players[1].hp,94);
});
test('skip turns retain supply and DOT, decrement once, expire turn items; no action commands leak',()=>{
 let s=fixture('buddha');s.players[1].hands=[5,5];s.players[1].echo=true;s.players[1].mirror=true;s.players[1].silenced=true;s.players[1].seven=5;s.players[1].locks=[true,true];s=attack(s);
 assert.equal(s.skipping,true);assert.equal(s.players[1].skip,2);assert.deepEqual(s.players[1].hands,[1,1]);assert.equal(s.players[1].hp,92);assert.equal(s.players[1].props.length,1);assert.deepEqual(legalCommands(s).map(c=>c.type),['advance']);assert.match(phaseCue(null,s).title,/无法行动/);
 for(const c of [{type:'attack'},{type:'prop',slot:0,target:1},{type:'add',hand:0,targetHand:0}])assert.throws(()=>run(s,c));
 s=run(s,{type:'advance'});assert.equal(s.players[1].silenced,false);assert.equal(s.players[1].echo,false);assert.equal(s.players[1].mirror,false);assert.deepEqual(s.players[1].locks,[false,false]);
 for(let i=0;i<1;i++){s.phase='action';s.players[0].weapon='foam';s=attack(s);assert.equal(s.skipping,true);s=run(s,{type:'advance'});}
 s.phase='action';s.players[0].weapon='foam';s=attack(s);assert.equal(s.skipping,false);assert.equal(run(s,{type:'advance'}).phase,'action');
});
test('skip counters accumulate and blocked damage still applies digit changes, removal and skip',()=>{
 let s=fixture('taser');s.players[1].hands=[5,5];s.players[1].skip=2;let n=attack(s);assert.equal(n.players[1].hp,99);assert.equal(n.players[1].skip,4);
 s=fixture('scissors');s.players[1].hands=[5,5];n=attack(s);assert.deepEqual(n.players[1].hands,[4,4]);
 s=fixture('fan');s.players[1].hands=[5,5];s.players[1].props=['add','sub','lock'];n=attack(s);assert.equal(n.players[1].props.length,3);assert.ok(n.log.some(x=>x.includes('失去'))); // two remain, then target first-turn supply
 s.players[1].turns=1;n=attack(s);assert.equal(n.players[1].props.length,2);
 s.players[1].props=[];n=attack(s);assert.equal(n.players[1].props.length,0);
});
test('steal preserves own inventory first, discards overflow, does not copy digits, and transfers knuckles',()=>{
 for(const count of [0,2,3]){const s=fixture('steal');s.players[0].props=Array(count).fill('lock');s.players[1].props=['add','sub','double'];s.players[1].turns=1;s.players[1].hands=[5,5];s.players[1].locks=[true,true];s.players[1].knuckles=true;const n=attack(s);assert.deepEqual(n.players[0].props,[...Array(count).fill('lock'),...['add','sub','double'].slice(0,3-count)]);assert.deepEqual(n.players[1].props,[]);assert.deepEqual(n.players[0].hands,[1,1]);assert.deepEqual(n.players[0].locks,[false,false]);assert.equal(n.players[0].knuckles,1);}
});
test('unify cleanses debuffs and preserves marks, second mark forces win regardless of HP or defense',()=>{
 const s=fixture('unify');s.players[0].nine=1;s.players[0].hp=1;s.players[0].dark=true;s.players[1].hands=[5,5];s.players[1].foam=4;s.players[1].nine=1;const n=attack(s);assert.equal(n.winner,0);assert.equal(n.winReason,'九九归一');assert.equal(n.phase,'over');assert.equal(n.players[0].nine,2);assert.equal(n.players[1].nine,1);assert.equal(n.players[1].hp,99);assert.equal(n.players[1].foam,4);assert.equal(n.players[0].dark,false);assert.deepEqual(n.players.map(p=>p.hands),[[1,1],[1,1]]);assert.match(phaseCue(s,n).title,/九九归一/);assert.deepEqual(legalCommands(n),[]);
});
test('lethal segment or turn-start DOT ends immediately without another tick or stage',()=>{
 let s=fixture('dual');s.players[1].hp=4;let n=attack(s);assert.equal(n.winner,0);assert.equal(damageEvents(n).length,1);assert.equal(n.active,0);
 s=fixture('foam');s.players[1].hp=7;s.players[1].seven=3;s.players[1].dark=true;s.players[1].skip=2;n=attack(s);assert.equal(n.winner,0);assert.equal(n.phase,'over');assert.equal(damageEvents(n).length,1);assert.deepEqual(legalCommands(n),[]);
});
test('random attack has 5 to 10 discrete hits, exact replay, immutable input',()=>{
 const values=new Set();
 for(let seed=0;seed<1000;seed++){const s=fixture('drunken');s.rng=seed;const copy=structuredClone(s),n=attack(s);assert.deepEqual(s,copy);assert.deepEqual(attack(s),n);const hits=damageEvents(n);assert.ok(hits.length>=5&&hits.length<=10);assert.ok(hits.every(e=>e.raw===5));values.add(hits.length);}
 assert.equal(values.size,6);
});

test('claw has two true segments, each gets attack bonus and stops on lethal',()=>{
 let s=fixture('claw');s.players[0].knuckles=true;s.players[1].hands=[5,5];s.players[1].foam=2;
 let n=attack(s);assert.deepEqual(damageEvents(n).map(e=>e.amount),[15,15]);assert.equal(n.players[1].foam,2);assert.deepEqual(n.players[1].hands,[5,5]);
 s.players[1].hp=10;n=attack(s);assert.equal(damageEvents(n).length,1);assert.equal(n.winner,0);
});
