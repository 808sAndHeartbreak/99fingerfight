import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,applyCommand} from '../src/engine.js';
import {beforeSupply,hasSupply,presentationDuration,actionDuration,SUPPLY_REVEAL_MS} from '../src/presentation.js';
import {phaseCue} from '../src/phase-cue.js';
import {historyText,historyMarkup} from '../src/match-history.js';
import {MatchHub} from '../server/hub.js';
const run=(s,c)=>applyCommand(s,{actor:s.active,revision:s.revision,...c});

test('turn supply stays authoritative but is withheld from the pre-handoff visual snapshot',()=>{
 const old=run(createGame(6),{type:'advance'});old.calculated=true;
 const next=run(old,{type:'end'}),saved=structuredClone(next),visual=beforeSupply(next);
 assert.equal(next.active,1);assert.equal(hasSupply(next),true);
 assert.equal(visual.players[1].props.length,0);assert.equal(next.players[1].props.length,1);
 assert.deepEqual(visual.players[0],next.players[0]);assert.deepEqual(next,saved);
 assert.equal(presentationDuration(old,next,{type:'end'}),actionDuration(old,next,{type:'end'})+phaseCue(old,next).duration+SUPPLY_REVEAL_MS);
 const h=new MatchHub({now:()=>10000}),r={state:old,status:'playing',readyAt:0,deadlineAt:20000};
 h.step(r,{type:'end',actor:old.active,revision:old.revision});
 assert.equal(r.readyAt,10000+presentationDuration(old,r.state,{type:'end'}));
 assert.equal(r.deadlineAt,r.readyAt); // start state advances only after the complete visual window
});

test('duplicate items and item-generated draws are not confused with turn supply',()=>{
 const s=createGame();s.players[0].props=['add','add','wine'];
 s.events=[{type:'draw',owner:0,item:'add',source:'回合补给'},{type:'draw',owner:0,item:'wine',source:'道具效果'}];
 assert.deepEqual(beforeSupply(s).players[0].props,['add','wine']);
 s.events=s.events.slice(1);assert.equal(hasSupply(s),false);assert.deepEqual(beforeSupply(s),s);
});

test('copied history retains full chronological effect text and safe display markup',()=>{
 const log=['[回合 1] 蓝方使用「增幅」：任意一只手数字 +1。','[回合 1] 蓝方计算：[2] + [1] → [3]。','[回合 2] 红方空过扣除 10 HP。'];
 const names=[{displayName:'<蓝>'},{displayName:'红✨'}],text=historyText(log,names);
 assert.ok(text.indexOf('使用')<text.indexOf('计算'));assert.match(text,/任意一只手数字 \+1/);assert.match(text,/<蓝>（蓝方）/);
 const html=historyMarkup(log,names);assert.match(html,/data-copy-history/);assert.doesNotMatch(html,/<蓝>/);assert.match(html,/&lt;蓝&gt;/);
});
