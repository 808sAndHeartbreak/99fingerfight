export function createBattleSound(enabled, audioSettings) {
 let ctx;
 function unlock(){audioSettings?.unlock();if(!enabled())return;try{ctx??=new (window.AudioContext||window.webkitAudioContext)();if(ctx.state==='suspended')ctx.resume().catch(()=>{});}catch{}}
 function play(kind,volume=1){
  if(!enabled()||volume<=0||(audioSettings?.values.effects??.5)<=0)return;
  unlock();if(!ctx||ctx.state!=='running')return;
  const now=ctx.currentTime,level=.065*Math.min(1,volume)*(audioSettings?.values.effects??.5);
  function envelope(time,duration,weight){const gain=ctx.createGain();gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(level*weight,time+.008);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);gain.connect(ctx.destination);return gain;}
  function tone(frequency,end,duration,delay=0,weight=1,type='sine'){
   const time=now+delay,gain=envelope(time,duration,weight),o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(frequency,time);o.frequency.exponentialRampToValueAtTime(end,time+duration);o.connect(gain);o.start(time);o.stop(time+duration);o.onended=()=>{o.disconnect();gain.disconnect();};
  }
  // Short UI gestures are distinct from supply, recovery, shields and the turn cue.
  const motifs={page:[[620,430,.1,0,.25],[820,580,.12,.045,.18]],select:[[540,720,.11,0,.6]],back:[[420,260,.12,0,.5]],inspect:[[440,440,.12,0,.4],[660,660,.18,.06,.4]],turn:[[260,260,.14,0,.65],[390,390,.22,.11,.55]],item:[[520,520,.13,0,.6],[780,780,.24,.1,.5]],heal:[[330,330,.2,0,.45],[440,440,.23,.1,.4],[660,660,.3,.2,.35]],guard:[[960,420,.24,0,.65],[1440,620,.17,.025,.22]],charge:[[130,520,.48,0,.65],[196,784,.44,.04,.22]],nine:[[330,330,.6,0,.45],[495,495,.65,.14,.35],[660,990,.65,.28,.3]],victory:[[330,330,.25,0,.45],[440,440,.3,.14,.4],[550,550,.35,.28,.35],[880,880,.6,.42,.3]]};
  if(motifs[kind]){for(const note of motifs[kind])tone(...note);return;}
  const heavy=['punch','burst','palm','dragon'].includes(kind),sharp=['gun','snipe','bolt'].includes(kind);
  const duration=heavy?.42:kind==='release'?.28:kind==='curse'?.34:.19;
  const gain=envelope(now,duration,heavy?.65:.55),buffer=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/data.length*(kind==='release'?2:6));
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();source.buffer=buffer;filter.type=kind==='release'?'bandpass':'lowpass';filter.frequency.setValueAtTime(sharp?4200:heavy?1200:2300,now);filter.frequency.exponentialRampToValueAtTime(heavy?160:650,now+duration);source.connect(filter);filter.connect(gain);source.start(now);source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
  if(heavy)tone(125,42,.36,0,.7);
  if(sharp)tone(220,65,.13,0,.3);
  if(kind==='curse')tone(170,95,.31,0,.4,'triangle');
 }
 return {play,unlock};
}
