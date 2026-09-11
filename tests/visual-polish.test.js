import test from 'node:test';
import assert from 'node:assert/strict';
import {historyMarkup} from '../src/match-history.js';
import {createAudioSettings} from '../src/audio-settings.js';
test('record groups same-round entries, keeps item damage together and escapes names',()=>{
 const html=historyMarkup(['[回合 1] 蓝方使用「破坏」。','[回合 1] 破坏对红方造成 2 点真实伤害。','[回合 1] 蓝方计算：1 + 2 → 3。','[回合 2] 红方使用「增幅」。'],[{displayName:'<小蓝>'},{displayName:'小红'}]);
 assert.equal((html.match(/<h3>回合 1<\/h3>/g)||[]).length,1);assert.ok(html.includes('&lt;小蓝&gt;'));assert.ok(html.indexOf('回合 2')<html.indexOf('回合 1'));assert.match(html,/破坏对小红（红方）<em/);assert.doesNotMatch(html,/<b>道具<\/b>/);
});
test('audio defaults, independent controls, mute, hidden pause and stored settings',()=>{
 const saved={Audio:globalThis.Audio,document:globalThis.document,localStorage:globalThis.localStorage};let media;const events={};let stored=null;
 globalThis.Audio=class {constructor(){media=this;this.dataset={};}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}};
 globalThis.document={hidden:false,body:{append(){}},addEventListener:(event,fn)=>events[event]=fn};globalThis.localStorage={getItem:()=>stored,setItem:(key,value)=>{stored=value;}};
 try {const audio=createAudioSettings('/test.mp3');assert.deepEqual(audio.values,{music:.5,effects:.5});assert.equal(media.loop,true);audio.unlock();assert.equal(media.paused,false);audio.set('effects',0);assert.equal(audio.values.music,.5);audio.set('music',0);assert.equal(media.paused,true);audio.set('music',.2);assert.equal(media.volume,.05600000000000001);document.hidden=true;events.visibilitychange();assert.equal(media.paused,true);assert.equal(JSON.parse(stored).music,.2);}finally{Object.assign(globalThis,saved);}
});
test('record combines identical consecutive hits without merging different defenses',()=>{
 const html=historyMarkup(['[回合 1] 蓝方发动「醉拳」。',...Array(5).fill('[回合 1] 醉拳对红方造成 5 点普通伤害。'),'[回合 1] 醉拳对红方造成 0 点普通伤害（盾墙）。'],[]);
 assert.match(html,/HP−25<\/em> · 5击/);assert.match(html,/HP−0<\/em>（盾墙）/);
});
