import { createCombatCinema } from "./combat-cinema.js";
import { createBattleSound } from "./battle-sound.js";
import { TutorialSession, LESSONS } from "./tutorial.js";
import { menuMarkup } from "./menu.js";
import { OnlineClient, onlineMarkup } from "./online.js";
import { synthesisOptions, supplyIn } from "./engine.js";
import { playerName, escapeHtml } from "./identity.js";
import { phaseCue, turnSteps, phaseSeconds } from "./phase-cue.js";
import "./style.css";
import "./comfort.css";
import "./menu.css";
import "./battle-layout.css";
import { WEAPONS, PROPS, MAX_HP, weaponById } from "./catalog.js";
import { LocalSession } from "./session.js";
import { chooseCommand } from "./ai.js";
import { touchResult, touchVisualSteps } from "./motion.js";
import { guidance, handPreview, comboRoutes, forgeEvents } from "./guidance.js";
import { createFeedback } from "./feedback.js";
import { setupInfo, describe } from "./info.js";

const asset = (name) => `${import.meta.env.BASE_URL}assets/${name}`;
const img = (name, cls = "", alt = "") =>
  `<img src="${asset(name)}" class="${cls}" alt="${alt}" draggable="false">`;
const propArt = id => PROPS[id].image ? img(PROPS[id].image) : '<span class="prop-placeholder" aria-hidden="true"></span>';
const app = document.querySelector("#app");
// Warm small battle illustrations while the player is in the main menu.
for(const file of [...WEAPONS.map(w=>w.image),...Object.values(PROPS).map(p=>p.image),'ink-mono/nine-seal.webp']) {
  const preload=new Image();preload.decoding='async';preload.src=asset(file);
}
const listeners = new AbortController();
const listen = (element, event, callback) =>
  element.addEventListener(event, callback, { signal: listeners.signal });
let session,
  state,
  mode = "ai",
  selected = null,
  remotePending = false,
  busy = false,
  paused = false,
  sound = false,
  aiTimer,
  deadline,
  remaining = 30,
  started = false;
let stage,
  info,
  unsubscribe,
  actionSerial = 0;
const participants = () => session?.getParticipants() || [];
const name = (seat) => escapeHtml(playerName(participants(), seat));
let renderedRemoteReady = false;
let online, remoteMatch = null, remoteQueue = [], remoteApplying = false;
const humanTurn = () => mode === "online" ? online?.packet?.room?.seat === state.active : mode === "local" || state.active === 0;
const team = (id) => (id === 0 ? "蓝方" : "红方");
const audioCache = new Map();
const battleSound=createBattleSound(()=>sound);
let cinema;
function play(id) {
  if (!sound) return;
  if (!audioCache.has(id)) audioCache.set(id, new Audio(asset(`${id}.wav`)));
  const a = audioCache.get(id);
  a.currentTime = 0;
  a.volume = 0.35;
  a.play().catch(() => {});
}

app.innerHTML = `<main class="game-shell">
  <div class="paper-grain" aria-hidden="true"></div>
  <header class="topbar"><a class="brand" href="./"><span class="brand-symbol">FF<span>!</span></span><div><b>指尖对决</b><small>FINGER FIGHT</small></div></a><div class="match-label"><span class="live-dot"></span><span id="mode-label">人机练习</span><span class="match-divider">/</span><span id="connection-label">本地对局</span></div><nav><button id="online">联机</button><button id="sound" aria-pressed="false">音效 <span>关</span></button><button id="help">玩法说明 <b>?</b></button><button id="menu">菜单 <span>☰</span></button></nav></header>
  <div id="network-notice" class="network-notice" role="status" hidden></div><section id="tutorial-guide" class="tutorial-guide" hidden aria-label="实战教学"></section><section class="battle-banner" aria-label="当前操作"><div class="turn-overview"><div class="round-inline">回合 <b id="round-number">01</b><span id="phase-label"></span><div class="phase-time" id="phase-time" role="timer" aria-live="off" aria-label="剩余时间"><span id="clock">30</span><small>SEC</small></div></div><nav id="phase-steps" class="phase-steps turn-track" aria-label="回合流程"></nav></div><div class="turn-instruction"><h1 id="instruction"></h1><p id="instruction-detail"></p></div><div id="primary-actions" class="primary-actions"></div></section><section class="duel" aria-label="指尖对战场">
    <div class="character-art character-blue" aria-hidden="true">${img("manga/blue.webp")}<span class="character-ink">一</span></div>
    <div class="character-art character-red" aria-hidden="true">${img("manga/red.webp")}<span class="character-ink">二</span></div>
    <div class="scoreboard"><div id="player-0" class="player blue"></div><div class="round-block"></div><div id="player-1" class="player red"></div></div>
    <div class="stage-caption" aria-hidden="true"><span>一 触</span><b>即 发</b><small>MAKE YOUR MOVE.</small></div>
    <div id="stage" class="stage" data-motion="idle"><div class="hand-layer" id="hand-layer">${[0, 1].map((owner) => [0, 1].map((hand) => `<button id="hand-${owner}-${hand}" class="hand-hotspot ${owner ? "red" : "blue"}" data-owner="${owner}" data-hand="${hand}" aria-pressed="false"><span class="hand-corner"></span>${img("hand-1.webp", "fallback-hand")}<b class="hand-value">1</b><span class="hand-status"></span><span class="hand-shield" data-info="shield" data-info-only hidden></span><span class="sum-preview"></span></button>`).join("")).join("")}</div><div class="contact-fx" id="contact-fx" aria-hidden="true">${img("manga/contact.webp")}<b>碰!</b></div></div>
    <div id="combat-callout" class="combat-callout" aria-live="polite"></div>
    <div class="field-note" aria-hidden="true"></div>
    <div id="items-0" class="field-items blue" aria-label="蓝方道具"></div><div id="items-1" class="field-items red" aria-label="红方道具"></div>
    <section id="forge-options" class="forge-options" hidden aria-label="合成选项"></section>
  </section>
  <section class="reference-deck" aria-label="常驻组合图鉴"><header><strong>组合图鉴</strong><small>悬停查看招式</small><button id="history">战报 ↗</button><span id="render-status"></span></header><div id="recipe-shelf" class="recipe-shelf" tabindex="0" aria-label="横向滚动查看组合"></div></section>
</main><dialog id="dialog"></dialog><aside id="info-popover" role="tooltip" hidden></aside><div id="toast" class="toast" role="status"></div>`;

document.querySelector('#recipe-shelf').addEventListener('wheel',event=>{
  const shelf=event.currentTarget;
  if(event.ctrlKey || Math.abs(event.deltaX)>Math.abs(event.deltaY))return;
  const amount=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?shelf.clientWidth:1);
  if((amount>0 && shelf.scrollLeft<shelf.scrollWidth-shelf.clientWidth-1)||(amount<0 && shelf.scrollLeft>0)) {
    event.preventDefault();shelf.scrollBy({left:amount,behavior:'auto'});
  }
},{passive:false,signal:listeners.signal});

