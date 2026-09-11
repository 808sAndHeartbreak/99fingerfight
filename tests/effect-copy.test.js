import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand} from '../src/engine.js';
import {effectDetail,defenseDetail} from '../src/effect-copy.js';
import {skillSummary,actionDuration} from '../src/presentation.js';
import {historyMarkup} from '../src/match-history.js';
const run=(s,c)=>applyCommand(s,{...c,actor:s.active,revision:s.revision});
const fixture=id=>{const s=run(createGame(),{type:'advance'});s.players[0].weapon=id;return s;};
test('enemy effects name their recipient and explain how the next turns are affected',()=>{
 for(const [id,re] of [['seven',/红方每回合开始受到 7 点真实伤害/],['dark',/红方每回合开始受到 5 点真实伤害/],['serpent',/红方虚弱.*中毒/],['foam',/蓝方盾墙.*2 次普通伤害/],['taser',/红方跳过接下来 3 个回合/]]){
  const s=fixture(id),n=run(s,{type:'attack'});assert.match(effectDetail(s,n,{type:'attack'}),re);assert.ok(n.log.some(l=>re.test(l)));
 }
});
test('blocked damage stays explained in the final summary and history',()=>{
 const s=fixture('frag');s.players[1].hands=[5,1];const n=run(s,{type:'attack'}),summary=skillSummary(s,n,{type:'attack'});
 assert.equal(summary.damage,15);assert.ok(summary.effects.some(x=>x.includes('减半')));assert.ok(n.log.some(x=>x.includes('格挡后变为 [1]')));assert.equal(actionDuration(s,n,{type:'attack'}),3650);
 assert.match(defenseDetail({blocked:'绝对防御'}),/数字不变/);
});
test('lethal scissors never claims an unapplied secondary effect',()=>{
 const s=fixture('scissors');s.players[1].hp=1;const n=run(s,{type:'attack'});assert.equal(effectDetail(s,n,{type:'attack'}),'');assert.deepEqual(n.players[1].hands,[1,1]);
});
test('history omits a completed forge preamble, includes effect and reset, and distinguishes same nicknames',()=>{
 let s=run(createGame(),{type:'advance'});s.players[0].hands=[2,2];s=run(run(s,{type:'forge',weapon:'scissors'}),{type:'attack'});
 const html=historyMarkup(s.log,[{displayName:'同名'},{displayName:'同名'}]);assert.doesNotMatch(html,/即将释放/);assert.match(html,/同名（蓝方）/);assert.match(html,/同名（红方）/);assert.match(html,/\[0\] \/ \[0\]/);assert.match(html,/双手归 \[1\]/);
});
test('prop history explains silence, actual hand changes, and combined mirror-echo recipient',()=>{
 let s=run(createGame(),{type:'advance'});s.players[0].props=['silence','add','echo'];s.players[0].mirror=true;
 s=run(s,{type:'prop',slot:0,target:1});assert.ok(s.log.some(x=>x.includes('红方下个回合不能使用道具')));
 s=run(s,{type:'prop',slot:0,target:1,targetHand:0});assert.ok(s.log.some(x=>x.includes('红方左手 [1] → [2]')));
 s=run(s,{type:'prop',slot:0,target:0});assert.ok(s.log.some(x=>x.includes('写入红方双手')));
});
