import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioSettings} from '../src/audio-settings.js';
import {describe} from '../src/info.js';
import {createGame} from '../src/engine.js';
import {WEAPONS} from '../src/catalog.js';

test('quiet default music preserves explicit saved volume including mute',()=>{
 const previous={Audio:globalThis.Audio,localStorage:globalThis.localStorage,document:globalThis.document};let stored=null;
 class FakeAudio{dataset={};play(){return Promise.resolve();}pause(){}}
 globalThis.Audio=FakeAudio;globalThis.document={body:{append(){}},addEventListener(){},hidden:false};
 globalThis.localStorage={getItem:()=>stored,setItem:(k,v)=>{stored=v;}};
 try{const fresh=createAudioSettings('music');assert.equal(fresh.values.music,.5);assert.equal(fresh.values.effects,.5);
 fresh.set('music',.8);assert.equal(createAudioSettings('music').values.music,.8);
 fresh.set('music',0);assert.equal(createAudioSettings('music').values.music,0);
 stored='invalid';assert.equal(createAudioSettings('music').values.music,.5);
 }finally{Object.assign(globalThis,previous);}
});
test('each recipe detail exposes every matching skill with its own art and full effect',()=>{
 const s=createGame();for(const n of new Set(WEAPONS.flatMap(w=>w.recipe))){const d=describe(`recipe:${n}`,s),expected=WEAPONS.filter(w=>w.recipe.every(x=>x===n));assert.deepEqual(d.options,expected);for(const option of d.options){assert.ok(option.image);assert.ok(option.detail);assert.match(d.body,new RegExp(option.name));}}
 assert.equal(describe('recipe:3',s),null);assert.equal(describe('recipe:5',s).options.length,4);
});