const dialog = document.querySelector("#dialog");
const feedback = createFeedback();
const handElements = [0, 1].map((o) =>
  [0, 1].map((h) => document.querySelector(`#hand-${o}-${h}`)),
);
function toast(message, duration=2400) {
  const el = document.querySelector("#toast");
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove("visible"), duration);
}
const announcedGains=new Set();
function announceSupply(next) {
  if(mode === "tutorial") return;
  const key=`${actionSerial}:${mode==='online'?remoteMatch:''}:${next.revision}`;
  if(!announcedGains.has(key)) {
    announcedGains.add(key);if(announcedGains.size>100)announcedGains.delete(announcedGains.values().next().value);
    for(const owner of [0,1]) {
      const gains=(next.events||[]).filter(e=>e.type==='draw'&&e.owner===owner);
      if(!gains.length)continue;
      document.querySelector(`.gain-receipt[data-owner="${owner}"]`)?.remove();
      const el=document.createElement('aside');el.className='gain-receipt';el.dataset.owner=owner;el.setAttribute('role','status');
      el.innerHTML=`<small>${name(owner)} · 获得道具</small><div>${gains.map(e=>`<span>${propArt(e.item)}<b>${PROPS[e.item].name}</b></span>`).join('')}</div>`;
      document.querySelector('.duel').append(el);feedback.register(el);
      feedback.animate(el,[{opacity:0},{opacity:1,offset:.04},{opacity:1,offset:.94},{opacity:0}],{duration:6500,fill:'both'},true);
    }
  }
  const notes=[0,1].flatMap(owner=>{
    return (next.events||[]).some(e=>e.type==="supply-full"&&e.owner===owner)?[`${playerName(participants(),owner)}背包已满，本次补给跳过`]:[];
  });
  const ticks=(next.events||[]).filter(e=>e.type==="damage"&&["七伤拳","玄冥神掌","中毒"].includes(e.source));
  notes.push(...ticks.map(e=>`${playerName(participants(),e.owner)}${e.source} ${e.blocked&&e.amount===0?e.blocked:`HP-${e.amount}`}`));
  if(notes.length)toast(notes.join("；"),5200);
}
function canTarget(owner, hand) {
  if (!selected || busy || remotePending || (mode === "online" && online.status !== "connected") || !humanTurn() || state.winner !== null) return false;
  if (selected.kind === "hand")
    return (
      owner !== state.active &&
      hand !== undefined &&
      !state.players[owner].locks[hand]
    );
  return !state.players[state.active].silenced && hand !== undefined && PROPS[state.players[state.active].props[selected.slot]]?.target === "hand";
}
function renderPlayer(owner) {
  const p = state.players[owner],
    w = weaponById(p.weapon),
    active = state.active === owner && state.winner === null;
  const presence=mode==="online" ? participants().find(x=>x.seat===owner) : null;
  const presenceText=presence ? presence.departed?"已离开":online.status!=="connected"?(owner===online.packet.room.seat?"重连中":"待同步"):presence.connected?"在线":"已断线" : "";
  const statusIcons={echo:'echo',mirror:'mirror',silenced:'silence',skip:'taser',seven:'seven',dark:'dark',foam:'foam',knuckles:'knuckles',peace:'peace',weak:'serpent',poison:'serpent',nine:'nine-seal'};
  const statuses=Object.keys(statusIcons).filter(key=>p[key]).map(key=>{
    const d=describe(`status:${key}:${owner}`,state);
    const count=({skip:p.skip,seven:p.seven,dark:'∞',foam:p.foam,knuckles:`+${p.knuckles*10}`,peace:p.peace,weak:`弱${p.weak}`,poison:`毒${p.poison}`,nine:`${p.nine}/2`})[key];
    return `<button class="status-icon" data-info="status:${key}:${owner}" data-info-only aria-label="${d.title}，${d.stats[0][1]}">${img(`ink-mono/${statusIcons[key]}.webp`)}${count!==undefined?`<b class="status-count">${count}</b>`:''}</button>`;
  }).join('');
  const identity=mode==='online'&&owner===online.packet.room.seat?'你':mode==='ai'&&owner===1?'陪练':'';
  document.querySelector(`#player-${owner}`).innerHTML =
    `<div class="player-head"><div class="player-identity"><strong title="${name(owner)}">${name(owner)}</strong>${identity?`<small class="seat-label">${identity}</small>`:''}${presence?`<small class="player-presence ${presenceText==='在线'?'connected':''}" aria-label="${presenceText}"><i class="status-dot"></i>${presenceText==='在线'?'':presenceText}</small>`:''}</div><div class="health-number"><b>${p.hp}</b><small>/ ${MAX_HP}</small></div></div><div class="hp-bar" role="meter" aria-label="${team(owner)}生命" aria-valuenow="${p.hp}" aria-valuemin="0" aria-valuemax="${MAX_HP}"><i style="width:${(p.hp/MAX_HP)*100}%"></i></div><div class="status-strip">${statuses}</div><div class="player-loadout">${w?`<button class="weapon-ready" data-info="weapon:${w.id}" data-info-only aria-label="已合成${w.name}">${img(w.image)}<b>${w.name}</b></button>`:''}</div>`;
  document.querySelector(`#player-${owner}`).classList.toggle("active", active);
}
function renderHandShield(el,p,h) {
  const shield=el.querySelector('.hand-shield');shield.hidden=p.hands[h]!==5;
  shield.innerHTML=p.hands[h]===5?`${img('ink-mono/foam.webp')}<small>${p.hands.every(v=>v===5)?'绝对防御':'减伤'}</small>`:'';
}
function renderHands() {
  for (let o = 0; o < 2; o++)
    for (let h = 0; h < 2; h++) {
      const el = handElements[o][h],
        p = state.players[o],
        n = p.hands[h];
      const chosen =
        selected?.kind === "hand" && state.active === o && selected.hand === h;
      const target = canTarget(o, h),
        selectable =
          !busy && !remotePending && (mode !== "online" || online.status === "connected" && online.serverNow() >= (online.packet?.room?.readyAt || 0)) &&
          humanTurn() &&
          state.phase === "action" &&
          !state.players[state.active].weapon &&
          state.active === o &&
          !p.locks[h];
      el.setAttribute("aria-disabled", String(busy));
      el.setAttribute("aria-pressed", String(chosen));
      el.setAttribute(
        "aria-label",
        `${team(o)}${h === 0 ? "左" : "右"}手，数字 ${n}${p.locks[h] ? "，已封印" : ""}`,
      );
      el.classList.toggle("selected", chosen);
      el.classList.toggle("target", target);
      el.classList.toggle("locked", p.locks[h]);
      el.classList.toggle("available", selectable);
      el.querySelector(".hand-value").textContent = n;
      renderHandShield(el,p,h);
      el.querySelector(".fallback-hand").src = asset(`hand-${n}.webp`);
      el.querySelector(".hand-status").textContent = p.locks[h]
        ? "封印"
        : "";
      const preview = target ? handPreview(state, selected, o, h) : null;
      el.querySelector(".sum-preview").innerHTML = preview
        ? `${preview.text}${preview.note ? `<small>${preview.note}</small>` : ""}`
        : "";
      el.dataset.hint = chosen
        ? "✓"
        : target
          ? "↗"
          : "";
    }
}
function updateNetworkNotice() {
  if(mode!=="online")return;
  const peer=participants().find(p=>p.seat!==online.packet.room.seat);
  const seconds=Math.max(0,Math.ceil(((peer?.reconnectUntil||0)-online.serverNow())/1000));
  document.querySelector("#network-notice").textContent=online.status==="outdated"?"版本已更新 · 请刷新页面后重新准备":online.status==="replaced"?"此身份已在其他页面打开 · 请刷新恢复":online.status!=="connected"?"连接中断 · 正在自动重连，请稍候":`对手已断线 · 重连剩余 ${seconds} 秒 · 对局计时继续`;
}
function render() {
  renderedRemoteReady = mode === "online" && online.status === "connected" && online.serverNow() >= (online.packet?.room?.readyAt || 0);
  info?.hide();
  document.querySelector("#phase-time").hidden = mode === "tutorial" || state.winner !== null || state.phase === "start";
  document.querySelector("#clock").textContent = mode==="online"&&(online.status!=="connected"||busy)?"—":remaining;
  document
    .querySelector("#phase-time")
    .classList.toggle("urgent", remaining <= 5);
  renderPlayer(0);
  renderPlayer(1);
  renderHands();
  document.querySelector("#mode-label").textContent =
    mode === "online" ? state.winner!==null ? "联机 · 对局结束" : `联机 · ${humanTurn() ? "轮到你" : "对手回合"}` : mode === "tutorial" ? "游戏教学 · 无倒计时" : mode === "ai" ? "人机练习" : "同屏双人";
  document.querySelector("#connection-label").textContent = mode === "online" ? "服务器对局" : "本地对局";
  const notice=document.querySelector("#network-notice"), peer=online?.packet?.room?.participants?.find(p=>p.seat!==online.packet.room.seat);
  notice.hidden=mode!=="online" || (online.status==="connected" && peer?.connected!==false) || state.winner!==null;
  updateNetworkNotice();
  document.querySelector("#round-number").textContent = String(
    Math.ceil(state.turn / 2),
  ).padStart(2, "0");
  const p = state.players[state.active],
    enabled = !busy && !remotePending && humanTurn() && state.winner === null && (mode !== "online" || online.status === "connected" && online.serverNow() >= (online.packet?.room?.readyAt || 0));
  document.querySelector("#phase-label").textContent = state.winner !== null ? "对局结束" : busy
    ? "结算中"
    : `${humanTurn() ? (mode !== "local" ? "你的回合" : `${team(state.active)}回合`) : "对手回合"}`;
  const guide = mode==="online"&&online.status!=="connected"&&state.winner===null ? {title:"正在恢复对局",detail:"连接恢复后继续操作",step:"waiting"} : guidance(state, selected, humanTurn(), busy);
  if(mode==="online" && online.status==="connected" && !busy && !renderedRemoteReady && state.winner===null) Object.assign(guide,{title:"正在交接",detail:"演出结束后即可操作",step:"waiting"});
  if(mode==="tutorial") Object.assign(guide, {step:"tutorial"}, busy ? {title:"看清这一手",detail:"演出结束后继续，不用赶时间。"} : session.done ? {title:"本节完成",detail:session.lesson.result} : session.guide);
  feedback.reveal(document.querySelector("#instruction"), guide.title);
  document.querySelector("#instruction-detail").textContent = guide.detail;
  document.querySelector(".game-shell").dataset.step = guide.step;
  document.querySelector(".game-shell").dataset.actor = state.active;
  document.querySelector(".game-shell").dataset.phase = state.phase;
  document.querySelector("#phase-steps").innerHTML = turnSteps(state).map((step,i)=>`<div class="${step.current ? "current" : step.done ? "done" : ""}" ${step.current ? 'aria-current="step"' : ""}><b>${step.done ? (step.id==="synthesis" && state.synthesis==="skipped" ? "—" : "✓") : `0${i+1}`}</b><span>${step.label}<small>${step.note}</small></span></div>`).join("");
  const forgePanel=document.querySelector("#forge-options");
  forgePanel.hidden=busy || remotePending || state.phase !== "synthesis";
  forgePanel.innerHTML=forgePanel.hidden ? "" : `<div class="forge-heading"><small>02 / FUSE</small><h2>${humanTurn()?"选择你的技能":"对手正在选择技能"}</h2><p>当前双手 ${p.hands.join(" · ")}</p></div><div class="forge-choices">${synthesisOptions(state).map(w=>`<button data-forge="${w.id}" ${enabled ? "" : "disabled"}><span class="forge-recipe">${w.recipe.join(" · ")}</span>${img(w.image,"skill-icon")}<strong>${w.name}</strong><span>${w.detail}</span><b>${humanTurn()?"确认合成 →":"等待对手确认"}</b></button>`).join("")}</div>`;
  for(const owner of [0,1]) {
    const player=state.players[owner], usable=owner===state.active && enabled && state.phase==="planning" && !player.silenced;
    const supply=player.turns===0?1:supplyIn(player);
    document.querySelector(`#items-${owner}`).innerHTML=`<div class="supply-dots" data-info="supply:${owner}" tabindex="0" aria-label="道具补给：${supply} 回合后">${[1,2,3].map(n=>`<i class="${n<=3-supply?'filled':''}"></i>`).join('')}</div>`+[0,1,2].map(slot=>{
      const id=player.props[slot], mine=owner===state.active && humanTurn();
      return id ? `<div class="prop-slot ${mine&&selected?.kind==='prop'&&selected.slot===slot?'selected':''}"><button class="prop-use" ${mine?`data-prop="${slot}"`:'data-info-only'} data-info="prop:${id}:${owner}" aria-disabled="${!usable}" aria-label="${mine?'使用':'查看'}${PROPS[id].name}">${propArt(id)}<b>${PROPS[id].name}</b></button><button class="prop-info" data-info="prop:${id}:${owner}" data-info-only aria-label="${PROPS[id].name}完整说明">i</button></div>` : '<div class="prop-slot empty" aria-label="空道具位"><span>＋</span></div>';
    }).join('');
  }
  const shelf=document.querySelector('#recipe-shelf');
  if(!shelf.children.length)shelf.innerHTML=[5,0,2,4,6,7,8,9].map(n=>{
    return `<div class="reference-recipe" tabindex="0" data-number="${n}" data-info="recipe:${n}" aria-label="${n} 加 ${n} 配方"><b>${n} + ${n}</b></div>`;
  }).join('');
  for(const el of shelf.children){const n=Number(el.dataset.number);el.classList.toggle('ready',p.hands.every(v=>v===n));el.classList.toggle('related',selected?.kind==='hand'&&p.hands[selected.hand]===n);}
  document.querySelector("#primary-actions").innerHTML = `${selected ? '<button class="cancel-action" id="cancel">取消选择</button>' : ""}${selected?.kind==="prop"&&PROPS[p.props[selected.slot]].target!=="hand" ? `<button class="primary" id="use-prop" ${enabled&&!p.silenced?"":"disabled"}>确认使用${PROPS[p.props[selected.slot]].name} →</button>` : state.winner !== null ? `<button class="primary" id="${mode === "online" ? "online" : "again"}">${mode === "online" ? "返回房间" : "再战一局"} →</button>` : state.phase === "planning" && selected?.kind !== "prop" ? `<button class="primary" id="advance" ${enabled ? "" : "disabled"}>结束规划 <span>→</span></button>` : state.phase === "synthesis" ? `<button class="secondary" id="decline" ${enabled ? "" : "disabled"}>放弃合成，进入计算 →</button>` : state.phase === "action" && p.weapon ? `<button class="primary red-button" id="attack" ${enabled ? "" : "disabled"}>发动技能 <span>↗</span></button>` : ""}`;
  document.querySelector(".game-shell").classList.toggle("is-busy", busy);
  document.querySelectorAll("#menu,#help").forEach((b) => (b.disabled = busy));
  document.querySelector("#online").textContent = mode === "online" ? online.status === "connected" ? "房间 / 改名" : "正在重连…" : "联机";
  renderTutorial();
  stage?.sync(state, selected, enabled);
}
function renderTutorial() {
  const host=document.querySelector('#tutorial-guide');
  host.hidden=mode!=="tutorial";
  document.querySelector('.game-shell').classList.toggle('is-tutorial',mode==='tutorial');
  document.querySelectorAll('.tutorial-target').forEach(el=>el.classList.remove('tutorial-target'));
  if(mode!=="tutorial")return;
  host.innerHTML=`<div><small>实战教学 ${session.chapter+1} / ${LESSONS.length} · ${session.done?'已完成':`第 ${session.step+1} 步`}</small><strong>${busy?"看清这一手":session.done?"本节完成":session.guide.title}</strong><p>${busy?"演出结束后继续，不用赶时间。":session.done?session.lesson.result:session.guide.detail}</p><details><summary>${session.lesson.title} · 练习设置</summary><p>${session.lesson.setup}</p></details></div><div class="tutorial-controls"><button id="tutorial-retry">重试本节</button><button id="tutorial-exit">退出教学</button></div>`;
  if(session.done)document.querySelector('#primary-actions').innerHTML=`<button class="primary" id="tutorial-next" ${busy?"disabled":""}>${session.chapter===LESSONS.length-1?'完成教学 · 选择对战':'下一节'} →</button>`;
  if(!busy&&!session.done){
    const g=session.guide;
    document.querySelectorAll(selected&&g.selectedTarget?g.selectedTarget:g.target).forEach(el=>el.classList.add('tutorial-target'));
  }
}
function nextTutorial(chapter) {
  closeDialog();startGame('tutorial',chapter);
}
function exitTutorial() {
  started=false;closeDialog();startGame('ai');showMenu('play');
}
async function animateCommand(command, old, next, contact) {
  if(command.type==="attack"||command.type==="prop") {
    cinema??=createCombatCinema({animate:feedback.animate,register:feedback.register,generation:feedback.generation,asset,sound:battleSound.play,impact:(kind,owner)=>stage?.skillImpact?.(kind,owner),participants});
    let visual=structuredClone(old);
    const completed=await cinema(old,next,command,beat=>{
      const before=structuredClone(visual);
      if(beat.type==="damage") {
        const target=visual.players[beat.owner];
        target.hp=Math.max(0,target.hp-beat.amount);
        if(beat.hands)target.hands=[...beat.hands];
        if(beat.foam!==undefined) {
          target.foam=beat.foam;
          const badge=document.querySelector(`[data-info="status:foam:${beat.owner}"]`);
          if(badge){if(beat.foam){badge.querySelector(".status-count").textContent=beat.foam;badge.setAttribute("aria-label",`泡沫盾墙，剩余 ${beat.foam} 次`);}else badge.remove();}
        }
        stage?.sync(visual,null,false);
        target.hands.forEach((n,h)=>{handElements[beat.owner][h].querySelector('.hand-value').textContent=n;});
      }
      else {
        visual.players.forEach((p,i)=>{p.hands=[...next.players[i].hands];p.locks=[...next.players[i].locks];});
        stage?.sync(visual,null,false);
        visual.players.forEach((p,owner)=>p.hands.forEach((n,h)=>{handElements[owner][h].querySelector('.hand-value').textContent=n;}));
      }
      visual.players.forEach((p,o)=>p.hands.forEach((n,h)=>renderHandShield(handElements[o][h],p,h)));
      feedback.contact({type:'beat'},before,visual);
    });
    if(completed)feedback.contact({type:'beat'},visual,next);
    return completed;
  }
  if(command.type!=="add"){feedback.contact(command,old,next);return true;}
  const steps=touchVisualSteps(old,command);
  for(const step of steps){const completed=await stage.animate(step,old,next,()=>contact(step));if(!completed)return false;}
  return true;
}
function showContact(command, old, next) {
  feedback.contact(command, old, next);
  const n=command.visualResult ?? touchResult(old,command),
    [a,b]=command.visualOperands || [old.players[old.active].hands[command.hand],old.players[1-old.active].hands[command.targetHand]];
  for(const write of command.visualWrites||[{owner:old.active,hand:command.hand,value:n}])handElements[write.owner][write.hand].querySelector('.hand-value').textContent=write.value;
  const el=document.querySelector('#combat-callout');
  el.innerHTML=`<small>${command.visualLabel||'主动手变数'}</small><b>${a}<i>+</i>${b}<i>=</i><em>${n}</em></b>`;
  el.classList.add('visible');
  document.querySelector('#contact-fx').classList.add('visible');
  play('click');
}

