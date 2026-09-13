export function createAudioSettings(url) {
 const values={music:.3,effects:.5};
 try{const saved=JSON.parse(localStorage.getItem('ff-audio')||'null');for(const k of Object.keys(values))if(Number.isFinite(saved?.[k]))values[k]=Math.max(0,Math.min(1,saved[k]));}catch{}
 let unlocked=false,ctx,gain,buffer,source,loading,stopTimer,offset=0,startedAt=0,failed=false;
 const fallback=new Audio(url);fallback.loop=true;fallback.preload='auto';
 function volume(){return values.music*.28;}
 function pause(){
  clearTimeout(stopTimer);
  if(!source)return;
  const playing=source;
  gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(0,ctx.currentTime,.07);
  stopTimer=setTimeout(()=>{if(source!==playing)return;offset=(offset+ctx.currentTime-startedAt)%buffer.duration;playing.stop();playing.disconnect();source=null;},280);
 }
 function resume(){
  clearTimeout(stopTimer);
  const audible=unlocked&&!document.hidden&&values.music>0;
  // Stream immediately after the first gesture while the seamless buffer decodes.
  if(failed||!buffer){fallback.volume=volume();if(audible&&fallback.paused!==false)fallback.play().catch(()=>{});else if(!audible)fallback.pause();return;}
  if(!audible){pause();return;}
  if(!ctx||!buffer)return;
  ctx.resume().catch(()=>{});
  if(!source){source=ctx.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(gain);gain.gain.setValueAtTime(volume(),ctx.currentTime);source.start(0,offset);startedAt=ctx.currentTime;}
  gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(volume(),ctx.currentTime,.015);
 }
 function unlock(){
  unlocked=true;
  if(!loading&&!failed){
   try{ctx=new (window.AudioContext||window.webkitAudioContext)();gain=ctx.createGain();gain.gain.value=0;gain.connect(ctx.destination);ctx.resume().catch(()=>{});
    loading=fetch(url).then(r=>{if(!r.ok)throw Error('BGM unavailable');return r.arrayBuffer();}).then(data=>ctx.decodeAudioData(data)).then(decoded=>{buffer=decoded;offset=(fallback.currentTime||0)%buffer.duration;fallback.pause();resume();}).catch(()=>{failed=true;ctx?.close().catch(()=>{});resume();});
   }catch{failed=true;}
  }
  resume();
 }
 function set(key,value){if(!(key in values)||!Number.isFinite(value))return;values[key]=Math.max(0,Math.min(1,value));try{localStorage.setItem('ff-audio',JSON.stringify(values));}catch{}resume();}
 document.addEventListener('visibilitychange',resume);
 document.addEventListener('pointerdown',unlock,{once:true});
 document.addEventListener('keydown',unlock,{once:true});
 return {values,set,unlock};
}
