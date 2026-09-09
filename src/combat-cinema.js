import { actionBeats, actionDuration, commandArt, SKILL_MOTION } from './presentation.js';
import { playerName, escapeHtml } from './identity.js';

// Presentation consumes authoritative events; it never rolls randomness or changes game state.
export function createCombatCinema({animate,register,generation,asset,sound,impact,participants}) {
  return async function perform(old,next,command,onBeat) {
    const epoch=generation(), art=commandArt(old,command), skill=command.type==='attack';
    if(!art)return true;
    const id=skill?old.players[old.active].weapon:old.players[old.active].props[command.slot];
    const family=skill?SKILL_MOTION[id][0]:['grace','boon','echo','mirror'].includes(id)?'guard':['ruin','lock','silence'].includes(id)?'curse':'steal';
    const nine=id==='unify',won=nine&&next.winReason==='九九归一';
    const el=document.createElement('section');
    el.className=`combat-cinema ${skill?'skill':'item'} ${won?'ultimate':''}`;
    el.dataset.family=family;el.dataset.team=old.active;el.setAttribute('role','status');
    el.innerHTML=`<div class="cinema-ink"></div><div class="cinema-portrait"><img src="${asset(`manga/${old.active?'red':'blue'}.webp`)}" alt=""></div><div class="cinema-heading"><small>${escapeHtml(playerName(participants(),old.active))} / ${skill?'SKILL ACTIVATED':'ITEM ACTIVATED'}</small><h2>${art.name}</h2><span>${skill?SKILL_MOTION[id][1]:'道具生效'}</span></div><img class="cinema-icon" src="${asset(art.image)}" alt=""><div class="cinema-impact" aria-hidden="true"><i></i><i></i><i></i><i></i></div><small class="cinema-hit" aria-hidden="true"></small><div class="cinema-result" aria-live="polite"></div>${nine?`<div class="nine-ritual"><span><img src="${asset('ink-mono/nine-seal.webp')}" alt="九"></span><span class="${won?'complete':'empty'}"><img src="${asset('ink-mono/nine-seal.webp')}" alt="九"></span><b>${won?'九九归一':'九印 · 一之刻'}</b><small>${won?'强制胜利':'再获得一枚九印即可获胜'}</small></div>`:''}`;
    document.querySelector('.duel').append(el);register(el);
    const duration=actionDuration(old,next,command),beats=actionBeats(old,next,command);
    const intro=skill?250:120,tail=nine?650:250;
    const beatDuration=(duration-intro-tail)/Math.max(1,beats.length);
    const live=()=>generation()===epoch;
    const wait=async(ms)=>{await animate(el,[{opacity:1},{opacity:1}],{duration:ms,fill:'both'}).finished.catch(()=>{});return live();};
    sound('charge',skill?1:.45);
    animate(el.querySelector('.cinema-portrait'),[{transform:'translateX(-110%) skewX(-10deg)'},{transform:'translateX(0) skewX(-10deg)'}],{duration:intro,easing:'cubic-bezier(.12,.85,.18,1)',fill:'both'});
    animate(el.querySelector('.cinema-heading'),[{opacity:0,transform:'translateX(120px) rotate(-5deg)'},{opacity:1,transform:'translateX(0) rotate(-5deg)'}],{duration:intro,fill:'both'});
    animate(el.querySelector('.cinema-icon'),[{opacity:0,transform:'scale(2) rotate(30deg)'},{opacity:1,transform:'scale(1) rotate(-8deg)'}],{duration:intro,fill:'both',easing:'cubic-bezier(.15,.9,.2,1)'});
    if(!await wait(intro))return false;
    el.classList.add('contact');
    if(nine) {
      el.querySelectorAll('.nine-ritual>span').forEach((seal,i)=>animate(seal,[{opacity:0,transform:`scale(3) rotate(${i?40:-35}deg)`},{opacity:i&&!won?.17:1,transform:'scale(1) rotate(-12deg)'}],{duration:600,delay:i*260,fill:'both',easing:'cubic-bezier(.2,.85,.2,1)'}));
      animate(el.querySelector('.nine-ritual>b'),[{opacity:0,transform:'translateY(40px) scale(.7)'},{opacity:1,transform:'translateY(0) scale(1) rotate(-4deg)'}],{duration:650,delay:700,fill:'both'});
    }
    for(let index=0;index<Math.max(1,beats.length);index++) {
      if(!live())return false;
      const beat=beats[index];
      if(beat) {
        el.querySelector('.cinema-result').textContent=beat.type==='damage'
          ? `${beat.trueDamage?'真实伤害':'伤害'} HP-${beat.amount}${beat.blocked?` · ${beat.blocked}`:''}` : beat.label;
        const hits=beats.filter(b=>b.type==='damage');
        el.querySelector('.cinema-hit').textContent=beat.type==='damage'&&hits.length>1?`第 ${hits.indexOf(beat)+1} / ${hits.length} 击`:'';
        onBeat(beat);
      }
      el.dataset.hit=String(index+1);
      const icon=el.querySelector('.cinema-icon');
      const moves={
        punch:['translateX(-65px) scale(.75) rotate(-15deg)','translateX(22px) scale(1.4) rotate(-4deg)','scale(1) rotate(-8deg)'],
        palm:['scale(.6) rotate(-18deg)','scale(1.35) rotate(0)','scale(1) rotate(-8deg)'],
        dragon:['translateX(-60px) rotate(-40deg)','translateX(24px) rotate(15deg)','scale(1) rotate(-8deg)'],
        swirl:['rotate(-30deg) translateY(8px)','rotate(22deg) translateY(-15px)','rotate(-8deg)'],
        fan:['rotate(-65deg)','rotate(35deg)','rotate(-8deg)'],
        gun:['rotate(-8deg)','translate(-18px,-12px) rotate(-20deg)','rotate(-8deg)'],
        snipe:['scale(1.15) rotate(-8deg)','translateX(-24px) scale(1.05) rotate(-8deg)','rotate(-8deg)'],
        burst:['translate(-95px,-55px) scale(.6) rotate(-100deg)','scale(1.2) rotate(30deg)','scale(.9) rotate(60deg)'],
        bolt:['translateX(-8px) rotate(-8deg)','translateX(8px) rotate(-3deg)','rotate(-8deg)'],
        slash:['translateX(-45px) rotate(-25deg)','translateX(35px) rotate(5deg)','rotate(-8deg)'],
        guard:['scale(.7)','scale(1.2)','scale(1)'],
        curse:['scale(.8) rotate(-25deg)','scale(1.16) rotate(8deg)','rotate(-8deg)'],
        steal:['translateX(70px) rotate(20deg)','translateX(-55px) rotate(-22deg)','rotate(-8deg)']
      }[family];
      if(moves)animate(icon,moves.map((transform,i)=>({transform,offset:[0,.2,1][i]})),{duration:Math.min(650,beatDuration),fill:'both',easing:'cubic-bezier(.15,.85,.2,1)'});
      el.classList.toggle('blocked',!!beat?.blocked&&beat.amount===0);
      const fx=el.querySelector('.cinema-impact');
      animate(fx,[{opacity:0,transform:'scale(.2) rotate(-20deg)'},{opacity:.85,transform:'scale(1) rotate(0)',offset:.2},{opacity:0,transform:'scale(1.45) rotate(8deg)'}],{duration:Math.min(500,beatDuration),fill:'both'});
      impact(['七伤拳','玄冥神掌'].includes(beat?.source)?'curse':family,beat?.owner??(skill?1-old.active:command.target));
      sound(beat?.blocked&&beat.amount===0?'guard':nine?'nine':family,skill?1:.5);
      if(!await wait(beatDuration))return false;
    }
    if(nine){el.classList.add('sealed');sound(won?'victory':'nine',1);}
    if(!await wait(tail-200))return false;
    await animate(el,[{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(6%)'}],{duration:200,fill:'both'},true).finished.catch(()=>{});
    return live();
  };
}