async function send(command) {
  if (busy || paused || state.winner !== null) return;
  if (mode === "online") {
    if(remotePending || !humanTurn()) return;
    remotePending=true; selected=null; render();
    try { await online.send({...command,revision:state.revision}); }
    catch(error){toast(error.message);}
    finally {remotePending=false;if(!busy)render();}
    return;
  }
  feedback.clearNotices();
  busy = true;
  selected = null;
  clearTimeout(aiTimer);
  info.hide();
  const old = state,
    current = session,
    serial = ++actionSerial;
  render();
  try {
    const full = { ...command, actor: old.active, revision: old.revision };
    const next = await current.send(full);
    const completed = await animateCommand(full, old, next, (visual) => {
      if (current === session && serial === actionSerial)
        showContact(visual, old, next);
    });
    if (!completed || current !== session || serial !== actionSerial) return;
    state = next;
    if (old.phase !== next.phase || old.turn !== next.turn)
      remaining = phaseSeconds(next);
    deadline = Date.now() + remaining * 1000;
    const events = forgeEvents(old, next, full);
    if (events.length) {
      document.querySelector("#combat-callout").classList.remove("visible");
      document.querySelector("#combat-callout").textContent = "";
      document.querySelector("#contact-fx").classList.remove("visible");
      for (const event of events) {
        play("forge");
        await feedback.forge(event, asset, next, participants());
        if (current !== session || serial !== actionSerial) return;
      }
    }
    document.querySelector("#combat-callout").classList.remove("visible");
      document.querySelector("#combat-callout").textContent = "";
    document.querySelector("#contact-fx").classList.remove("visible");
    render();
    announceSupply(next);
    const cue = phaseCue(old, next, participants());
    if (cue) {
      if (cue.kind === "finish") play("victory");
      await feedback.phase(cue, asset);
      if (current !== session || serial !== actionSerial) return;
    }
  } catch (error) {
    if (current === session) {
      state = session.getSnapshot();
      toast(error.message);
    }
  } finally {
    if (current === session && serial === actionSerial) {
      busy = false;
      deadline = Date.now() + remaining * 1000;
      document.querySelector("#combat-callout").classList.remove("visible");
      document.querySelector("#combat-callout").textContent = "";
      document.querySelector("#contact-fx").classList.remove("visible");
      render();
      if (mode === "tutorial") {
        // The chapter result remains on the battlefield until the learner continues.
      } else if (state.winner !== null) {
        showResult();
      } else {
        scheduleAI();
        if (command.type === "advance" && humanTurn())
          document
            .querySelector(".hand-hotspot.available, #attack")
            ?.focus({ preventScroll: true });
      }
    }
  }
}
function scheduleAI() {
  clearTimeout(aiTimer);
  if (mode === "online" || mode === "tutorial") return;
  if (state?.phase === "start" && !paused && !busy && started) {
    aiTimer=setTimeout(()=>send({type:"advance"}),80);
    return;
  }
  if (
    paused ||
    busy ||
    !started ||
    mode !== "ai" ||
    state.active !== 1 ||
    state.winner !== null
  )
    return;
  aiTimer = setTimeout(() => {
    const command = chooseCommand(state);
    if (command) send(command);
  }, 1000);
}
function startGame(newMode = mode, chapter = 0) {
  actionSerial++;
  stage?.cancel();
  unsubscribe?.();
  session?.dispose();
  clearTimeout(aiTimer);
  feedback.reset();
  clearTimeout(toast.timer);
  document.querySelector("#toast").classList.remove("visible");
  document.querySelector("#combat-callout").textContent="";
  mode = newMode;
  selected = null;
  busy = false;
  paused = false;
  remaining = 30;
  deadline = Date.now() + 30000;
  session = mode === "tutorial" ? new TutorialSession(chapter) : new LocalSession(crypto.getRandomValues(new Uint32Array(1))[0]);
  unsubscribe = session.subscribe((next) => {
    if (!busy) {
      state = next;
      render();
    }
  });
  stage?.setPaused(false);
  document.querySelector("#combat-callout").classList.remove("visible");
      document.querySelector("#combat-callout").textContent = "";
  document.querySelector("#contact-fx").classList.remove("visible");
  if (started && mode !== "tutorial") introPhase();
  else scheduleAI();
}
async function introPhase() {
  const serial = actionSerial;
  busy = true;
  render();
  await feedback.phase(phaseCue(null, state, participants()), asset);
  if (serial !== actionSerial) return;
  busy = false;
  deadline = Date.now() + remaining * 1000;
  render();
  announceSupply(state);
  scheduleAI();
}
function openDialog(content, cls = "") {
  info?.hide();
  paused = mode !== "online";
  stage?.setPaused(paused);
  feedback.pause(paused);
  clearTimeout(aiTimer);
  dialog.dataset.view = "";
  dialog.className = cls;
  dialog.innerHTML = content;
  if (!dialog.open) dialog.showModal();
}
function closeDialog() {
  dialog.close();
  paused = false;
  stage?.setPaused(false);
  feedback.pause(false);
  deadline = Date.now() + remaining * 1000;
  scheduleAI();
}
function showMenu(page = "home") {
  if(mode === "online" || online?.packet?.room || online?.packet?.queued) {showOnline();return;}
  if(typeof page !== "string")page="home";
  openDialog(menuMarkup(page,{started}),"menu-dialog game-menu");
  dialog.dataset.view="menu";dialog.dataset.page=page;dialog.querySelector(".menu-choice")?.focus({preventScroll:true});
}
function dismissDialog() {
  if(dialog.dataset.view==="online") {
    if(online?.packet?.queued || online?.packet?.room?.status==="waiting") {
      toast("请先取消匹配或离开房间");return;
    }
    if(!started){showMenu("play");return;}
  }
  if(!started){showMenu(dialog.dataset.page==="local"?"play":"home");return;}
  closeDialog();
}
function relevantRoutes(owner, hand) {
  return comboRoutes(state,owner,hand).filter(r=>r.weapon.recipe.includes(state.players[owner].hands[hand]) || r.ready);
}
function recipeRoutes(owner, hand) {
  return `<div class="combo-context">${state.players[owner].hands[hand]}<span>组合表</span></div><div class="combo-routes">${relevantRoutes(owner, hand).filter((r,i,all)=>all.findIndex(x=>x.weapon.recipe.join()===r.weapon.recipe.join())===i).map(({weapon:w, status, ready}) => `<button class="combo-route ${ready ? "reachable" : ""}" data-info="recipe:${w.recipe[0]}" data-info-only><b>${w.recipe.join(" · ")}</b><span>${WEAPONS.filter(x=>x.recipe.join()===w.recipe.join()).map(x=>x.name).join(" / ")}</span><small>${status}</small></button>`).join("")}</div>`;
}
function showRecipes(owner, hand) {
  const scoped=Number.isInteger(owner);
  const weapons=(scoped ? relevantRoutes(owner,hand).map(r=>r.weapon) : [...WEAPONS]).sort((a,b)=>Number(b.recipe[0]===5)-Number(a.recipe[0]===5));
  openDialog(
    `<div class="dialog-body"><button class="dialog-close" data-close aria-label="关闭组合图鉴">×</button><h2>数字组合</h2>${Number.isInteger(owner) ? recipeRoutes(owner, hand).replaceAll("<button", "<div").replaceAll("</button>", "</div>") : ""}<p class="recipe-intro">仅在合成阶段选择武器；确认后双手归 1。</p><div class="recipe-library">${weapons.map(
      (w) => {
        const d = describe(`weapon:${w.id}`, state);
        return `<article>${img(w.image)}<div><h3>${w.recipe.join(" · ")} <span>${w.name}</span></h3><p>${d.body}</p></div></article>`;
      },
    ).join(
      "",
    )}${!scoped || state.players[owner].hands[hand]===5 ? `<article>${img("shield.webp")}<div><h3>单手 5 <span>护盾</span></h3><p>${describe("shield", state).body} ${describe("shield", state).note}</p></div></article>` : ""}${!weapons.length ? "<p>当前数字没有可形成的组合</p>" : ""}</div><p class="recipe-intro">合成后本回合必须发动技能；放弃合成则计算。计算凑出的配方保留到下回合合成，期间可能被对手改变。</p></div>`,
    "recipes-dialog",
  );
  dialog.dataset.view="recipes";
}
function showHelp() {
  openDialog(`<div class="dialog-body concise-help"><button class="dialog-close" data-close aria-label="关闭玩法说明">×</button><small class="kicker">HOW TO PLAY</small><h2>借数字，出绝招。</h2><p class="help-goal">打空对手的 <b>99</b> 点生命，<br>或用 <b>9 + 9</b> 发动两次归一获胜。</p><ol class="rules"><li><b>开始</b><p>切换回合。自己的第 1、4、7…回合获得道具，最多存 3 个。</p></li><li><b>规划</b><p>使用道具调整数字或施加效果，也可直接结束规划。</p></li><li><b>合成</b><p>双手有合法配方才进入。选择技能后双手归 1；也可放弃。</p></li><li><b>行动</b><p>有技能就发动；没有就选自己的手，碰对手的手。必须行动。</p></li></ol><div class="help-example"><b>8 + 4 → 2</b><span>只改主动手，结果留个位。<br>计算凑出的组合，下个回合才能合成。</span></div><details><summary>防御、计时与详细查询</summary><p>单个 5 减半普通伤害后变为 1；55 免疫普通伤害且不消耗。真实伤害无视护盾；和平免疫所有伤害。认真一拳重置对手数字并清除盾墙。</p><p>规划、合成、计算各 30 秒，技能 10 秒；超时自动行动。无合法计算才自动结束。${mode==='online'?'联机查看菜单或切后台不暂停。':'本地打开菜单或切后台暂停；教学没有倒计时。'}</p><p>「组合图鉴」随时查询全部技能；悬停道具、状态或点 i 查看详情。</p></details><button class="primary" data-close>${started?'继续对局':'返回主菜单'} →</button></div>`);
}

