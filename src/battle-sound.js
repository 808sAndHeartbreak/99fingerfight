export function createBattleSound(enabled) {
 let ctx;
 function unlock(){if(!enabled())return;try{ctx??=new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume().catch(()=>{});}catch{}}
 function play(kind,volume=1){
  if(!enabled())return;unlock();if(!ctx||ctx.state!=='running')return;
  const t=ctx.currentTime,tonal=['charge','nine','victory','guard'].includes(kind),dur=kind==='victory'?.85:kind==='charge'?.5:.22;
  const gain=ctx.createGain();gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.09*volume,t+.012);gain.gain.exponentialRampToValueAtTime(.001,t+dur);gain.connect(ctx.destination);
  if(tonal){const o=ctx.createOscillator();o.type=kind==='guard'?'sine':'triangle';o.frequency.setValueAtTime(kind==='charge'?150:kind==='nine'?660:kind==='victory'?440:220,t);o.frequency.exponentialRampToValueAtTime(kind==='charge'?550:kind==='victory'?880:kind==='nine'?990:100,t+dur);o.connect(gain);o.start(t);o.stop(t+dur);o.onended=()=>{o.disconnect();gain.disconnect();};}
  else{const buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*dur),ctx.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*4);const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();source.buffer=buffer;filter.type='lowpass';filter.frequency.value=['gun','snipe','bolt'].includes(kind)?3800:['punch','burst','palm','dragon'].includes(kind)?600:1700;source.connect(filter);filter.connect(gain);source.start(t);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};}
 }
 return {play,unlock};
}
