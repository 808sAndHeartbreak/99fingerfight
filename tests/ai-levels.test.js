import test from 'node:test';import assert from 'node:assert/strict';
import {AI_LEVELS,chooseCommand} from '../src/ai.js';import {LocalSession} from '../src/session.js';import {matchSettings} from '../src/match-settings.js';import {createGame,legalCommands} from '../src/engine.js';
test('all four tiers appear in settings and survive save restoration',()=>{
 assert.deepEqual(Object.values(AI_LEVELS),['简单','进阶','高手','大师']);
 for(const difficulty of Object.keys(AI_LEVELS)){
  const session=new LocalSession(17,{difficulty});assert.equal(LocalSession.restore(session.exportSave()).difficulty,difficulty);
  assert.ok(matchSettings({difficulty}).includes(`data-value="${difficulty}" aria-pressed="true"`));
 }
});
for(const level of Object.keys(AI_LEVELS))test(`${level} uses legal commands without reading actual draws or mutating state`,()=>{
 for(const itemsEnabled of [true,false]){
  const s=createGame(987,{itemsEnabled});s.phase='action';s.players[0].hands=[4,6];const before=structuredClone(s);
  const c=chooseCommand(s,level);assert.ok(legalCommands(s).some(x=>JSON.stringify(x)===JSON.stringify(c)));
  assert.deepEqual(c,chooseCommand({...s,rng:4},level));assert.deepEqual(s,before);
 }
});