function showResult() {
  const winner = state.winner;
  const lost = mode === "online" ? winner !== online.packet.room.seat : mode === "ai" && winner !== 0;
  openDialog(
    `<div class="result-art">${img(`manga/${winner ? "red" : "blue"}.webp`)}<span aria-hidden="true">${lost ? "DEFEAT" : "VICTORY"}</span></div><div class="result-content"><small class="result-eyebrow">MATCH COMPLETE / 决着</small><div class="result-stamp">${lost ? "败北" : "胜利"}<i>!</i></div><h2>${name(winner)}<span>获胜</span></h2><div class="result-score"><div><small>${name(0)}</small><b>${state.players[0].hp}</b></div><span>:</span><div><small>${name(1)}</small><b>${state.players[1].hp}</b></div></div><p>第 ${Math.ceil(state.turn/2)} 轮 · ${state.winReason ? escapeHtml(state.winReason) : mode === "online" && online.packet.room.finishReason ? escapeHtml(online.packet.room.finishReason) : lost ? "下一手，扳回来。" : "这一局，拿下。"}</p>${mode === "online" ? '<button class="primary" id="online">返回房间 / 再战 →</button>' : `<button class="primary" data-mode="${mode}">再战一局 <span>→</span></button>`}<button class="text-button" data-close>查看战场</button></div>`,
    `result-dialog manga-result ${lost ? "defeat" : "victory"} winner-${winner}`,
  );
}

