import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand,legalCommands} from '../src/engine.js';
import {chooseCommand} from '../src/ai.js';

function ready() {
 const s=createGame(17);s.phase='action';s.players.forEach(p=>{p.props=[];p.turns=2;});return s;
}
const run=(s,c)=>applyCommand(s,{...c,actor:s.active,revision:s.revision});
function finishAttack(s,c) {let n=run(s,c);if(n.winner===null&&n.players[n.active].weapon)n=run(n,{type:'attack'});return n;}

for(const level of ['easy','advanced','master'])test(`${level} uses an available lethal skill instead of wasting a ready pair`,()=>{
 const s=ready();s.players[0].hands=[2,2];s.players[1].hp=5;
 const c=chooseCommand(s,level);assert.equal(c.type,'forge');assert.equal(finishAttack(s,c).winner,0);
});

test('master prevents next-turn second unification instead of conceding the turn',()=>{
 let s=ready();s.calculated=s.acted=true;s.players[0].props=['sub'];s.players[1].hands=[8,9];s.players[1].nine=1;
 const before=structuredClone(s),c=chooseCommand(s,'master');assert.equal(c.type,'prop');assert.deepEqual(s,before);
 s=run(s,c);s=run(s,{type:'end'});s=run(s,{type:'advance'});
 // Exhaust the opponent's calculation -> skill wins; do not mirror AI scoring.
 for(const move of legalCommands(s)) {
  const next=finishAttack(s,move);assert.notEqual(next.winner,1);
  if(next.active===1&&next.winner===null)for(const second of legalCommands(next))assert.notEqual(finishAttack(next,second).winner,1);
 }
});

test('master finds a multi-item second-unification route and ignores secret draws',()=>{
 let s=ready();s.players[0].hands=[7,3];s.players[0].nine=1;s.players[0].props=['add','echo'];s.players[1].hands=[1,1];
 for(let i=0;i<5&&s.winner===null;i++) {
  const before=structuredClone(s),c=chooseCommand(s,'master');
  assert.deepEqual(c,chooseCommand({...s,rng:0xfedcba98},'master'));assert.deepEqual(s,before);
  s=finishAttack(s,c);assert.equal(s.active,0);
 }
 assert.equal(s.winner,0);
});

test('master does not spend healing or damage items with no effect',()=>{
 const s=ready();s.calculated=s.acted=true;s.players[0].props=['grace','ruin'];
 assert.equal(chooseCommand(s,'master').type,'end');
});
