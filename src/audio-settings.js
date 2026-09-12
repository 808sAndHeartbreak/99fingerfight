export function createAudioSettings(url) {
 const values={music:.25,effects:.5};
 try{const saved=JSON.parse(localStorage.getItem('ff-audio')||'null');for(const k of Object.keys(values))if(Number.isFinite(saved?.[k]))values[k]=Math.max(0,Math.min(1,saved[k]));}catch{}
 const music=new Audio(url);music.dataset.soundtrack='bgm';music.hidden=true;document.body.append(music);music.loop=true;music.preload='metadata';music.volume=values.music*.28;
 let unlocked=false;
 function resume(){if(unlocked&&!document.hidden&&values.music>0)music.play().catch(()=>{});else music.pause();}
 function unlock(){unlocked=true;resume();}
 function set(key,value){if(!(key in values))return;values[key]=Math.max(0,Math.min(1,value));music.volume=values.music*.28;try{localStorage.setItem('ff-audio',JSON.stringify(values));}catch{}resume();}
 document.addEventListener('visibilitychange',resume);
 document.addEventListener('pointerdown',unlock,{once:true});
 document.addEventListener('keydown',unlock,{once:true});
 return {values,set,unlock};
}