function showOnline(reveal = true) {
  if(!online) {
    online=new OnlineClient(receiveRemote,()=>{if(dialog.dataset.view==="online") refreshLobby();if(mode==="online"&&!busy)render();});
    online.connect();
  }
  if(reveal){openDialog(onlineMarkup(online),"online-dialog");dialog.dataset.view="online";}
}
function refreshLobby() {
  if(dialog.dataset.view!=="online")return;
  const field=dialog.querySelector(":focus"), id=field?.id, value=field?.value, start=field?.selectionStart, end=field?.selectionEnd;
  dialog.innerHTML=onlineMarkup(online);
  if(id){const input=dialog.querySelector(`#${id}`);if(input){if(input.tagName==="INPUT"){if(id!=="online-name")input.value=value;input.setSelectionRange(start,end);}input.focus();}}
}
async function onlineAction(id) {
  if(online?.busy)return;
  if(id==="online-join"){online.view="join";online.error="";refreshLobby();dialog.querySelector('#room-code')?.focus();return;}
  if(id==="online-options"){online.view="home";const url=new URL(location.href);url.searchParams.delete("room");history.replaceState(null,"",url);refreshLobby();return;}
  if(id==="online-back"){showMenu("play");return;}
  if(id==="online-reconnect"){online.connect();return;}
  if(id==="online"){showOnline();return;}
  try {
    if(id==="copy-room") {const url=new URL(location.href);url.searchParams.set("room",online.packet.room.code);await navigator.clipboard.writeText(url.href);toast("邀请链接已复制");return;}
    if(id==="online-leave"&&online.packet?.room?.status==="playing") {
      openDialog('<div class="dialog-body"><h2>离开当前对局？</h2><p>离开会判负，对手将获胜。</p><button class="primary" id="online-leave-confirm">离开并认输</button><button class="text-button" data-close>继续对局</button></div>');return;
    }
    const ops={"online-create":"create","online-queue":"queue","online-cancel":"cancel","online-ready":"ready","online-rematch":"rematch","online-leave":"leave","online-leave-confirm":"leave"};
    const op=ops[id];if(!op)return;
    online.busy=true;online.error="";refreshLobby();
    if(["create","queue","ready","rematch"].includes(op))await online.saveDraft();
    await online.request(op,op==="ready"?{ready:!online.packet.room.ready[online.packet.room.seat]}:{});
    if(op==="rematch")showOnline();
  } catch(error){online.error=error.message;if(dialog.dataset.view!=="online")toast(error.message);}
  finally {if(online){online.busy=false;refreshLobby();}}
}
listen(dialog,"input",e=>{if(e.target.id==="room-code")online.joinCode=e.target.value;if(e.target.id==="online-name")online.nameDraft=e.target.value;});
listen(dialog,"submit",async e=>{
  if(!["name-form","join-form"].includes(e.target.id))return;
  e.preventDefault();if(online.busy)return;
  const form=e.target, value=new FormData(form).get(form.id==="name-form"?"name":"code");
  online.busy=true;online.error="";refreshLobby();
  try {if(form.id==="name-form"){await online.rename(value);toast("名字已保存");}else {await online.saveDraft();await online.request("join",{code:value});}}
  catch(error){online.error=error.message;}
  finally {online.busy=false;refreshLobby();}
});
function receiveRemote(packet) {
  const room=packet.room;
  if(room){online.view="home";online.joinCode="";const url=new URL(location.href);if(url.searchParams.has("room")){url.searchParams.delete("room");history.replaceState(null,"",url);}}
  refreshLobby();
  if(!room?.state){if(room?.status==="waiting"&&dialog.dataset.view==="menu")showOnline();if(mode==="online"){remoteMatch=null;remoteQueue=[];started=false;startGame("ai");showOnline();}return;}
  if(remoteMatch!==room.matchId||mode!=="online") {
    actionSerial++;stage?.cancel();feedback.reset();unsubscribe?.();session?.dispose();clearTimeout(aiTimer);
    remoteQueue=[];remoteApplying=false;remoteMatch=room.matchId;session=online;mode="online";started=true;selected=null;busy=false;remotePending=false;paused=false;state=room.state;
    stage?.setPaused(false);if(dialog.open)closeDialog();render();if(state.winner!==null)showResult();else if(state.phase==="start")introRemote();return;
  }
  if(room.state.revision<=state.revision){if(!busy)render();return;}
  if(remoteQueue.some(p=>p.room.state.revision===room.state.revision))return;
  remoteQueue.push(packet);drainRemote();
}
async function introRemote() {
  const serial=actionSerial;busy=true;remoteApplying=true;render();
  await feedback.phase(phaseCue(null,state,participants()),asset);
  if(serial!==actionSerial)return;
  busy=false;remoteApplying=false;render();announceSupply(state);drainRemote();
}
async function drainRemote() {
  if(remoteApplying)return;remoteApplying=true;const serial=actionSerial;
  try {
    while(remoteQueue.length&&serial===actionSerial) {
      const packet=remoteQueue.shift(),room=packet.room,old=state,next=room.state;
      if(next.revision<=old.revision)continue;
      busy=true;selected=null;info?.hide();render();
      const event=room.event;
      if(!document.hidden&&!dialog.open&&remoteQueue.length<2&&event&&next.revision===old.revision+1&&online.serverNow()<=(room.readyAt||0)+500) {
        await animateCommand(event.command,old,next,visual=>{if(serial===actionSerial)showContact(visual,old,next);});
        if(serial!==actionSerial)return;
        for(const f of forgeEvents(old,next,event.command))await feedback.forge(f,asset,next,participants());
      }
      if(serial!==actionSerial)return;
      state=next;document.querySelector('#combat-callout').textContent='';document.querySelector('#combat-callout').classList.remove('visible');document.querySelector('#contact-fx').classList.remove('visible');render();
      if(!document.hidden&&!dialog.open&&!remoteQueue.length)await feedback.phase(phaseCue(old,next,participants()),asset);
      if(serial!==actionSerial)return;
      busy=false;render();announceSupply(state);if(state.winner!==null)showResult();
    }
  } finally {if(serial===actionSerial){remoteApplying=false;busy=false;render();}}
}

