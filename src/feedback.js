import {stateChanges} from "./state-changes.js";
import { MAX_HP, PROPS } from "./catalog.js";
import { escapeHtml, playerName } from "./identity.js";
/** Ephemeral visual feedback, independently paused and cancelled with the match. */
export function createFeedback() {
  let epoch=0;
  const running = new Set(),
    nodes = new Set();
  let paused = false;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function animate(el, frames, options, remove = false) {
    const quietFrames = reduced.matches ? frames.map(frame => {
      const {transform, translate, scale, rotate, ...rest} = frame;
      return rest;
    }) : frames;
    // Reduce movement, never the time needed to read an effect or phase.
    const animation = el.animate(quietFrames, options);
    running.add(animation);
    if (paused) animation.pause();
    animation.finished
      .catch(() => {})
      .finally(() => {
        running.delete(animation);
        if (remove) {
          el.remove();
          nodes.delete(el);
        }
      });
    return animation;
  }
  function noticeRoot() {
    let stack=document.querySelector('.notice-stack');
    if(!stack){stack=document.createElement('div');stack.className='notice-stack';document.querySelector('.arena-center').prepend(stack);nodes.add(stack);}
    return stack;
  }
  function notice(text, team, kind = "turn", art = null) {
    const stack=noticeRoot();
    const el = document.createElement("div");
    el.className = `moment-notice ${kind}`;
    el.dataset.team = team;
    if(art)el.innerHTML=`<img class="notice-art" src="${new URL('assets/'+art.image,document.baseURI).href}" alt=""><div><strong>${escapeHtml(art.title)}</strong><span>${escapeHtml(text)}</span></div>`;
    else el.textContent = text;
    stack.append(el);
    nodes.add(el);
    animate(
      el,
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)", offset: 0.05 },
        { opacity: 1, offset: 0.92 },
        { opacity: 0, transform: "translateY(-5px)" },
      ],
      {
        duration: 7000,
        fill: "both",
        easing: "ease-out",
      },
      true,
    );
  }
  const counters=new WeakMap();
  function countTo(el,value) {
    counters.get(el)?.cancel();const from=Number(el.textContent)||0;
    const a=animate(el,[{opacity:.7},{opacity:1}],{duration:800});counters.set(el,a);
    const frame=()=>{if(!el.isConnected||counters.get(el)!==a||a.playState==='idle')return;
      const t=Math.min(1,Number(a.currentTime||0)/800);el.textContent=Math.round(from+(value-from)*(1-(1-t)**3));
      if(t<1&&a.playState!=='finished')requestAnimationFrame(frame);else el.textContent=value;
    };requestAnimationFrame(frame);
  }
  function changes(old,next,duration=1800) {
    const all=stateChanges(old,next);
    for(const c of all.filter(c=>c.kind==='inventory'&&c.label.startsWith('＋'))){const prop=PROPS[c.id];notice(prop.detail,c.owner,'supply',{image:prop.image,title:`${c.owner?'红方':'蓝方'} 获得 · ${prop.name}`});}
    const duel=document.querySelector('.duel'),bounds=duel.getBoundingClientRect();
    const groups=new Map();
    for(const change of all){const id=`${change.owner}:${change.hand??change.kind}`;if(!groups.has(id))groups.set(id,[]);groups.get(id).push(change);}
    for(const group of groups.values()){
      const c=group[0],target=document.querySelector(c.hand!==undefined?`#hand-${c.owner}-${c.hand} .hand-value`:c.kind==='inventory'?`#items-${c.owner}`:`#player-${c.owner} .status-strip`);
      if(!target)continue;const r=target.getBoundingClientRect();
      const el=document.createElement('div');el.className=`change-marker ${c.hand!==undefined?'hand-change':c.kind+'-change'}`;el.dataset.team=c.owner;el.dataset.anchor=`${c.owner}:${c.hand??c.kind}`;
      el.innerHTML=group.map(c=>`<span>${c.id?`<img src="${new URL('assets/'+PROPS[c.id].image,document.baseURI).href}" alt="">`:''}${escapeHtml(c.label)}</span>`).join('');el.setAttribute('role','status');
      el.style.left=`${Math.max(65,Math.min(bounds.width-65,r.x+r.width/2-bounds.x))}px`;el.style.top=`${c.kind==='inventory'?r.y-bounds.y+12:r.bottom-bounds.y+6}px`;
      const prior=[...duel.querySelectorAll('.change-marker')].filter(n=>n.dataset.anchor===el.dataset.anchor);el.style.top=`${parseFloat(el.style.top)+prior.length*35}px`;
      duel.append(el);nodes.add(el);
      animate(el,[{opacity:0,transform:'translate(-50%,6px) scale(.92)'},{opacity:1,transform:'translate(-50%,0) scale(1)',offset:.14},{opacity:1,offset:.8},{opacity:0,transform:'translate(-50%,-5px)'}],{duration,fill:'both'},true);
      animate(target,[{filter:'brightness(1)'},{filter:'brightness(1.5)',offset:.2},{filter:'brightness(1)'}],{duration:450});
    }
  }
  function contact(command, old, next) {
    if (command.type === "prop" && command.targetHand !== undefined) {
      const value = document.querySelector(
        `#hand-${command.target}-${command.targetHand} .hand-value`,
      );
      animate(
        value,
        [{ scale: "1" }, { scale: "1.3", offset: 0.25 }, { scale: "1" }],
        { duration: 450 },
      );
      if (next.players[command.target].locks[command.targetHand])
        document.querySelector(
          `#hand-${command.target}-${command.targetHand} .hand-status`,
        ).textContent = "封印";
    }
    next.players.forEach((p, owner) => {
      for(const h of [0,1])if(old.players[owner].hands[h]===5 && p.hands[h]!==5){
        const hand=document.querySelector(`#hand-${owner}-${h}`),ghost=document.createElement('span');ghost.className='shield-break';ghost.textContent='护盾消散';hand.append(ghost);nodes.add(ghost);
        animate(ghost,[{opacity:0,transform:'scale(.8)'},{opacity:1,transform:'scale(1.12)',offset:.15},{opacity:1,offset:.65},{opacity:0,transform:'scale(1.4) translateY(-15px)'}],{duration:1500,fill:'both'},true);
      }
      const delta = p.hp - old.players[owner].hp;
      if (!delta) return;
      const player = document.querySelector(`#player-${owner}`);
      countTo(player.querySelector(".health-number b"),p.hp);
      player.querySelector(".hp-bar").setAttribute("aria-valuenow", p.hp);
      const bar=player.querySelector(".hp-bar i"),trail=player.querySelector('.hp-trail');
      animate(bar,[{width:`${old.players[owner].hp/MAX_HP*100}%`},{width:`${p.hp/MAX_HP*100}%`}],{duration:800,fill:'forwards',easing:'ease-out'});
      if(trail)animate(trail,[{width:`${old.players[owner].hp/MAX_HP*100}%`},{width:`${p.hp/MAX_HP*100}%`}],{duration:1100,delay:220,fill:'forwards',easing:'ease-out'});
      const el = document.createElement("b");
      el.className = `hp-delta ${delta > 0 ? "heal" : "damage"}`;
      el.textContent = `${delta > 0 ? "+" : ""}${delta}  ·  ${old.players[owner].hp} → ${p.hp}`;
      el.style.left = owner ? "82%" : "18%";
      el.dataset.owner=owner;el.style.marginTop=`${document.querySelectorAll(`.hp-delta[data-owner="${owner}"]`).length*28}px`;
      document.querySelector(".scoreboard").append(el);
      nodes.add(el);
      animate(
        el,
        [
          { opacity: 0, transform: "translateY(15px) scale(1.3)" },
          { opacity: 1, transform: "translateY(0) scale(1)", offset: 0.15 },
          { opacity: 1, offset: 0.6 },
          { opacity: 0, transform: "translateY(-30px) scale(.9)" },
        ],
        { duration: 1800, fill: "both" },
        true,
      );
      if (delta < 0 && !reduced.matches)
        animate(
          player,
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-9px)" },
            { transform: "translateX(7px)" },
            { transform: "translateX(-4px)" },
            { transform: "translateX(0)" },
          ],
          { duration: 280 },
        );
    });

  }
  return {
    animate, register:el=>nodes.add(el), generation:()=>epoch,
    async intro(participants, mine) {
      const root=document.createElement('section');root.className='match-intro';root.setAttribute('role','status');
      root.innerHTML=`<b class="intro-vs">VS</b>${[0,1].map(i=>`<div class="intro-name team-${i}">${escapeHtml(participants[i]?.displayName||`玩家${i?'二':'一'}`)}${mine===i?'<small>（我）</small>':''}</div>`).join('')}`;
      document.body.append(root);nodes.add(root);
      document.body.classList.add('introducing');
      const names=root.querySelectorAll('.intro-name');
      names.forEach((el,i)=>{
        const identity=document.querySelector(`#player-${i} .player-identity`);const target=identity.getBoundingClientRect();
        animate(identity,[{opacity:0},{opacity:0,offset:.88},{opacity:1}],{duration:1400,fill:'both'});
        const box=el.getBoundingClientRect();
        animate(el,[{opacity:0,transform:`translateX(${i?100:-100}px) scale(1.15)`},{opacity:1,transform:'none',offset:.2},{opacity:1,transform:'none',offset:.7},{opacity:1,transform:`translate(${target.x-box.x}px,${target.y-box.y}px) scale(.55)`,offset:.9},{opacity:0,transform:`translate(${target.x-box.x}px,${target.y-box.y}px) scale(.55)`}],{duration:1400,fill:'both',easing:'cubic-bezier(.2,.8,.2,1)'});
      });
      try {await animate(root,[{backgroundColor:'#111827f5'},{backgroundColor:'#111827f5',offset:.7},{backgroundColor:'#11182700'}],{duration:1400,fill:'both'},true).finished.catch(()=>{});}
      finally {document.body.classList.remove('introducing');}
      const target=document.querySelector(`#player-${mine}`);if(target)animate(target,[{filter:'brightness(1)'},{filter:'brightness(1.5)',offset:.25},{filter:'brightness(1)'}],{duration:700});
    },
    async phase(cue) {
      if(!cue)return;
      if(cue.kind==='finish'){
        await animate(document.querySelector('.round-block'),[{opacity:1},{opacity:1}],{duration:cue.duration}).finished.catch(()=>{});return;
      }
      const el=document.createElement('div');el.className='turn-handoff';el.dataset.team=cue.owner;el.setAttribute('role','status');
      el.innerHTML=`<strong>${escapeHtml(cue.detail)}</strong>${cue.title==='本回合无法行动'?'<span>本回合无法行动</span>':''}`;
      document.querySelector('.duel').append(el);nodes.add(el);
      await animate(el,[{opacity:0,transform:`translateX(${cue.owner?30:-30}px)`},{opacity:1,transform:'translateX(0)',offset:.18},{opacity:1,offset:.82},{opacity:0}],{duration:cue.duration,fill:'both'},true).finished.catch(()=>{});
    },
    async forge({owner, weapon}, asset, next, participants) {
      notice(`${playerName(participants,owner)} 合成 ${weapon.name}，立即释放`, owner, "forge");
    },
    notice, noticeRoot,
    contact, changes,
    reveal(el, text) {
      if (el.textContent === text) return;
      el.textContent = text;
      animate(
        el,
        [
          { opacity: 0, translate: "0 3px" },
          { opacity: 1, translate: "0 0" },
        ],
        { duration: 150 },
      );
    },
    clearNotices() {
      for (const n of nodes)
        if (n.classList.contains("moment-notice")) {
          n.getAnimations().forEach((a) => a.cancel());
          n.remove();
          nodes.delete(n);
        }
    },
    pause(value) {
      paused = value;
      for (const a of running) value ? a.pause() : a.play();
    },
    reset() {
      epoch++;
      paused = false;
      for (const a of running) a.cancel();
      running.clear();
      for (const n of nodes) n.remove();
      nodes.clear();
    },
  };
}
