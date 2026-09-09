import test from 'node:test';
import assert from 'node:assert/strict';
import {shortName,normalizeParticipants} from '../src/identity.js';
import {LocalSession} from '../src/session.js';
import {createGame,applyCommand} from '../src/engine.js';
import {skillSummary} from '../src/presentation.js';
test('names count visible graphemes and preserve emoji families and normalized accents',()=>{
 const family='👨‍👩‍👧‍👦';
 assert.equal(shortName(family.repeat(11)),family.repeat(10));
 assert.equal(shortName('一二三四五六七八九十十一'),'一二三四五六七八九十');
 assert.equal(shortName('e\u0301'.repeat(11)),'é'.repeat(10));
 assert.equal(normalizeParticipants([{displayName:'\u202e'}])[0].displayName,'玩家一');
 const s=new LocalSession();s.rename(1,'对手的新名字十一十二十三');assert.equal(s.getParticipants()[1].displayName,shortName('对手的新名字十一十二十三'));assert.equal(s.getParticipants()[0].displayName,'玩家一');
});
test('skill totals count shielded hits, stop at lethal hits and exclude later turn damage',()=>{
 const s=createGame();s.phase='action';s.players[0].weapon='dual';s.players[1].foam=2;
 const c={type:'attack',actor:0,revision:s.revision};let n=applyCommand(s,c);
 assert.equal(skillSummary(s,n,c).hits,4);assert.equal(skillSummary(s,n,c).damage,10);
 n.events.push({type:'damage',owner:1,source:'七伤拳',amount:7});assert.equal(skillSummary(s,n,c).damage,10);
 s.players[1].foam=0;s.players[1].hp=3;n=applyCommand(s,c);assert.equal(skillSummary(s,n,c).hits,1);assert.equal(skillSummary(s,n,c).damage,3);
 s.players[0].weapon='foam';n=applyCommand(s,c);assert.equal(skillSummary(s,n,c).hits,0);assert.ok(skillSummary(s,n,c).effects.length);
});