info = setupInfo(app, () => state, asset, participants, () => mode === "online");
listen(app, "click", (e) => {
  const tutorialAction=e.target.closest('button')?.id;
  if(mode==='tutorial') {
    if(tutorialAction==='tutorial-exit'){exitTutorial();return;}
    if(tutorialAction==='tutorial-retry'){nextTutorial(session.chapter);return;}
    if(tutorialAction==='tutorial-next'&&!busy){if(session.chapter===LESSONS.length-1)exitTutorial();else nextTutorial(session.chapter+1);return;}
    if(tutorialAction==='online'){toast('先退出教学，再选择联机对战');return;}
  }

  battleSound.unlock();
  const detail=e.target.closest('.hand-shield');
  if(detail){info.show(detail,true);return;}
  const button = e.target.closest("button");
  if (!button) {
    if (selected && !busy && e.target.closest("#stage")) {
      selected = null;
      render();
    }
    return;
  }
  if (button.disabled) return;
  if (button.hasAttribute("data-info-only")) {
    info.show(button, true);
    return;
  }
  if (button.dataset.forge) { send({type:"forge",weapon:button.dataset.forge}); return; }
  if (button.dataset.hand !== undefined) {
    const owner = Number(button.dataset.owner),
      hand = Number(button.dataset.hand);
    if (busy || remotePending || (mode === "online" && (online.status !== "connected" || online.serverNow() < (online.packet?.room?.readyAt || 0)))) return;
    const computing = humanTurn() && state.phase === "action" && !state.players[state.active].weapon && state.winner === null;
    if (selected?.kind === "prop") {
      if (canTarget(owner, hand)) send({type:"prop",slot:selected.slot,target:owner,targetHand:hand});
      return;
    }
    if (!computing) { if(mode !== "tutorial") showRecipes(owner,hand); return; }
    if (state.players[owner].locks[hand]) return;
    if (owner === state.active) {
      selected =
        selected?.kind === "hand" && selected.hand === hand
          ? null
          : { kind: "hand", hand };
      play("click");
      render();
    } else if (selected?.kind === "hand")
      send({ type: "add", hand: selected.hand, targetHand: hand });
    return;
  }
  if (button.dataset.player !== undefined) {
    const owner = Number(button.dataset.player);
    if (selected?.kind === "prop" && canTarget(owner))
      send({ type: "prop", slot: selected.slot, target: owner });
    else info.show(button, true);
    return;
  }
  if (button.dataset.prop !== undefined) {
    if (button.getAttribute("aria-disabled") === "true") {
      info.show(button, true);
      return;
    }
    selected =
      selected?.kind === "prop" && selected.slot === Number(button.dataset.prop)
        ? null
        : { kind: "prop", slot: Number(button.dataset.prop) };
    play("click");
    render();
    return;
  }
  const handlers = {
    "use-prop": () => {const id=state.players[state.active].props[selected.slot];send({type:"prop",slot:selected.slot,target:PROPS[id].target==="enemy"?1-state.active:state.active});},
    advance: () => send({ type: "advance" }),
    attack: () => send({ type: "attack" }),
    decline: () => send({ type: "decline" }),
    cancel: () => {
      selected = null;
      render();
    },
    again: () => mode === "online" ? showOnline() : startGame(),
    online: showOnline,
    menu: () => showMenu(),
    help: showHelp,
    sound: () => {
      sound = !sound;
      button.setAttribute("aria-pressed", String(sound));
      button.innerHTML = `音效 <span>${sound ? "开" : "关"}</span>`;
      play("click");
    },
    history: () =>
      openDialog(
        `<div class="dialog-body"><button class="dialog-close" data-close aria-label="关闭战报">×</button><div class="kicker">BATTLE LOG</div><h2>这一局的每一手。</h2><ol class="history-list">${state.log.map((x) => `<li>${x}</li>`).join("")}</ol><small>最近 30 条。导出回放可保留完整操作。</small></div>`,
      ),
    replay: () => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(session.exportReplay(), null, 2)], {
          type: "application/json",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "finger-fight-replay.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("本局回放已导出");
    },
  };
  handlers[button.id]?.();
});
listen(dialog, "click", (e) => {
  if(e.target===dialog && dialog.dataset.view==="recipes") {
    dismissDialog();return;
  }
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.menu) {showMenu(b.dataset.menu);return;}
  if (b.hasAttribute("data-menu-help")) {showHelp();return;}
  if (b.id?.startsWith("online") || b.id === "copy-room") {onlineAction(b.id);return;}
  if (b.hasAttribute("data-info-only")) { info.show(b, true); return; }
  if (b.dataset.mode) {
    started = true;
    closeDialog();
    startGame(b.dataset.mode);
  } else if (b.hasAttribute("data-close")) dismissDialog();
});
listen(dialog, "cancel", (e) => { e.preventDefault(); dismissDialog(); });
listen(document, "keydown", (e) => {
  if (e.key === "Escape" && !dialog.open && selected && !busy) {
    selected = null;
    render();
  }
});
listen(document, "visibilitychange", () => {
  if (mode === "online") {
    const room=online.packet?.room;
    if(room?.state && room.matchId===remoteMatch) {
      actionSerial++;stage?.cancel();feedback.reset();info?.hide();
      remoteQueue=[];remoteApplying=false;busy=false;selected=null;state=room.state;render();
      if(!document.hidden&&state.winner!==null)showResult();
    }
    return;
  }
  if (document.hidden && started && !dialog.open && state.winner === null)
    openDialog('<div class="dialog-body"><div class="kicker">PAUSED</div><h2>下一手，等你。</h2><p>对局已暂停，回到战场继续出手。</p><button class="primary" data-close>继续对局 →</button></div>');
});
const ticker = setInterval(() => {
  if(mode === "online") {
    const room=online.packet?.room;
    updateNetworkNotice();
    if(room?.state){remaining=room.deadlineAt ? Math.max(0,Math.ceil((room.deadlineAt-online.serverNow())/1000)):0;document.querySelector("#clock").textContent=online.status==="connected"&&!busy?remaining:"—";document.querySelector("#phase-time").classList.toggle("urgent",remaining<=5);
      const ready = online.status === 'connected' && online.serverNow() >= room.readyAt;
      if(!busy && !remotePending && ready !== renderedRemoteReady)render();}
    return;
  }
  if (mode === "tutorial" || paused || busy || !started || !state || state.winner !== null) return;
  remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  document.querySelector("#clock").textContent = mode==="online"&&(online.status!=="connected"||busy)?"—":remaining;
  document
    .querySelector("#phase-time")
    .classList.toggle("urgent", remaining <= 5);
  if (remaining === 0)
    send(state.phase === "planning" || state.phase === "start" ? {type:"advance"} : chooseCommand(state));
}, 200);

