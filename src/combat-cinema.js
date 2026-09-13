import {defenseDetail} from "./effect-copy.js";
import { actionBeats, actionDuration, commandArt, SKILL_MOTION, skillSummary } from './presentation.js';
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
        : beats.filter(b=>b.type==='effect').map(b=>b.label).join(' · ');
      const duel=document.querySelector('.duel'),card=document.createElement('aside');card.className='item-receipt';card.dataset.owner=owner;card.setAttribute('role','status');
      card.innerHTML=`<img src="${asset(art.image)}" alt=""><div><small>${escapeHtml(playerName(participants(),owner))} 使用 · ${escapeHtml(names)}</small><strong>${art.name}</strong><span class="item-purpose">${escapeHtml(art.detail)}</span><b>${escapeHtml(result)}</b></div>`;
      noticeRoot().append(card);register(card);
      const source=document.querySelector(`#items-${owner} [data-slot="${command.slot}"]`),icon=card.querySelector('img');
      const center=()=>{const r=icon.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};};
      const to=center(),from=source?.getBoundingClientRect();
      const flight=document.createElement('img');flight.src=asset(art.image);flight.className='released-item';flight.style.position='fixed';flight.style.left=`${to.x}px`;flight.style.top=`${to.y}px`;document.body.append(flight);register(flight);
      icon.style.visibility='hidden';card.style.opacity='0';
      if(source)source.style.opacity='0';
      sound('release',.65);
      await animate(flight,[{opacity:1,transform:`translate(calc(-50% + ${(from?from.x+from.width/2:to.x)-to.x}px),calc(-50% + ${(from?from.y+from.height/2:to.y)-to.y}px)) scale(.55)`},{opacity:1,transform:'translate(-50%,-50%) scale(1)'}],{duration:350,fill:'forwards',easing:'cubic-bezier(.2,.8,.2,1)'}).finished.catch(()=>{});
      if(generation()!==epoch)return false;
      flight.style.visibility='hidden';icon.style.visibility='visible';
      animate(card,[{opacity:0},{opacity:1}],{duration:150,fill:'forwards'});
      if(!await wait(card,3000))return false;
      const origin=center();flight.style.left=`${origin.x}px`;flight.style.top=`${origin.y}px`;flight.style.visibility='visible';icon.style.visibility='hidden';
      const destination=o=>{
        const el=document.querySelector(command.targetHand===undefined?(['balance','boon','greed'].includes(id)?`#items-${o}`:`#player-${o}`):`#hand-${o}-${command.targetHand}`),r=el.getBoundingClientRect();
        if(command.targetHand!==undefined&&el.closest('.stage').dataset.renderer==='webgl'){
          const host=el.closest('.stage').getBoundingClientRect();return {el,x:host.x+parseFloat(el.style.left),y:host.y+parseFloat(el.style.top)};
        }
        return {el,x:r.x+r.width/2,y:r.y+r.height/2};
      };
      await Promise.all(targets.map((o,i)=>{
        const target=destination(o),moving=i?flight.cloneNode(true):flight;
        if(i){document.body.append(moving);register(moving);}
        return animate(moving,[{opacity:1,transform:'translate(-50%,-50%) scale(1)'},{opacity:1,offset:.8},{opacity:0,transform:`translate(calc(-50% + ${target.x-origin.x}px),calc(-50% + ${target.y-origin.y}px)) scale(.3)`}],{duration:350,fill:'forwards',easing:'ease-in'},true).finished.catch(()=>{});
      }));
      if(generation()!==epoch)return false;
      for(const o of targets)animate(destination(o).el,[{filter:'brightness(1)'},{filter:'brightness(1.4)',offset:.2},{filter:'brightness(1)'}],{duration:600});
      for(const beat of beats)onBeat(beat);onBeat({type:'settle'});
      sound(id==='grace'?'heal':['lock','silence','ruin'].includes(id)?'curse':'item',.65);
      if(!await wait(card,1120))return false;
      await animate(card,[{opacity:1},{opacity:0}],{duration:180},true).finished.catch(()=>{});
      return generation()===epoch;
    }
    const id=skill?old.players[old.active].weapon:old.players[old.active].props[command.slot];
    const family=skill?SKILL_MOTION[id][0]:['grace','boon','echo','mirror'].includes(id)?'guard':['ruin','lock','silence'].includes(id)?'curse':'steal';
    const nine=id==='unify',won=nine&&next.winReason==='九九归一';
    if(nine) {
      const ritual=document.createElement('section');ritual.className=`nine-finale ${won?'complete':''}`;ritual.dataset.team=old.active;ritual.setAttribute('role','status');
      const half='M100 10 A90 90 0 0 0 100 190 A45 45 0 0 0 100 100 A45 45 0 0 1 100 10 Z';
      ritual.innerHTML=`<div class="nine-content"><small>${escapeHtml(playerName(participants(),old.active))} · ${won?'第二次归一':'第一次归一'}</small><div class="taiji-orbit"><svg class="taiji" viewBox="0 0 200 200" role="img" aria-label="${won?'太极即将完整，第二次归一':'太极填充一半，第一次归一'}"><circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" stroke-width="1"/><path class="taiji-half first ${won?'filled':''}" d="${half}"/><path class="taiji-half second" d="${half}" transform="rotate(180 100 100)"/><circle class="taiji-eye light" cx="100" cy="55" r="9"/><circle class="taiji-eye" cx="100" cy="145" r="9"/></svg><i class="taiji-wave"></i><i class="taiji-wave second-wave"></i></div><h2>${won?'九九归一':'归一'}</h2><p>${won?'2 / 2 · 胜利':'1 / 2 · 再次使用即可获胜'}</p><footer>${won?`${escapeHtml(playerName(participants(),old.active))} 获胜`:'双方双手归 [1]，清除自己的减益'}</footer></div>`;
      document.body.append(ritual);register(ritual);
      const duration=actionDuration(old,next,command),orb=ritual.querySelector('.taiji');
      animate(ritual,[{opacity:0},{opacity:1}],{duration:300,fill:'both'});sound('charge',.7);
      animate(orb,[{opacity:0,transform:'scale(.8) rotate(-30deg)'},{opacity:1,transform:'scale(1) rotate(0deg)'}],{duration:750,fill:'both',easing:'ease-out'});
      animate(ritual.querySelector(won?'.taiji-half.second':'.taiji-half.first'),[{fill:'#1c2943'},{fill:old.active===0?(won?'#9bbcff':'#578dff'):(won?'#ffb1a5':'#f36c5b')}],{duration:1500,delay:100,fill:'both',easing:'ease-in-out'});
      if(!await wait(ritual,1700))return false;
      onBeat({type:'settle',preserveActorHands:true});sound('nine',.8);
      ritual.classList.add('resolved');
      if(won) {
        animate(orb,[{transform:'rotate(0deg)'},{transform:'rotate(360deg)'}],{duration:Math.max(650,duration-1950),fill:'both',easing:'cubic-bezier(.25,.05,.3,1)'});
        ritual.querySelectorAll('.taiji-wave').forEach((wave,i)=>animate(wave,[{opacity:0,transform:'scale(.75)'},{opacity:.8,offset:.2},{opacity:0,transform:'scale(1.65)'}],{duration:1200,delay:i*200,fill:'both'}));
      }
      for(const node of ritual.querySelectorAll('h2,p,.nine-progress,footer'))animate(node,[{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'none'}],{duration:450,fill:'both'});
      if(!await wait(ritual,duration-2350))return false;
      onBeat({type:'reset-hands'});
      if(!await wait(ritual,400))return false;
      await animate(ritual,[{opacity:1},{opacity:0}],{duration:250,fill:'both'},true).finished.catch(()=>{});
      return generation()===epoch;
    }
    const el=document.createElement('section');
    el.className=`combat-cinema ${skill?'skill':'item'} arena-skill`;
    el.dataset.family=family;el.dataset.team=old.active;el.setAttribute('role','status');
    el.innerHTML=`<div class="cinema-ink"></div><div class="cinema-heading"><small>${old.active?'红方':'蓝方'} · ${escapeHtml(playerName(participants(),old.active))} 使用</small><h2>${art.name}</h2><span class="skill-explanation">${escapeHtml(art.detail)}</span></div><img class="cinema-icon" src="${asset(art.image)}" alt=""><div class="cinema-impact" aria-hidden="true"><i></i><i></i><i></i><i></i></div><small class="cinema-hit" aria-hidden="true"></small><div class="cinema-result" aria-live="polite"></div>`;
    noticeRoot().append(el);register(el);
    animate(document.querySelector(`#player-${old.active}`),[{filter:'brightness(1)'},{filter:'brightness(1.35)',offset:.3},{filter:'brightness(1)'}],{duration:650});
    const duration=actionDuration(old,next,command),beats=actionBeats(old,next,command);
    const intro=skill?250:120,tail=2000;
    const beatDuration=(duration-intro-tail)/Math.max(1,beats.length);
    const live=()=>generation()===epoch;
    const skillWait=async(ms)=>{await animate(el,[{opacity:1},{opacity:1}],{duration:ms,fill:'both'}).finished.catch(()=>{});return live();};
    sound('charge',skill?1:.45);
    animate(el.querySelector('.cinema-heading'),[{opacity:0,transform:'translateX(120px) rotate(-5deg)'},{opacity:1,transform:'translateX(0) rotate(-5deg)'}],{duration:intro,fill:'both'});
    animate(el.querySelector('.cinema-icon'),[{opacity:0,transform:'scale(2) rotate(30deg)'},{opacity:1,transform:'scale(1) rotate(-8deg)'}],{duration:intro,fill:'both',easing:'cubic-bezier(.15,.9,.2,1)'});
    if(!await skillWait(intro))return false;
    el.classList.add('contact');
    for(let index=0;index<Math.max(1,beats.length);index++) {
      if(!live())return false;
      const beat=beats[index];
      if(beat?.type==='damage') {
        const duel=document.querySelector('.duel'),bounds=duel.getBoundingClientRect();
        const from=document.querySelector(`#hand-${old.active}-${index%2}`).getBoundingClientRect(),to=document.querySelector(`#hand-${beat.owner}-${index%2}`).getBoundingClientRect();
        const flight=document.createElement('img');flight.className='skill-flight';flight.src=asset(art.image);flight.alt='';flight.style.left=`${from.x+from.width/2-bounds.x}px`;flight.style.top=`${from.y+from.height/2-bounds.y}px`;duel.append(flight);register(flight);
        await animate(flight,[{opacity:0,transform:'translate(-50%,-50%) scale(.55)'},{opacity:1,offset:.2},{opacity:1,transform:`translate(calc(-50% + ${to.x-from.x}px),calc(-50% + ${to.y-from.y}px)) scale(1.15)`,offset:.85},{opacity:0,transform:`translate(calc(-50% + ${to.x-from.x}px),calc(-50% + ${to.y-from.y}px)) scale(1.4)`}],{duration:300,fill:'both',easing:'ease-in'},true).finished.catch(()=>{});
        if(!live())return false;
      }
      if(beat) {
        el.querySelector('.cinema-result').innerHTML=beat.type==='damage'
          ? `<small class="damage-kind">${escapeHtml(playerName(participants(),beat.owner))}${beat.trueDamage?' · 无视护盾':''}</small><strong class="damage-value">${beat.amount?'HP−'+beat.amount:'未扣血'}</strong>${beat.blocked?`<span class="effect-text">${escapeHtml(defenseDetail(beat))}</span>`:''}` : `<strong class="effect-text">${escapeHtml(beat.label)}</strong>`;
        const hits=beats.filter(b=>b.type==='damage');
        el.querySelector('.cinema-hit').textContent=beat.type==='damage'&&hits.length>1?`第 ${hits.indexOf(beat)+1} / ${hits.length} 击`:'';
        onBeat(beat);
      }
      el.dataset.hit=String(index+1);
      const icon=el.querySelector('.cinema-icon');
      animate(icon,[{transform:'scale(.95) rotate(-4deg)'},{transform:'scale(1.06) rotate(3deg)',offset:.3},{transform:'scale(1) rotate(0deg)'}],{duration:Math.min(500,beatDuration),fill:'both',easing:'ease-out'});
      el.classList.toggle('blocked',!!beat?.blocked&&beat.amount===0);
      const fx=el.querySelector('.cinema-impact');
      animate(fx,[{opacity:0,transform:'scale(.2) rotate(-20deg)'},{opacity:.85,transform:'scale(1) rotate(0)',offset:.2},{opacity:0,transform:'scale(1.45) rotate(8deg)'}],{duration:Math.min(500,beatDuration),fill:'both'});
      // Damage is shown on the receiving hands and HP, without screen-wide slashes.
      sound(beat?.blocked&&beat.amount===0?'guard':nine?'nine':family,skill?1:.5);
      if(beat?.blocked && beat.amount>0)sound('guard',.45);
      if(!await skillWait(beatDuration-(beat?.type==='damage'?300:0)))return false;
    }
    onBeat({type:'settle',preserveActorHands:true});
    const summary=skillSummary(old,next,command);
    el.querySelector('.cinema-result').innerHTML=`${summary.hits?`<small>${escapeHtml(playerName(participants(),1-old.active))}${summary.hits>1?` · 共 ${summary.hits} 击`:''}</small><strong class="damage-value">${summary.damage?'HP−'+summary.damage:'未扣血'}</strong><span class="damage-caption">累计实际伤害</span>`:''}${summary.effects.length?`<span class="effect-text">${summary.effects.map(escapeHtml).join(' · ')}</span>`:''}`;
    el.querySelector('.cinema-hit').textContent='';
    if(!await skillWait(tail-850))return false;
    onBeat({type:'reset-hands'});

    if(!await skillWait(650))return false;
    el.classList.add('resolved-summary');
    if(!await skillWait(200))return false;
    animate(el,[{opacity:1},{opacity:1,offset:.85},{opacity:0}],{duration:5000,fill:'both'},true);
    return live();
  };
}
