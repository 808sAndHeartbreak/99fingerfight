import test from 'node:test';
import assert from 'node:assert/strict';
import {TutorialSession,LESSONS} from '../src/tutorial.js';
import {createGame,applyCommand} from '../src/engine.js';
const send=s=>s.send({...s.guide.command,actor:s.state.active,revision:s.state.revision});
test('continuous attack tutorial follows real alternating turns and deterministic supply',async()=>{
 const s=new TutorialSession();assert.deepEqual(s.state.players.map(p=>p.hands),[[9,6],[5,5]]);
 await send(s);assert.deepEqual(s.state.players[0].hands,[4,6]);
 await assert.rejects(send(s),/图鉴/);assert.equal(s.inspect('recipe:6'),false);s.inspect('recipe:2');
 await send(s);assert.equal(s.state.active,1);await send(s);await send(s);
 assert.deepEqual(s.state.players.map(p=>p.hands),[[4,6],[1,5]]);
 await send(s);assert.equal(s.state.active,0);assert.deepEqual(s.state.players[0].props,['add']);await send(s);
 await send(s);assert.deepEqual(s.state.players[0].hands,[5,6]);await send(s);assert.deepEqual(s.state.players[0].hands,[6,6]);
 await send(s);assert.deepEqual(s.state.players[0].hands,[6,6]);await send(s);
 assert.ok(s.done);assert.equal(s.state.players[1].hp,84);assert.deepEqual(s.state.players.map(p=>p.hands),[[1,1],[1,1]]);assert.equal(s.state.winner,null);
});
test('special demonstration actually uses unify twice with an explicit narrated shortcut',async()=>{
 const s=new TutorialSession(1);await send(s);assert.deepEqual(s.state.players[0].hands,[9,9]);
 await send(s);await send(s);assert.equal(s.state.players[0].nine,1);assert.equal(s.state.winner,null);assert.deepEqual(s.state.players[0].hands,[1,1]);
 assert.equal(s.guide.command.type,'demo');assert.match(s.guide.detail,/跳过积攒数字/);
 await send(s);assert.deepEqual(s.state.players[0].hands,[9,9]);assert.equal(s.state.players[0].nine,1);
 await send(s);await send(s);assert.ok(s.done);assert.equal(s.state.players[0].nine,2);assert.equal(s.state.winReason,'九九归一');assert.equal(s.state.players[1].hp,99);
});
test('wrong targets and stale commands cannot skip the continuous guidance',async()=>{
 const s=new TutorialSession(),before=s.getSnapshot();
 await assert.rejects(s.send({type:'add',hand:0,targetHand:1,actor:0,revision:0}));assert.deepEqual(s.getSnapshot(),before);
 await assert.rejects(s.send({type:'add',hand:0,targetHand:0,actor:0,revision:99}));assert.equal(s.step,0);
 await send(s);s.inspect('recipe:2');await send(s);
 await assert.rejects(s.send({type:'add',hand:0,targetHand:1,actor:1,revision:s.state.revision}));
});
test('retry is isolated and tutorial shortcuts never enter normal game rules',async()=>{
 const s=new TutorialSession(1),fresh=new TutorialSession(1);await send(s);s.dispose();await assert.rejects(send(s),/关闭/);
 assert.deepEqual(fresh.state.players[0].hands,[8,9]);assert.equal(fresh.state.players[0].nine,0);
 const normal=createGame();assert.deepEqual(normal.players[0].hands,[1,1]);assert.throws(()=>applyCommand(normal,{type:'demo',actor:0,revision:0}),/未知指令/);
 assert.equal(LESSONS.length,2);
});
