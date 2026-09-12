import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalSession} from '../src/session.js';
import {createGame,applyCommand,canEndTurn,legalCommands} from '../src/engine.js';
import {chooseCommand} from '../src/ai.js';
const run=(s,c)=>applyCommand(s,{...c,actor:s.active,revision:s.revision});
test('manual end remains available before and after a skill under the revised rules',()=>{
 let s=run(createGame(),{type:'advance'});s.players[0].hands=[2,2];
 assert.equal(canEndTurn(s),true);s=run(run(s,{type:'forge',weapon:'scissors'}),{type:'attack'});assert.equal(canEndTurn(s),true);
 s=run(s,{type:'add',hand:0,targetHand:0});assert.equal(canEndTurn(s),true);
 s.calculated=false;s.players[1].locks=[true,true];assert.equal(canEndTurn(s),true);
 for(const level of ['easy','advanced','master']){s.players[1].locks=[false,false];const c=chooseCommand(s,level);assert.ok(legalCommands(s).some(x=>JSON.stringify(x)===JSON.stringify(c)));}
});
test('manual early end remains replayable',async()=>{
 const session=new LocalSession(17);const send=(c,options)=>session.send({...c,actor:session.getSnapshot().active,revision:session.getSnapshot().revision},options);
 await send({type:'advance'});
 await send({type:'end'});assert.equal(session.getSnapshot().active,1);
 assert.deepEqual(LocalSession.restore(session.exportSave()).getSnapshot(),session.getSnapshot());
});
