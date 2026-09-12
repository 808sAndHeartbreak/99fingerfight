export function createBattleSound(enabled, audioSettings) {
 let ctx;
 function unlock(){audioSettings?.unlock();if(!enabled())return;try{ctx??=new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume().catch(()=>{});}catch{}}
 function play(kind,volume=1){
  if(!enabled()||volume<=0||(audioSettings?.values.effects??.5)<=0)return;unlock();if(!ctx||ctx.state!=='running')return;
  const t=ctx.currentTime,tonal=['charge','nine','victory','guard','heal','item','turn'].includes(kind),dur=kind==='victory'?.85:kind==='nine'?.7:kind==='charge'?.5:kind==='heal'?.42:kind==='release'?.32:.22;
  const gain=ctx.createGain();gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.065*volume*(audioSettings?.values.effects ?? .5),t+.012);gain.gain.exponentialRampToValueAtTime(.001,t+dur);gain.connect(ctx.destination);
  if(tonal){const o=ctx.createOscillator();o.type=kind==='guard'?'sine':'triangle';o.frequency.setValueAtTime(kind==='charge'?150:kind==='nine'?660:kind==='victory'?440:kind==='heal'?330:kind==='item'?520:kind==='turn'?260:220,t);o.frequency.exponentialRampToValueAtTime(kind==='charge'?550:kind==='victory'?880:kind==='nine'?990:kind==='heal'?660:kind==='item'?760:kind==='turn'?390:100,t+dur);o.connect(gain);o.start(t);o.stop(t+dur);o.onended=()=>{o.disconnect();gain.disconnect();};}
  else{const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*dur),ctx.sampleRate),data=buffer.getChannelData(0);const heavy=['punch','burst','palm','dragon'].includes(kind);for(let i=0;i<data.length;i++){const progress=i/data.length;data[i]=((Math.random()*2-1)*(heavy?.4:1)+(heavy?Math.sin(2*Math.PI*(100*i/ctx.sampleRate-120*(i/ctx.sampleRate)**2))*.65:0))*Math.exp(-progress*4);}const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=['gun','snipe','bolt'].includes(kind)?3800:heavy?850:1700;source.connect(filter);filter.connect(gain);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
 }
 return {play,unlock};
}
