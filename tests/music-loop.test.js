import test from 'node:test';
import assert from 'node:assert/strict';
import {createAudioSettings} from '../src/audio-settings.js';

test('decoded music loops once, fades and resumes position without duplicate sources',async()=>{
 const keys=['Audio','window','document','localStorage','fetch'],saved=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 const events={},sources=[],ramps=[];let context,requests=0,media,decode;
 class Context{
  currentTime=0;destination={};
  constructor(){context=this;}
  resume(){return Promise.resolve();}
  createGain(){return {connect(){},gain:{value:0,setValueAtTime(){},cancelScheduledValues(){},setTargetAtTime(v,t,tau){ramps.push([v,tau]);}}};}
  decodeAudioData(){return new Promise(resolve=>decode=resolve);}
  createBufferSource(){const source={connect(){},disconnect(){},start(t,offset){this.offset=offset;},stop(){this.stopped=true;}};sources.push(source);return source;}
 }
 globalThis.Audio=class{constructor(){media=this;this.paused=true;this.currentTime=0;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}};
 globalThis.window={AudioContext:Context};globalThis.document={hidden:false,addEventListener:(event,fn)=>events[event]=fn};
 globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.fetch=async()=>{requests++;return {ok:true,arrayBuffer:async()=>new ArrayBuffer(1)}};
 try{
  const audio=createAudioSettings('/music.mp3');audio.unlock();await new Promise(r=>setTimeout(r,0));
  assert.equal(media.paused,false,'streaming starts without waiting for the entire buffer');assert.equal(sources.length,0);
  decode({duration:137.142857});await new Promise(r=>setTimeout(r,0));assert.equal(media.paused,true,'stream stops when seamless buffer takes over');
  assert.equal(requests,1);assert.equal(sources.length,1);assert.equal(sources[0].loop,true);assert.equal(sources[0].offset,0);
  context.currentTime=150;audio.unlock();audio.set('effects',.8);assert.equal(sources.length,1);
  document.hidden=true;events.visibilitychange();assert.equal(ramps.at(-1)[0],0);
  await new Promise(r=>setTimeout(r,310));assert.equal(sources[0].stopped,true);
  document.hidden=false;events.visibilitychange();assert.equal(sources.length,2);assert.ok(Math.abs(sources[1].offset-12.857143)<.00001);assert.deepEqual(ramps.at(-1),[.084,.015]);
  audio.set('music',0);audio.set('music',.5);await new Promise(r=>setTimeout(r,310));assert.equal(sources[1].stopped,undefined);assert.equal(sources.length,2);
 }finally{for(const k of keys)if(saved[k]===undefined)delete globalThis[k];else globalThis[k]=saved[k];}
});
