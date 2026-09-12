import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalSession} from '../src/session.js';
import {createGame,applyCommand,canEndTurn,emptyTurnPenalty} from '../src/engine.js';
import {chooseCommand} from '../src/ai.js';
import {TutorialSession} from '../src/tutorial.js';
test('manual early end is allowed, replayable, and unavailable while a skill awaits release',async()=>{
 const session=new LocalSession(17);
 const send=c=>session.send({...c,actor:session.getSnapshot().active,revision:session.getSnapshot().revision});
 await send({type:'advance'});assert.ok(canEndTurn(session.getSnapshot()));
 await send({type:'end'});assert.equal(session.getSnapshot().active,1);
 assert.deepEqual(LocalSession.restore(session.exportSave()).getSnapshot(),session.getSnapshot());
 const s=createGame();s.phase='action';s.players[0].weapon='frag';assert.equal(canEndTurn(s),false);
});
test('all AI levels calculate against zero when it avoids an empty-turn penalty',()=>{
 for(const level of ['easy','advanced','master'])for(const hands of [[0,0],[0,1],[1,0]]){
  const s=createGame();s.phase='action';s.players[0].props=[];s.players[0].hands=[3,6];s.players[1].hands=hands;
  const c=chooseCommand(s,level);assert.ok(c);
  assert.equal(c.type,'add');assert.equal(emptyTurnPenalty(applyCommand(s,c)),0);
 }
});
test('zero remains a useful echo target when it copies a winning combination',()=>{
 const s=createGame();s.phase='action';s.players[0].hands=[9,3];s.players[0].echo=true;s.players[0].nine=1;s.players[1].hands=[0,0];
 for(const level of ['advanced','master']){const c=chooseCommand(s,level);assert.equal(c.type,'add');assert.equal(c.hand,0);assert.deepEqual(applyCommand(s,c).players[0].hands,[9,9]);}
});
test('special tutorial accepts either opposing one',async()=>{
 for(const targetHand of [0,1]){const s=new TutorialSession(1);await s.send({type:'add',hand:0,targetHand,actor:0,revision:0});assert.deepEqual(s.state.players[0].hands,[9,9]);}
});
