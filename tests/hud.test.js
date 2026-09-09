import test from 'node:test';
import assert from 'node:assert/strict';
import {describe} from '../src/info.js';
import {createGame,applyCommand} from '../src/engine.js';
import {turnSteps,phaseCue} from '../src/phase-cue.js';
import {presentationDuration} from '../src/presentation.js';
test('hover arithmetic belongs to the item owner and respects HP and inventory caps',()=>{
 const s=createGame();s.active=0;s.players[0].hands=[1,2];s.players[1].hands=[8,9];s.players[1].hp=97;s.players[1].props=['grace','boon','greed'];
 assert.match(describe('prop:grace:1',s).body,/当前回复 2，数字总和 17/);
 assert.match(describe('prop:ruin:1',s).body,/当前伤害 3/);
 assert.match(describe('prop:greed:1',s).body,/当前获得 1 个/);
 assert.match(describe('prop:boon:1',s).body,/己方补 1 个/);
 s.players[1].hp=80;assert.match(describe('prop:grace:1',s).body,/当前回复 17/);
});
test('only two phases are visible and item receipts finish before the next interaction',()=>{
 const s=createGame();assert.deepEqual(turnSteps(s).map(x=>x.id),['planning','action']);assert.equal(phaseCue(null,s).duration,1400);
 s.phase='planning';s.players[0].props=['grace'];const c={type:'prop',slot:0,target:0,actor:0,revision:s.revision};const next=applyCommand(s,c);
 assert.equal(presentationDuration(s,next,c),1780);
 assert.match(describe('supply:1',s).body,/将在 1 回合后的开始阶段获得一个随机道具/);
});

import {MatchHub} from '../server/hub.js';
import {ITEM_NOTICE_MS,ITEM_SETTLE_MS} from '../src/presentation.js';
test('server preserves the item receipt and settle window before empty inventory advances',()=>{
 const s=createGame();s.phase='planning';s.players[0].hands=[1,2];s.players[0].props=['add'];
 const room={state:s,status:'playing',readyAt:1000,deadlineAt:21000};const hub=new MatchHub({now:()=>1000});
 hub.step(room,{type:'prop',slot:0,target:0,targetHand:0,actor:0,revision:s.revision});
 assert.equal(room.readyAt,1000+ITEM_NOTICE_MS+ITEM_SETTLE_MS);assert.equal(room.deadlineAt,room.readyAt+1000);assert.deepEqual(room.state.players[0].hands,[2,2]);assert.equal(room.state.phase,'planning');
});