startGame();
try {
  const { DuelStage } = await import("./stage.js");
  stage = new DuelStage(
    document.querySelector("#stage"),
    (owner, hand, x, y, scale) => {
      const el = handElements[owner][hand];
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.setProperty("--hand-scale", scale);
    },
  );
  document.querySelector("#render-status").textContent = "3D 对战场";
  stage.sync(state, selected);
} catch (error) {
  console.warn("WebGL unavailable; using accessible 2D fallback.", error);
  const host = document.querySelector("#stage");
  host.classList.add("webgl-fallback");
  host.dataset.renderer = "fallback";
  stage = {
    sync() {},
    setPaused() {},
    cancel() {},
    animate(c, old, next, contact) {
      contact();
      return Promise.resolve(true);
    },
    dispose() {
      this.cancel();
    },
  };
  document.querySelector("#render-status").textContent = "兼容模式";
}
showMenu(true);
let resumeOnline = new URL(location.href).searchParams.has("room");
try { resumeOnline ||= !!sessionStorage.getItem("ff-token"); } catch {}
if(resumeOnline)showOnline(new URL(location.href).searchParams.has("room"));
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    actionSerial++;
    listeners.abort();
    info?.dispose();
    clearTimeout(toast.timer);
    clearInterval(ticker);
    clearTimeout(aiTimer);
    feedback.reset();
    stage?.dispose();
    session?.dispose();
    online?.close();
  });

