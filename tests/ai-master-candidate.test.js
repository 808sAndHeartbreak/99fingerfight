import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand,legalCommands} from '../src/engine.js';
import {chooseMasterCommand} from '../experiments/ai-master-candidate.js';
const ready=()=>{const s=createGame(37);s.phase='action';s.players.forEach(p=>{p.props=[];p.turns=2;});return s;};
const run=(s,c)=>applyCommand(s,{...c,actor:s.active,revision:s.revision});
test('experimental master finds wine into sniper lethal without reading live RNG',()=>{
 let s=ready();s.players[0].hands=[8,8];s.players[0].props=['wine'];s.players[1].hp=40;
 const before=structuredClone(s),c=chooseMasterCommand(s);
 assert.deepEqual(c,chooseMasterCommand({...s,rng:123456}));assert.deepEqual(s,before);
 assert.equal(c.type,'prop');s=run(s,c);const forge=chooseMasterCommand(s);assert.equal(forge.weapon,'sniper');
 s=run(s,forge);s=run(s,{type:'attack'});assert.equal(s.winner,0);
});
test('experimental master prevents opponent next-turn second unification',()=>{
 let s=ready();s.calculated=s.acted=true;s.players[0].props=['sub'];s.players[1].hands=[8,9];s.players[1].nine=1;
 const c=chooseMasterCommand(s);assert.equal(c.type,'prop');s=run(s,c);s=run(s,{type:'end'});s=run(s,{type:'advance'});
 for(const move of legalCommands(s).filter(c=>c.type==='add')){
  const n=run(s,move);assert.ok(!legalCommands(n).some(c=>c.type==='forge'&&c.weapon==='unify'));
 }
});
test('experimental master respects no-effect items and avoids empty-turn death',()=>{
 const s=ready();s.calculated=s.acted=true;s.players[0].props=['grace','ruin'];assert.equal(chooseMasterCommand(s).type,'end');
 const z=ready();z.players[0].hands=[3,6];z.players[0].hp=5;z.players[1].hands=[0,0];assert.equal(chooseMasterCommand(z).type,'add');
});
