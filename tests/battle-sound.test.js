import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleSound} from '../src/battle-sound.js';
test('battle sounds cover event families and effects mute creates no audible nodes',()=>{
 const previous=globalThis.window;let nodes=0,starts=0,enabled=true;
 const param=()=>({setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}});
 const node=()=>{nodes++;return {gain:param(),frequency:param(),connect(){},disconnect(){},start(){starts++;},stop(){}};};
 class Context{state='running';currentTime=0;sampleRate=8000;destination={};createGain(){return node();}createOscillator(){return node();}createBufferSource(){return node();}createBiquadFilter(){return node();}createBuffer(ch,n){return {getChannelData:()=>new Float32Array(n)};}}
 globalThis.window={AudioContext:Context};
 try{const settings={values:{effects:0},unlock(){}},sound=createBattleSound(()=>enabled,settings);
  sound.play('punch');assert.equal(nodes,0);settings.values.effects=.5;
  for(const family of ['release','item','heal','turn','guard','charge','nine','victory','punch','slash','gun','curse','bolt'])sound.play(family);
  assert.equal(starts,13);const before=nodes;enabled=false;sound.play('victory');assert.equal(nodes,before);
 }finally{globalThis.window=previous;}
});
