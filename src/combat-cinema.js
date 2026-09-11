import { actionBeats, actionDuration, commandArt, SKILL_MOTION, skillSummary } from './presentation.js';
import { propUseDetail } from './guidance.js';
import { playerName, escapeHtml } from './identity.js';

// Presentation consumes authoritative events; it never rolls randomness or changes game state.
export function createCombatCinema({animate,register,generation,asset,sound,participants,notice,noticeRoot}) {
  return async function perform(old,next,command,onBeat) {
    const epoch=generation(), art=commandArt(old,command), skill=command.type==='attack';
    const wait=async(el,ms)=>{await animate(el,[{opacity:1},{opacity:1}],{duration:ms}).finished.catch(()=>{});return generation()===epoch;};
    if(!art) {
      const beats=actionBeats(old,next,command),duration=actionDuration(old,next,command);
      if(!duration){onBeat({type:'settle'});return true;}
      const banner=document.createElement('span');banner.hidden=true;document.querySelector('.duel').append(banner);register(banner);
      for(const beat of beats){notice(`${playerName(participants(),beat.owner)} · ${beat.label}`,beat.owner,'effect');onBeat(beat);sound(beat.type==='damage'?(beat.amount?'curse':'guard'):'turn',.6);if(!await wait(banner,900))return false;}
      onBeat({type:'settle'});
      await animate(banner,[{opacity:1},{opacity:1}],{duration:Math.max(0,duration-beats.length*900)},true).finished.catch(()=>{});
      return generation()===epoch;
    }
    if(!skill) {
      const beats=actionBeats(old,next,command),owner=old.active,id=old.players[owner].props[command.slot];
      const targets=art.target==='all'?[0,1]:[command.target];
      const names=targets.map(o=>playerName(participants(),o)+(command.targetHand===undefined?'':` · ${command.targetHand===0?'左':'右'}手`)).join('、');
      const result=command.targetHand!==undefined && id!=='lock'
        ? `[${old.players[command.target].hands[command.targetHand]}] → [${next.players[command.target].hands[command.targetHand]}]`
        : ['balance','boon','greed'].includes(id)?propUseDetail(old,id):beats.filter(b=>b.type==='effect').map(b=>b.label).join(' · ');
      const duel=document.querySelector('.duel'),card=document.createElement('aside');card.className='item-receipt';card.dataset.owner=owner;card.setAttribute('role','status');
      card.innerHTML=`<img src="${asset(art.image)}" alt=""><div><small>${escapeHtml(playerName(participants(),owner))} 使用 · ${escapeHtml(names)}</small><strong>${art.name}</strong><b>${escapeHtml(result)}</b></div>`;
      noticeRoot().append(card);register(card);
      const bounds=duel.getBoundingClientRect(),source=document.querySelector(`#items-${owner} .prop-slot:nth-of-type(${command.slot+2}) .prop-use`),icon=card.querySelector('img');
      const to=icon.getBoundingClientRect(),from=source?.getBoundingClientRect()||to;
      const flight=document.createElement('img');flight.src=asset(art.image);flight.className='released-item';flight.style.left=`${to.x+to.width/2-bounds.x}px`;flight.style.top=`${to.y+to.height/2-bounds.y}px`;duel.append(flight);register(flight);
      icon.style.visibility='hidden';
      if(source)animate(source,[{opacity:1},{opacity:0,offset:.08},{opacity:0}],{duration:actionDuration(old,next,command),fill:'forwards'});
      animate(card,[{opacity:0,transform:'scale(.96)'},{opacity:1,transform:'scale(1)'}],{duration:350,fill:'forwards'});
      sound('release',.65);
      await animate(flight,[{opacity:1,transform:`translate(calc(-50% + ${from.x+from.width/2-to.x-to.width/2}px),calc(-50% + ${from.y+from.height/2-to.y-to.height/2}px)) scale(.55)`},{opacity:1,transform:'translate(-50%,-50%) scale(1)'}],{duration:350,fill:'forwards',easing:'cubic-bezier(.2,.8,.2,1)'}).finished.catch(()=>{});
      if(generation()!==epoch)return false;
      if(!await wait(card,1800))return false;
      const target=document.querySelector(command.targetHand===undefined?`#player-${command.target}`:`#hand-${command.target}-${command.targetHand}`),r=target.getBoundingClientRect();
      await animate(flight,[{opacity:1,transform:'translate(-50%,-50%) scale(1)'},{opacity:0,transform:`translate(calc(-50% + ${r.x+r.width/2-to.x-to.width/2}px),calc(-50% + ${r.y+r.height/2-to.y-to.height/2}px)) scale(.2)`}],{duration:350,fill:'forwards',easing:'ease-in'},true).finished.catch(()=>{});
      if(generation()!==epoch)return false;
      for(const o of targets){const el=document.querySelector(command.targetHand===undefined?`#player-${o}`:`#hand-${o}-${command.targetHand}`);animate(el,[{filter:'brightness(1)'},{filter:'brightness(1.4)',offset:.2},{filter:'brightness(1)'}],{duration:600});}
      for(const beat of beats)onBeat(beat);onBeat({type:'settle'});
      sound(id==='grace'?'heal':['lock','silence','ruin'].includes(id)?'curse':'item',.65);
      if(!await wait(card,1120))return false;
      await animate(card,[{opacity:1},{opacity:0}],{duration:180},true).finished.catch(()=>{});
      return generation()===epoch;
    }
    const id=skill?old.players[old.active].weapon:old.players[old.active].props[command.slot];
    const family=skill?SKILL_MOTION[id][0]:['grace','boon','echo','mirror'].includes(id)?'guard':['ruin','lock','silence'].includes(id)?'curse':'steal';
    const nine=id==='unify',won=nine&&next.winReason==='九九归一';
    const el=document.createElement('section');
    el.className=`combat-cinema ${skill?'skill':'item'} ${nine?'milestone':'arena-skill'} ${won?'ultimate':''}`;
    el.dataset.family=family;el.dataset.team=old.active;el.setAttribute('role','status');
    el.innerHTML=`<div class="cinema-ink"></div><div class="cinema-portrait"><img src="${asset(`manga/${old.active?'red':'blue'}.webp`)}" alt=""></div><div class="cinema-heading"><small>${escapeHtml(playerName(participants(),old.active))} / ${skill?'SKILL ACTIVATED':'ITEM ACTIVATED'}</small><h2>${art.name}</h2><span>${skill?SKILL_MOTION[id][1]:'道具生效'}</span></div><img class="cinema-icon" src="${asset(art.image)}" alt=""><div class="cinema-impact" aria-hidden="true"><i></i><i></i><i></i><i></i></div><small class="cinema-hit" aria-hidden="true"></small><div class="cinema-result" aria-live="polite"></div>${nine?`<div class="nine-ritual"><span><img src="${asset('ink-mono/nine-seal.webp')}" alt="九"></span><span class="${won?'complete':'empty'}"><img src="${asset('ink-mono/nine-seal.webp')}" alt="九"></span><b>${won?'九九归一':'九印 · 一之刻'}</b><small>${won?'强制胜利':'再获得一枚九印即可获胜'}</small></div>`:''}`;
    (nine?document.body:document.querySelector('.duel')).append(el);register(el);
    if(nine)el.classList.add('contact');
    const duration=actionDuration(old,next,command),beats=actionBeats(old,next,command);
    const intro=skill?250:120,tail=2000;
    const beatDuration=(duration-intro-tail)/Math.max(1,beats.length);
    const live=()=>generation()===epoch;
    const skillWait=async(ms)=>{await animate(el,[{opacity:1},{opacity:1}],{duration:ms,fill:'both'}).finished.catch(()=>{});return live();};
    sound('charge',skill?1:.45);
    animate(el.querySelector('.cinema-portrait'),[{transform:'translateX(-110%) skewX(-10deg)'},{transform:'translateX(0) skewX(-10deg)'}],{duration:intro,easing:'cubic-bezier(.12,.85,.18,1)',fill:'both'});
    animate(el.querySelector('.cinema-heading'),[{opacity:0,transform:'translateX(120px) rotate(-5deg)'},{opacity:1,transform:'translateX(0) rotate(-5deg)'}],{duration:intro,fill:'both'});
    animate(el.querySelector('.cinema-icon'),[{opacity:0,transform:'scale(2) rotate(30deg)'},{opacity:1,transform:'scale(1) rotate(-8deg)'}],{duration:intro,fill:'both',easing:'cubic-bezier(.15,.9,.2,1)'});
    if(!await skillWait(intro))return false;
    el.classList.add('contact');
    if(nine) {
      el.querySelectorAll('.nine-ritual>span').forEach((seal,i)=>animate(seal,[{opacity:0,transform:`scale(3) rotate(${i?40:-35}deg)`},{opacity:i&&!won?.17:1,transform:'scale(1) rotate(-12deg)'}],{duration:600,delay:i*260,fill:'both',easing:'cubic-bezier(.2,.85,.2,1)'}));
      animate(el.querySelector('.nine-ritual>b'),[{opacity:0,transform:'translateY(40px) scale(.7)'},{opacity:1,transform:'translateY(0) scale(1) rotate(-4deg)'}],{duration:650,delay:700,fill:'both'});
    }
    for(let index=0;index<Math.max(1,beats.length);index++) {
      if(!live())return false;
      const beat=beats[index];
      if(beat) {
        el.querySelector('.cinema-result').innerHTML=beat.type==='damage'
          ? `<small class="damage-kind ${beat.trueDamage?'true-damage':''}">${beat.trueDamage?'真实伤害':'伤害'}</small><strong class="damage-value">HP−${beat.amount}</strong>${beat.blocked?`<span class="effect-text">${escapeHtml(beat.blocked)}</span>`:''}` : `<strong class="effect-text">${escapeHtml(beat.label)}</strong>`;
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
      // Damage is shown on the receiving hands and HP, without screen-wide slashes.
      sound(beat?.blocked&&beat.amount===0?'guard':nine?'nine':family,skill?1:.5);
      if(!await skillWait(beatDuration))return false;
    }
    onBeat({type:'settle',preserveActorHands:true});
    const summary=skillSummary(old,next,command);
    el.querySelector('.cinema-result').innerHTML=`${summary.hits?`<small>共 ${summary.hits} 击</small><strong class="damage-value">HP−${summary.damage}</strong><span class="damage-caption">累计实际伤害</span>`:''}${summary.effects.length?`<span class="effect-text">${summary.effects.map(escapeHtml).join(' · ')}</span>`:''}`;
    el.querySelector('.cinema-hit').textContent='';
    if(nine){el.classList.add('sealed');sound(won?'victory':'nine',1);}
    if(!await skillWait(tail-850))return false;
    onBeat({type:'reset-hands'});
    notice(`${playerName(participants(),old.active)} · ${art.name}${summary.hits?` · 对手 HP −${summary.damage}`:''}${summary.effects.length?' · '+summary.effects.join(' · '):''}`,old.active,'effect');
    if(!await skillWait(650))return false;
    await animate(el,[{opacity:1,transform:'translateX(0)'},{opacity:0,transform:'translateX(6%)'}],{duration:200,fill:'both'},true).finished.catch(()=>{});
    return live();
  };
}
