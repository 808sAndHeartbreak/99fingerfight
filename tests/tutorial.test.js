import test from 'node:test';
import assert from 'node:assert/strict';
import {TutorialSession,LESSONS} from '../src/tutorial.js';
import {createGame} from '../src/engine.js';
import {menuMarkup} from '../src/menu.js';
const send=(s,c)=>s.send({...c,actor:s.getSnapshot().active,revision:s.getSnapshot().revision});
test('all practice steps execute real rules and reach both victory conditions',async()=>{
  for(let chapter=0;chapter<LESSONS.length;chapter++){
    const s=new TutorialSession(chapter);
    for(const step of s.lesson.steps)await send(s,step.command);
    assert.ok(s.done);
    const result=s.getSnapshot();
    if(chapter===0){assert.equal(result.players[0].hands[0],2);assert.equal(result.active,1);}
    else if(chapter!==2)assert.equal(result.winner,0);
    if(chapter===2){assert.equal(result.players[1].hp,84);assert.equal(result.active,1);}
    if(chapter===1)assert.equal(result.players[1].hp,0);
    if(chapter===3){assert.equal(result.players[0].nine,2);assert.equal(result.winReason,'九九归一');assert.equal(result.players[1].hp,99);}
  }
});
test('wrong actions and stale duplicate clicks never advance a practice checkpoint',async()=>{
  const s=new TutorialSession(1),before=s.getSnapshot();
  await assert.rejects(send(s,{type:'advance'}));
  await assert.rejects(send(s,{type:'prop',slot:0,target:1,targetHand:0}));
  assert.deepEqual(s.getSnapshot(),before);assert.equal(s.step,0);
  await send(s,s.guide.command);
  await assert.rejects(s.send({type:'advance',actor:0,revision:0}));
  assert.equal(s.step,1);
});
test('retries are fresh, snapshots isolated, disposed sessions reject and normal setup stays unchanged',async()=>{
  const first=new TutorialSession(2),fresh=new TutorialSession(2);
  const snapshot=first.getSnapshot();snapshot.players[0].hp=0;
  await send(first,first.guide.command);first.dispose();
  await assert.rejects(send(first,{type:'forge',weapon:'unify'}));
  assert.equal(fresh.step,0);assert.equal(fresh.getSnapshot().players[0].hp,99);
  assert.deepEqual(createGame().players[0].hands,[1,1]);assert.equal(createGame().players[0].nine,0);
  assert.match(menuMarkup('home'),/data-tutorial/);
  assert.match(menuMarkup('play'),/本地对战/);assert.match(menuMarkup('play'),/联机对战/);
});

test('both opposing tutorial hands accept the touch and reach the same checkpoint',async()=>{
 for(const targetHand of [0,1]){
  const s=new TutorialSession(0);await send(s,{type:'advance'});
  await send(s,{type:'add',hand:0,targetHand});
  assert.equal(s.done,true);assert.deepEqual(s.getSnapshot().players[0].hands,[2,1]);
 }
});
