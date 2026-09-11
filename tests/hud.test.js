import test from 'node:test';
import assert from 'node:assert/strict';
import {describe} from '../src/info.js';
import {createGame,applyCommand} from '../src/engine.js';
import {phaseCue} from '../src/phase-cue.js';
import {presentationDuration} from '../src/presentation.js';
test('hover arithmetic belongs to the item owner and respects HP and inventory caps',()=>{
 const s=createGame();s.active=0;s.players[0].hands=[1,2];s.players[1].hands=[8,9];s.players[1].hp=97;s.players[1].props=['grace','boon','greed'];
 assert.match(describe('prop:grace:1',s).body,/当前回复 2，数字总和 17/);
 assert.match(describe('prop:ruin:1',s).body,/当前伤害 3/);
 assert.match(describe('prop:greed:1',s).body,/当前获得 1 个/);
 assert.match(describe('prop:boon:1',s).body,/己方补 1 个/);
 s.players[1].hp=80;assert.match(describe('prop:grace:1',s).body,/当前回复 17/);
});
test('turn introduction and item receipts retain their presentation durations',()=>{
 const s=createGame();assert.equal(phaseCue(null,s).duration,1400);
 s.phase='action';s.players[0].props=['grace'];const c={type:'prop',slot:0,target:0,actor:0,revision:s.revision};const next=applyCommand(s,c);
 assert.equal(presentationDuration(s,next,c),2600);
 assert.match(describe('supply:1',s).body,/将在 1 个己方回合开始时获得一个随机道具/);
});

import {MatchHub} from '../server/hub.js';
import {ITEM_NOTICE_MS,ITEM_SETTLE_MS} from '../src/presentation.js';
test('server preserves item presentation without resetting the turn clock',()=>{
 const s=createGame();s.phase='action';s.players[0].hands=[1,2];s.players[0].props=['add'];
 const room={state:s,status:'playing',readyAt:1000,deadlineAt:21000};const hub=new MatchHub({now:()=>1000});
 hub.step(room,{type:'prop',slot:0,target:0,targetHand:0,actor:0,revision:s.revision});
 assert.equal(room.readyAt,1000+ITEM_NOTICE_MS+ITEM_SETTLE_MS);assert.equal(room.deadlineAt,room.readyAt+20000);assert.deepEqual(room.state.players[0].hands,[2,2]);assert.equal(room.state.phase,'action');
});
