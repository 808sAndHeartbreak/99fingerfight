import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createFeedback} from '../src/feedback.js';

test('reduced motion removes movement while preserving time to read phases and damage',async()=>{
  const previous=globalThis.matchMedia;
  globalThis.matchMedia=()=>({matches:true});
  try {
    let recorded;
    const el={animate(frames,options){recorded={frames,options};return {finished:Promise.resolve(),cancel(){}};}};
    const feedback=createFeedback();
    await feedback.animate(el,[{opacity:0,transform:'scale(2)',translate:'0 8px'},{opacity:1,scale:1,rotate:'8deg'}],{duration:2200,fill:'both'}).finished;
    assert.deepEqual(recorded.frames,[{opacity:0},{opacity:1}]);
    assert.equal(recorded.options.duration,2200);
    await feedback.animate(el,[{opacity:1},{opacity:1}],{duration:900}).finished;
    assert.equal(recorded.options.duration,900);
    feedback.reset();
  } finally {globalThis.matchMedia=previous;}
});
test('cleaned Unity runtime manifest retains only available game assets',()=>{
  const manifest=JSON.parse(readFileSync(new URL('../public/assets/manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.length,14);
  for(const entry of manifest)assert.ok(existsSync(new URL('../public/'+entry.output,import.meta.url)),entry.output);
  assert.ok(!existsSync(new URL('../public/assets/ink/',import.meta.url)));
});
