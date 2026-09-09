import { MAX_HP } from "./catalog.js";
import { escapeHtml } from "./identity.js";
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
  function notice(text, team, kind = "turn") {
    const el = document.createElement("div");
    el.className = `moment-notice ${kind}`;
    el.dataset.team = team;
    el.textContent = text;
    document.querySelector(".duel").append(el);
    nodes.add(el);
    animate(
      el,
      [
        { opacity: 0, transform: "translate(-50%,8px)" },
        { opacity: 1, transform: "translate(-50%,0)", offset: 0.18 },
        { opacity: 1, offset: 0.72 },
        { opacity: 0, transform: "translate(-50%,-5px)" },
      ],
      {
        duration: kind === "forge" ? 1450 : 850,
        fill: "both",
        easing: "ease-out",
      },
      true,
    );
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
      const delta = p.hp - old.players[owner].hp;
      if (!delta) return;
      const player = document.querySelector(`#player-${owner}`);
      player.querySelector(".health-number b").textContent = p.hp;
      player.querySelector(".hp-bar").setAttribute("aria-valuenow", p.hp);
      player.querySelector(".hp-bar i").style.width = `${(p.hp / MAX_HP) * 100}%`;
      const el = document.createElement("b");
      el.className = `hp-delta ${delta > 0 ? "heal" : "damage"}`;
      el.textContent = `HP${delta > 0 ? "+" : ""}${delta}`;
      el.style.left = owner ? "82%" : "18%";
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
        { duration: 950, fill: "both" },
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
    async phase(cue, asset) {
      if (!cue) return;
      if(cue.kind!=='finish') {
        const banner=document.querySelector('.battle-banner');
        animate(banner,[{filter:'brightness(1.25)'},{filter:'brightness(1)'}],{duration:650});
        const flow=document.createElement('i');flow.className='turn-colour-flow';banner.append(flow);nodes.add(flow);
        animate(flow,[{transform:'translateX(-110%)',opacity:0},{opacity:.5,offset:.2},{transform:'translateX(110%)',opacity:0}],{duration:850,easing:'ease-out'},true);
        return;
      }
      document.querySelectorAll(".phase-cut:not(.finish)").forEach(node=>node.remove());
      const el = document.createElement("div");
      el.className = `phase-cut ${cue.kind}`;
      el.dataset.team = cue.owner;
      el.setAttribute("role", "status");
      const cinematic=["start","finish"].includes(cue.kind);
      el.classList.toggle("phase-text",!cinematic);
      el.innerHTML = `<div class="phase-speed" aria-hidden="true"></div><div class="phase-ribbon"><img src="${asset(`manga/${cue.owner ? "red" : "blue"}.webp`)}" alt=""><div class="phase-type"><small>${escapeHtml(cue.label)}</small><strong>${escapeHtml(cue.title)}</strong><p>${escapeHtml(cue.detail)}</p></div></div>`;
      document.querySelector(".game-shell").append(el);
      nodes.add(el);
      const duration = cue.duration;
      if(!cinematic) el.querySelector(".phase-ribbon").innerHTML=`<div class="phase-type"><strong>${escapeHtml(cue.title)}</strong></div>`;
      animate(el.querySelector(".phase-ribbon"), !cinematic || reduced.matches ? [{opacity:0},{opacity:1,offset:.2},{opacity:1,offset:.8},{opacity:0}] : [{transform:"translateX(-110%) rotate(-6deg)"},{transform:"translateX(2%) rotate(-6deg)",offset:.2},{transform:"translateX(0) rotate(-6deg)",offset:.3},{transform:"translateX(0) rotate(-6deg)",offset:.78},{transform:"translateX(115%) rotate(-6deg)"}], {duration,fill:"both",easing:"cubic-bezier(.16,1,.3,1)"});
      const completion=animate(el,[{opacity:0},{opacity:1,offset:.1},{opacity:1,offset:.85},{opacity:0}],{duration,fill:"both"},true).finished.catch(()=>{});
      if(cinematic) await completion;
    },
    async forge({owner, weapon}, asset, next, participants) {
      notice(`${weapon.name} · 已合成`, owner, "forge");
    },
    notice,
    contact,
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