let spotlightFrame=0,spotlightMarkup="";
const spotlight=document.createElementNS('http://www.w3.org/2000/svg','svg');
spotlight.id='tutorial-spotlight';spotlight.setAttribute('aria-hidden','true');document.body.append(spotlight);
function updateSpotlight(){
  spotlight.style.display=mode==='tutorial'&&!busy&&!dialog.open?'block':'none';
  if(spotlight.style.display==='block'){
    const holes=[...document.querySelectorAll('.tutorial-target, #tutorial-guide, #cancel, #tutorial-next')].filter(el=>el.getClientRects().length).map(el=>{
      const r=el.getBoundingClientRect();return `<rect x="${r.left-5}" y="${r.top-5}" width="${r.width+10}" height="${r.height+10}" rx="8" fill="black"/>`;
    }).join('');
    const markup=`<defs><mask id="tutorial-holes"><rect width="100%" height="100%" fill="white"/>${holes}</mask></defs><rect width="100%" height="100%" fill="#32343d" opacity=".65" mask="url(#tutorial-holes)"/>`;
    if(markup!==spotlightMarkup){spotlight.innerHTML=markup;spotlightMarkup=markup;}
  }
  spotlightFrame=requestAnimationFrame(updateSpotlight);
}
spotlightFrame=requestAnimationFrame(updateSpotlight);

if(import.meta.hot)import.meta.hot.dispose(()=>{cancelAnimationFrame(spotlightFrame);spotlight.remove();});
