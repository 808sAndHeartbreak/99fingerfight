import { createCombatCinema } from "./combat-cinema.js";
import { createAudioSettings } from "./audio-settings.js";
import { historyMarkup } from "./match-history.js";

import { createBattleSound } from "./battle-sound.js";
import { TutorialSession, LESSONS } from "./tutorial.js";
import { menuMarkup } from "./menu.js";
import { OnlineClient, onlineMarkup } from "./online.js";
import { synthesisOptions, supplyIn, hasTurnOptions, canEndTurn, propCommands } from "./engine.js";
import { playerName, escapeHtml, shortName } from "./identity.js";
import { phaseCue, turnSeconds, TURN_SECONDS } from "./phase-cue.js";
import "./style.css";
import "./comfort.css";
import "./menu.css";
import "./battle-layout.css";
import "./visual-polish.css";
import "./turn-ui.css";
import "./event-ui.css";
import "./arena-layout.css";
import "./arena-poster.css";
import "./scene-ui.css";
import { WEAPONS, PROPS, MAX_HP, weaponById } from "./catalog.js";
import { LocalSession } from "./session.js";
import { chooseCommand, AI_LEVELS } from "./ai.js";
import { touchResult, touchVisualSteps } from "./motion.js";
import { guidance, handPreview } from "./guidance.js";
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
  sound = true,
  aiTimer,
  deadline,
  remaining = TURN_SECONDS,
  started = false;
let stage,
  info,
  unsubscribe,
  actionSerial = 0;
const participants = () => session?.getParticipants() || [];
const name = (seat) => escapeHtml(playerName(participants(), seat));
let renderedRemoteReady = false;
let online, remoteMatch = null, remoteQueue = [], remoteApplying = false;
let forgeUi={key:'',choice:null,hidden:false};
function updateClockWarning(){const el=document.querySelector('#phase-time'),seconds=Math.ceil(remaining);el.classList.toggle('warning',mode!=='tutorial' && seconds>=6 && seconds<=10);el.classList.toggle('urgent',mode!=='tutorial' && seconds<=5);}
const humanTurn = () => mode === "online" ? online?.packet?.room?.seat === state.active : mode === "local" || state.active === 0;
const team = (id) => (id === 0 ? "蓝方" : "红方");
const audioCache = new Map();
const audioSettings=createAudioSettings(asset("music/pixel.mp3"));
const battleSound=createBattleSound(()=>sound,audioSettings);
let cinema, aiWorker, aiJob=0, aiDifficulty='advanced';
function stopAI(){clearTimeout(aiTimer);aiJob++;aiWorker?.terminate();aiWorker=null;}
function requestAI(){
 const job=++aiJob,revision=state.revision,current=session;
 const accept=command=>{if(job!==aiJob||session!==current||state.revision!==revision||paused||busy||mode!=='ai')return;clearTimeout(aiTimer);aiWorker?.terminate();aiWorker=null;if(command)send(command);};
 const fallback=()=>accept(chooseCommand(state,aiDifficulty));
 try{
  aiWorker=new Worker(new URL('./ai-worker.js',import.meta.url),{type:'module'});
  aiWorker.onmessage=({data})=>data.error?fallback():accept(data.command);
  aiWorker.onerror=fallback;
  aiWorker.postMessage({id:job,state,difficulty:aiDifficulty});
  aiTimer=setTimeout(fallback,2500);
 }catch{fallback();}
}

function play(id) {
  if (!sound) return;
  if (!audioCache.has(id)) audioCache.set(id, new Audio(asset(`${id}.wav`)));
  const a = audioCache.get(id);
  a.currentTime = 0;
  a.volume = audioSettings.values.effects * 0.3;
  a.play().catch(() => {});
}

app.innerHTML = `<main class="game-shell">
  <div class="paper-grain" aria-hidden="true"></div>

  <div id="network-notice" class="network-notice" role="status" hidden></div><span id="mode-label" hidden></span>
  <section class="duel" aria-label="指尖对战场"><div class="arena-art" aria-hidden="true"><i class="arena-portrait blue"></i><i class="arena-portrait red"></i></div>
    <div class="scoreboard"><div id="player-0" class="player blue"></div><div class="round-block" aria-label="回合与倒计时"><span class="round-caption">回合 <b id="round-number">01</b></span><div class="phase-time" id="phase-time" role="timer" aria-live="off" aria-label="剩余时间"><span id="clock">30</span><small>秒</small></div><span id="turn-arrow" class="turn-arrow" aria-hidden="true">←</span><span id="phase-label" class="sr-only"></span></div><div id="player-1" class="player red"></div></div>
    <div id="stage" class="stage" data-motion="idle"><div class="hand-layer" id="hand-layer">${[0, 1].map((owner) => [0, 1].map((hand) => `<button id="hand-${owner}-${hand}" class="hand-hotspot ${owner ? "red" : "blue"}" data-owner="${owner}" data-hand="${hand}" aria-pressed="false"><span class="hand-corner"></span>${img("hand-1.webp", "fallback-hand")}<b class="hand-value">1</b><span class="hand-status"></span><span class="hand-shield" data-info="shield" data-info-only hidden></span><span class="sum-preview"></span></button>`).join("")).join("")}</div><div class="contact-fx" id="contact-fx" aria-hidden="true">${img("manga/contact.webp")}<b>碰!</b></div></div>
    <div id="combat-callout" class="combat-callout" aria-live="polite"></div>
    <div class="field-note" aria-hidden="true"></div>
    <div id="items-0" class="field-items blue" aria-label="蓝方道具"></div><div id="items-1" class="field-items red" aria-label="红方道具"></div>
    <div class="arena-center"><section class="arena-actions" aria-label="当前操作"><div class="turn-instruction"><h1 id="instruction" aria-live="polite"></h1></div><section id="tutorial-guide" class="tutorial-guide" hidden aria-label="新手教学"></section><div id="primary-actions" class="primary-actions"></div><button id="end-turn" class="end-turn">结束回合</button></section></div>
    <section id="forge-options" class="forge-options" hidden aria-label="合成选项"></section>
  </section>
  <section class="reference-deck" aria-label="常驻组合图鉴"><nav class="hud-tools" aria-label="游戏工具"><button id="history">对局记录</button><button id="menu">菜单 ☰</button></nav><span id="render-status" hidden></span><div id="recipe-shelf" class="recipe-shelf" tabindex="0" aria-label="横向滚动查看组合"></div></section>
</main><div id="menu-backdrop" class="game-menu menu-backdrop" aria-hidden="true" inert>${menuMarkup("home")}</div><dialog id="dialog"></dialog><aside id="info-popover" role="tooltip" hidden></aside><div id="toast" class="toast" role="status"></div>`;

document.querySelector('#recipe-shelf').addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)&&event.target.matches('.reference-recipe')){event.preventDefault();event.target.click();}},{signal:listeners.signal});

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
function announceSupply(next) {
 const notes=[0,1].flatMap(owner=>(next.events||[]).some(e=>e.type==='supply-full'&&e.owner===owner)?[`${playerName(participants(),owner)}背包已满，本次补给跳过`]:[]);
 if(notes.length)toast(notes.join('；'),3600);
}

function canTarget(owner, hand) {
  if (!selected || busy || remotePending || (mode==='tutorial' && !session.canProceed) || (mode === "online" && online.status !== "connected") || !humanTurn() || state.winner !== null) return false;
  if (selected.kind === "hand")
    return (
      owner !== state.active &&
      hand !== undefined &&
      !state.players[owner].locks[hand]
    );
  const id=state.players[state.active].props[selected.slot];
  return !state.players[state.active].silenced && hand !== undefined && PROPS[id]?.target === "hand" && (id!=="lock" || !state.players[owner].locks.some(Boolean));
}
function renderPlayer(owner) {
  const p = state.players[owner],
    active = state.active === owner && state.winner === null;
  const presence=mode==="online" ? participants().find(x=>x.seat===owner) : null;
  const presenceText=presence ? presence.departed?"已离开":online.status!=="connected"?(owner===online.packet.room.seat?"重连中":"待同步"):presence.connected?"在线":"已断线" : "";
  const statusIcons={echo:'echo',mirror:'mirror',silenced:'silence',skip:'taser',seven:'seven',dark:'dark',foam:'foam',knuckles:'knuckles',peace:'peace',weak:'serpent',poison:'serpent',wine:'wine',adrenaline:'adrenaline',resilience:'resilience',nine:'nine-seal'};
  const statuses=Object.keys(statusIcons).filter(key=>p[key]).map(key=>{
    const d=describe(`status:${key}:${owner}`,state);
    const count=({skip:p.skip,seven:p.seven,dark:'∞',foam:p.foam,knuckles:`+${p.knuckles*10}`,peace:p.peace,weak:`弱${p.weak}`,poison:`毒${p.poison}`,wine:`+${p.wine*10}`,adrenaline:p.adrenaline,resilience:p.resilience,nine:`${p.nine}/2`})[key];
    return `<button class="status-icon" data-info="status:${key}:${owner}" data-info-only aria-label="${d.title}，${d.stats[0][1]}">${img(`ink-mono/${statusIcons[key]}.webp`)}${count!==undefined?`<b class="status-count">${count}</b>`:''}</button>`;
  }).join('');
  const mine=mode==='online'?owner===online.packet.room.seat:mode==='local'?owner===state.active:owner===0;
  const identity=mine?'（我）':mode==='ai'&&owner===1?AI_LEVELS[aiDifficulty]:'';
  document.querySelector(`#player-${owner}`).innerHTML =
    `<div class="player-head"><div class="player-identity">${mine&&mode!=="tutorial"?`<button class="player-name" data-edit-name="${owner}" aria-label="修改昵称：${name(owner)}">${name(owner)}</button>`:`<strong title="${name(owner)}">${name(owner)}</strong>`}${identity?`<small class="seat-label">${identity}</small>`:''}${presence?`<small class="player-presence ${presenceText==='在线'?'connected':''}" aria-label="${presenceText}"><i class="status-dot"></i>${presenceText==='在线'?'':presenceText}</small>`:''}</div><div class="health-number"><b>${p.hp}</b><small>/ ${MAX_HP}</small></div></div><div class="hp-bar" role="meter" aria-label="${team(owner)}生命" aria-valuenow="${p.hp}" aria-valuemin="0" aria-valuemax="${MAX_HP}"><span class="hp-trail" style="width:${(p.hp/MAX_HP)*100}%"></span><i style="width:${(p.hp/MAX_HP)*100}%"></i></div><div class="status-strip">${statuses}</div><div class="player-loadout"></div>`;
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
          !busy && !remotePending && (mode!=='tutorial' || session.canProceed) && (mode !== "online" || online.status === "connected" && online.serverNow() >= (online.packet?.room?.readyAt || 0)) &&
          humanTurn() &&
          state.phase === "action" && !state.calculated &&
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
      const combo=WEAPONS.some(w=>w.recipe.every((value,index)=>value===p.hands[index]));
      el.classList.toggle("combo-ready",combo);
      if(combo)el.dataset.info=`combo:${n}`;else if(n===5)el.dataset.info="shield";else delete el.dataset.info;
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
function render(preserveInfo=false) {
  if(mode === "online") {
    const until=online.packet?.room?.deadlineAt;
    remaining=until ? Math.max(0,Math.ceil((until-Math.max(online.serverNow(),online.packet.room.readyAt||0))/1000)) : 0;
  }
  renderedRemoteReady = mode === "online" && online.status === "connected" && online.serverNow() >= (online.packet?.room?.readyAt || 0);
  if(!preserveInfo)info?.hide();
  document.querySelector("#phase-time").hidden = state.winner !== null || state.phase === "start";
  document.querySelector("#clock").textContent = mode==="tutorial"?"∞":mode==="online"&&online.status!=="connected"?"—":Math.ceil(remaining);
  updateClockWarning();
  document.querySelector("#phase-time small").textContent=mode==="tutorial"?"练习":"秒";
  renderPlayer(0);
  renderPlayer(1);
  renderHands();
  document.querySelector("#mode-label").textContent =
    mode === "online" ? "联机对战" : mode === "tutorial" ? "新手教学" : mode === "ai" ? "人机练习" : "同屏双人";
  const notice=document.querySelector("#network-notice"), peer=online?.packet?.room?.participants?.find(p=>p.seat!==online.packet.room.seat);
  notice.hidden=mode!=="online" || (online.status==="connected" && peer?.connected!==false) || state.winner!==null;
  updateNetworkNotice();
  document.querySelector("#round-number").textContent = String(
    Math.ceil(state.turn / 2),
  ).padStart(2, "0");
  const p = state.players[state.active],
    enabled = !busy && !remotePending && (mode!=='tutorial' || session.canProceed) && humanTurn() && state.winner === null && (mode !== "online" || online.status === "connected" && online.serverNow() >= (online.packet?.room?.readyAt || 0));
  document.querySelector("#phase-label").textContent=state.winner!==null?'对局结束':`${team(state.active)}的回合`;
  document.querySelector('#turn-arrow').textContent=state.active?'→':'←';
  document.querySelector('.round-block').dataset.team=state.active;
  document.querySelector('#turn-arrow').hidden=state.winner!==null;
  const guide = mode==="online"&&online.status!=="connected"&&state.winner===null ? {title:"正在恢复对局",detail:"连接恢复后继续操作",step:"waiting"} : guidance(state, selected, humanTurn(), busy);
  if(mode==="online" && online.status==="connected" && !busy && !renderedRemoteReady && state.winner===null) Object.assign(guide,{title:"",detail:"",step:"waiting"});
  if(remotePending && !busy && mode==="online" && online.status==="connected") Object.assign(guide,{title:"",detail:"",step:"waiting"});

  if(mode==="tutorial" && !busy && !session.done && !selected)guide.title=session.guide.title;
  if(mode==="tutorial" && !busy && !session.canProceed)guide.title=session.guide.requiresInfo.startsWith("shield")?"查看下方 [5] 护盾图鉴":"查看下方 [6] + [6] 图鉴";
  feedback.reveal(document.querySelector("#instruction"), guide.title);
  document.querySelector(".game-shell").dataset.step = guide.step;
  document.querySelector(".game-shell").dataset.actor = state.active;
  document.querySelector(".game-shell").dataset.phase = state.phase;
  const forgeKey=`${mode}:${actionSerial}:${state.revision}`;
  if(forgeUi.key!==forgeKey)forgeUi={key:forgeKey,choice:null,hidden:false};
  const forgeAvailable=enabled && !selected && humanTurn() && state.phase==='action' && !p.weapon && synthesisOptions(state).length>0 && (mode!=='tutorial'||session.guide?.command.type==='forge');
  const forgePanel=document.querySelector('#forge-options'),chosen=forgeUi.choice&&weaponById(forgeUi.choice);
  forgePanel.hidden=!forgeAvailable || forgeUi.hidden;
  for(const el of document.querySelectorAll('#stage,.field-items'))el.inert=!forgePanel.hidden;
  forgePanel.innerHTML=forgePanel.hidden?'':chosen?`<div class="forge-confirm-art">${img(chosen.image,'skill-icon')}</div><small class="forge-eyebrow">${p.hands.map(n=>`[${n}]`).join(' + ')} · 合成技能</small><h2>${chosen.name}</h2><p class="forge-detail">${chosen.detail}</p><p class="forge-note">确认后立即释放，结算后双手归 [1]</p><div class="forge-buttons"><button id="confirm-forge">确认释放</button><button id="back-forge">返回</button></div>`:`<div class="forge-heading"><div><small class="forge-eyebrow">${p.hands.map(n=>`[${n}]`).join(" + ")} · 数字合成</small><h2>选择你的技能</h2></div><button id="cancel-forge">放弃合成</button></div><p class="forge-intro">${mode==='tutorial'?`本次练习选择${weaponById(session.guide.command.weapon).name}；其他技能可在正式对局使用。`:'选择一种技能，确认后立即释放；结算后双手归 [1]。'}</p><div class="forge-choices">${synthesisOptions(state).map(w=>`<button data-forge="${w.id}" ${mode==='tutorial'&&session.guide?.command.weapon!==w.id?'disabled':''}>${img(w.image,'skill-icon')}<strong>${w.name}</strong><span>${w.detail}</span></button>`).join('')}</div>`;
  forgePanel.classList.toggle('confirming',!!chosen);
  for(const owner of [0,1]) {
    const player=state.players[owner], usable=owner===state.active && enabled && state.phase==="action" && !p.weapon && !player.silenced;
    const supply=player.turns===0?1:supplyIn(player);
    document.querySelector(`#items-${owner}`).classList.toggle("items-usable",usable&&player.props.length>0);
    document.querySelector(`#items-${owner}`).classList.toggle("items-remaining",usable && state.calculated && propCommands(state).length>0 && !synthesisOptions(state).length);
    document.querySelector(`#items-${owner}`).innerHTML=`<div class="supply-dots" data-info="supply:${owner}" tabindex="0" aria-label="道具补给：${supply} 回合后">${[1,2,3].map(n=>`<i class="${n<=3-supply?'filled':''}"></i>`).join('')}</div>`+[0,1,2].map(slot=>{
      const id=player.props[slot], mine=owner===state.active && humanTurn();
      return id ? `<div class="prop-slot ${mine&&selected?.kind==='prop'&&selected.slot===slot?'selected':''}"><button class="prop-use" ${mine?`data-prop="${slot}"`:'data-info-only'} data-info="prop:${id}:${owner}" aria-disabled="${!usable || !propCommands(state).some(c=>c.slot===slot)}" aria-label="${mine?'使用':'查看'}${PROPS[id].name}">${propArt(id)}<b>${PROPS[id].name}</b></button>${mine&&selected?.kind==='prop'&&selected.slot===slot&&PROPS[id].target!=='hand'?`<button class="prop-confirm" id="use-prop" ${usable?'':'disabled'}>确认使用</button>`:''}</div>` : '<div class="prop-slot empty" aria-label="空道具位"><span>＋</span></div>';
    }).join('');
  }
  const shelf=document.querySelector('#recipe-shelf');
  if(!shelf.children.length)shelf.innerHTML=`<div class="reference-recipe shield-reference" role="button" tabindex="0" data-info="shield:0" aria-label="5 护盾"><b>[5]</b></div>`+[5,0,2,4,6,7,8,9].map(n=>{
    return `<div class="reference-recipe" role="button" tabindex="0" data-number="${n}" data-info="recipe:${n}" aria-label="${n} 加 ${n} 配方"><b>[${n}] + [${n}]</b></div>`;
  }).join('');
  for(const el of shelf.children){const n=Number(el.dataset.number);el.classList.toggle('ready',p.hands.every(v=>v===n));el.classList.toggle('related',!p.hands.every(v=>v===n)&&p.hands.includes(n));}
  document.querySelector("#primary-actions").innerHTML = `${selected?.kind==='prop' ? '<button class="cancel-action" id="cancel">取消选择</button>' : ""}${state.winner !== null ? `<button class="primary" id="${mode === "online" ? "online" : "again"}">${mode === "online" ? "返回房间" : "再战一局"}</button>` : ""}`;
  if(forgeAvailable && forgeUi.hidden)document.querySelector('#primary-actions').insertAdjacentHTML('afterbegin','<button id="open-forge">合成技能</button>');
  const endButton=document.querySelector('#end-turn');
  endButton.hidden=state.winner!==null;
  endButton.disabled=!enabled || !canEndTurn(state) || (mode==='tutorial' && (session.guide?.command.type!=='end' || !session.canProceed));
  endButton.classList.toggle('recommended',!endButton.disabled && state.calculated);
  endButton.classList.toggle('urgent',!endButton.disabled && !hasTurnOptions(state));
  endButton.textContent='结束回合';
  endButton.setAttribute('aria-label',!state.calculated?'结束回合，本回合尚未计算':!hasTurnOptions(state)?'结束回合，没有其他可用操作':'结束回合');
  document.querySelector('.game-shell').classList.toggle('needs-calculation',enabled && state.phase==='action' && !state.calculated && !p.weapon && !selected && (mode!=='tutorial' || session.guide?.command.type==='add'));

  document.querySelector(".game-shell").classList.toggle("is-busy", busy);
  document.querySelectorAll("#menu,#help").forEach((b) => (b.disabled = false));

  renderTutorial();
  stage?.sync(state, selected, enabled, busy);
}
function showTutorialNote(){
  const done=session.done,g=session.guide;
  session.notices.add(done?'done':session.step);
  openDialog(`<section class="tutorial-sticker"><small>新手教学 ${session.chapter+1} / ${LESSONS.length}</small><h2>${done?session.chapter===LESSONS.length-1?'九九归一，胜利！':'攻防练习完成':g.title}</h2><p>${done?session.lesson.result:g.detail}</p><button class="primary" ${done?'data-tutorial-next':'data-tutorial-understood'}>${done?session.chapter===LESSONS.length-1?'完成教学':'下一节':'明白了，试试看'}</button><footer><button data-tutorial-retry>重试本节</button><button data-tutorial-exit>退出教学</button></footer></section>`,"tutorial-sticker-dialog");
  dialog.dataset.view='tutorial-note';
}
function renderTutorial() {
  const host=document.querySelector('#tutorial-guide');host.hidden=true;host.innerHTML='';
  document.querySelector('.game-shell').classList.toggle('is-tutorial',mode==='tutorial');
  document.querySelectorAll('.tutorial-target').forEach(el=>el.classList.remove('tutorial-target'));
  if(mode!=="tutorial"||busy)return;
  const done=session.done,g=session.guide;
  document.querySelector('#end-turn').hidden=done || g.command.type!=='end' || g.auto;
  host.hidden=false;
  host.innerHTML=`<small>教学指引 · ${session.chapter+1} / ${LESSONS.length} · ${session.lesson.title}</small><p>${done?session.lesson.result:g.detail}</p>`;
  if(done){
    document.querySelector('.game-shell').dataset.step='complete';
    feedback.reveal(document.querySelector('#instruction'),session.chapter===LESSONS.length-1?'两种胜利方式，都学会了':'练习完成');
    document.querySelector('#end-turn').hidden=true;
    document.querySelector('#primary-actions').innerHTML='<button class="primary" id="tutorial-next">'+(session.chapter===LESSONS.length-1?'完成教学':'继续学习')+'</button>';
  }
  if(!done&&g.command.type==='demo')document.querySelector('#primary-actions').innerHTML='<button id="tutorial-demo">演示再次凑齐双 [9]</button>';
  if(!done){
    const target=g.command.type==='forge'&&forgeUi.hidden?'#open-forge':g.command.type==='forge'&&forgeUi.choice?'#confirm-forge':!session.canProceed?`[data-info="${g.requiresInfo}"]`:selected&&g.selectedTarget?g.selectedTarget:g.target;
    if(target)document.querySelectorAll(target).forEach(el=>{if(!el.disabled)el.classList.add('tutorial-target');});
  }
}

function nextTutorial(chapter) {
  if(chapter!==session.chapter && dialog.dataset.view!=='tutorial-transition'){
    openDialog('<section class="dialog-body tutorial-transition"><small>进入新的教学场景</small><h2>另一种胜利：九九归一</h2><p>刚才的攻防练习已完成。接下来换一个局面：你是 [8] / [9]，对手是 [1] / [1]，双方 HP 恢复为 99。累计使用两次归一，即可直接获胜。</p><button class="primary" data-tutorial-next>开始演示</button></section>');
    dialog.dataset.view='tutorial-transition';return;
  }
  closeDialog();startGame('tutorial',chapter);
  feedback.reveal(document.querySelector('#instruction'),session.guide.title);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.querySelector('.duel').animate([{opacity:.25},{opacity:1}],{duration:550,easing:'ease-out'});
}
function exitTutorial() {
  started=false;closeDialog();startGame('ai');showMenu('play');
}
async function animateCommand(command, old, next, contact) {
  if(command.type==="add") {
    const a=old.players[command.actor].hands[command.hand],b=old.players[1-command.actor].hands[command.targetHand];
    const resultOwner=old.players[command.actor].mirror?1-command.actor:command.actor;
    document.querySelector('#instruction').innerHTML=`出手！数字加和，<span class="equation-team-${command.actor}">[${a}]</span> + <span class="equation-team-${1-command.actor}">[${b}]</span> → <span class="equation-team-${resultOwner}">[${(a+b)%10}]</span>`;
  }
  if(command.type==='demo') {
    const epoch=feedback.generation();
    await feedback.animate(document.querySelector('#stage'),[{opacity:1},{opacity:0}],{duration:300,fill:'both'}).finished.catch(()=>{});
    if(feedback.generation()!==epoch)return false;
    stage?.sync(next,null,false,true);
    next.players.forEach((p,o)=>p.hands.forEach((n,h)=>handElements[o][h].querySelector('.hand-value').textContent=n));
    await feedback.animate(document.querySelector('#stage'),[{opacity:0},{opacity:1}],{duration:600,fill:'both'}).finished.catch(()=>{});
    return feedback.generation()===epoch;
  }
  if(command.type==="attack"||command.type==="prop"||["end","advance","forge"].includes(command.type)) {
    cinema??=createCombatCinema({animate:feedback.animate,register:feedback.register,generation:feedback.generation,asset,sound:battleSound.play,participants,notice:feedback.notice,noticeRoot:feedback.noticeRoot});
    let visual=structuredClone(old);
    const completed=await cinema(old,next,command,beat=>{
      const before=structuredClone(visual);
      if(beat.type==="damage") {
        const target=visual.players[beat.owner];
        target.hp=Math.max(0,target.hp-beat.amount);
        stage?.hit?.(beat.owner,beat.amount);
        if(beat.hands)target.hands=[...beat.hands];
        if(beat.foam!==undefined) {
          target.foam=beat.foam;
          const badge=document.querySelector(`[data-info="status:foam:${beat.owner}"]`);
          if(badge){if(beat.foam){badge.querySelector(".status-count").textContent=beat.foam;badge.setAttribute("aria-label",`泡沫盾墙，剩余 ${beat.foam} 次`);}else badge.remove();}
        }
        stage?.sync(visual,null,false,true);
        target.hands.forEach((n,h)=>{handElements[beat.owner][h].querySelector('.hand-value').textContent=n;});
      }
      else if(beat.type==='settle' || beat.type==='reset-hands' || beat.skillEffect) {
        const actorHands=[...visual.players[old.active].hands],hp=visual.players.map(p=>p.hp);
        visual=structuredClone(next);
        if(beat.preserveActorHands || beat.skillEffect)visual.players[old.active].hands=actorHands;
        if(beat.skillEffect)visual.players.forEach((p,i)=>p.hp=hp[i]);
        stage?.sync(visual,null,false,true);
        visual.players.forEach((p,owner)=>p.hands.forEach((n,h)=>{handElements[owner][h].querySelector('.hand-value').textContent=n;}));
      }
      feedback.changes(before,visual);
      visual.players.forEach((p,o)=>p.hands.forEach((n,h)=>renderHandShield(handElements[o][h],p,h)));
      feedback.contact({type:'beat'},before,visual);
    });
    if(completed){feedback.contact({type:'beat'},visual,next);}
    return completed;
  }
  if(command.type!=="add"){feedback.contact(command,old,next);return true;}
  const steps=touchVisualSteps(old,command);
  for(const step of steps){const completed=await stage.animate(step,old,next,()=>contact(step));if(!completed)return false;}
  return true;
}
function showContact(command, old, next) {
  feedback.contact(command, old, next);
  const localized=structuredClone(old);
  for(const w of command.visualWrites||[])localized.players[w.owner].hands[w.hand]=w.value;
  feedback.changes(old,localized,450);
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
  remaining=Math.max(0,(deadline-Date.now())/1000);
  if(mode!=="tutorial" && remaining===0 && state.phase==="action" && !state.players[state.active].weapon && !["end","surrender"].includes(command.type))command={type:"end"};
  busy = true;
  selected = null;
  stopAI();
  info.hide();
  const old = state,
    current = session,
    serial = ++actionSerial;
  render();
  try {
    const full = { ...command, actor: old.active, revision: old.revision };
    const next = await current.send(full,{timeout:mode!=="tutorial" && remaining===0});
    const completed = await animateCommand(full, old, next, (visual) => {
      if (current === session && serial === actionSerial)
        showContact(visual, old, next);
    });
    if (!completed || current !== session || serial !== actionSerial) return;
    state = next;
    if (old.phase === "start" || old.turn !== next.turn)
      remaining = turnSeconds(next);
    deadline = Date.now() + remaining * 1000;
    document.querySelector("#combat-callout").classList.remove("visible");
      document.querySelector("#combat-callout").textContent = "";
    document.querySelector("#contact-fx").classList.remove("visible");
    render();
    announceSupply(next);
    const cue = phaseCue(old, next, participants());
    if (cue) {
      if (cue.kind === "finish") play("victory");else battleSound.play("turn",.35);
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
        scheduleAI();
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
  stopAI();
  if (mode === "online") return;
  if(state.phase==="action" && state.players[state.active].weapon && !paused && !busy && started && state.winner===null){aiTimer=setTimeout(()=>send({type:"attack"}),0);return;}
  if(mode === "tutorial"){if(session.guide?.auto && session.canProceed && document.querySelector('#info-popover').hidden && !paused && !busy && started)aiTimer=setTimeout(()=>send(session.guide.command),session.guide.command.type==='add'?1800:950);return;}
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
  aiTimer = setTimeout(requestAI, aiDifficulty==='easy'?1100:700);
}
function savedPve(){try{const data=JSON.parse(localStorage.getItem('ff-pve')||'null');if(data){const restored=LocalSession.restore(data);if(restored.getSnapshot().winner===null)return data;}}catch{}return null;}
function savePve(){if(mode==='ai'&&started&&session){try{
 const snapshot=session.getSnapshot(),changedTurn=state&&snapshot.turn!==state.turn;
 const remainingMs=changedTurn?TURN_SECONDS*1000:Math.max(0,Math.min(TURN_SECONDS*1000,(busy||paused?remaining*1000:deadline-Date.now())));
 localStorage.setItem('ff-pve',JSON.stringify({...session.exportSave(),remainingMs}));
 }catch{}}}
listen(window,'pagehide',savePve);
function startGame(newMode = mode, chapter = 0, saved = null) {
  actionSerial++;
  stage?.cancel();
  unsubscribe?.();
  session?.dispose();
  stopAI();
  feedback.reset();
  clearTimeout(toast.timer);
  document.querySelector("#toast").classList.remove("visible");
  document.querySelector("#combat-callout").textContent="";
  mode = newMode;
  selected = null;
  busy = false;
  paused = false;
  remaining = TURN_SECONDS;
  deadline = Date.now() + TURN_SECONDS * 1000;
  session = mode === "tutorial" ? new TutorialSession(chapter) : saved ? LocalSession.restore(saved) : new LocalSession(crypto.getRandomValues(new Uint32Array(1))[0],{difficulty:aiDifficulty});
  if(mode==="ai")aiDifficulty=session.difficulty;
  if(saved&&Number.isFinite(saved.remainingMs)){remaining=Math.max(0,Math.min(TURN_SECONDS,saved.remainingMs/1000));deadline=Date.now()+remaining*1000;}
  unsubscribe = session.subscribe((next) => {
    savePve();
    if (!busy) {
      state = next;
      render();
    }
  });
  stage?.setPaused(false);
  document.querySelector("#combat-callout").classList.remove("visible");
      document.querySelector("#combat-callout").textContent = "";
  document.querySelector("#contact-fx").classList.remove("visible");
  if (started && mode !== "tutorial" && !saved) introPhase();
  else scheduleAI();
}
async function introPhase() {
  const serial = actionSerial;
  busy = true;
  render();
  await feedback.intro(participants(),mode==="local"?state.active:0);
  if (serial !== actionSerial) return;
  busy = false;
  deadline = Date.now() + remaining * 1000;
  render();
  announceSupply(state);
  scheduleAI();
}
function openDialog(content, cls = "") {
  if(!paused && !busy && mode!=="online")remaining=Math.max(0,(deadline-Date.now())/1000);
  info?.hide();
  paused = mode !== "online";
  stage?.setPaused(paused);
  feedback.pause(paused);
  stopAI();
  dialog.dataset.view = "";
  document.body.classList.toggle("menu-scene",!started || cls.includes("game-menu") || cls==="online-dialog" || cls.startsWith("developer"));
  dialog.className = cls;
  dialog.innerHTML = content;
  if (!dialog.open) dialog.showModal();
  savePve();
}
function closeDialog() {
  dialog.close();
  document.body.classList.remove("menu-scene");
  paused = false;
  stage?.setPaused(false);
  feedback.pause(false);
  deadline = Date.now() + remaining * 1000;
  scheduleAI();
}
let menuEntrance=0,menuLoaded=false,settingsReturn=null,nameEditorReturn=false;
async function showMenu(page = "home") {
  if(mode === "online" || online?.packet?.room || online?.packet?.queued) {showOnline();return;}
  if(typeof page !== "string")page="home";
  openDialog(menuMarkup(page,{started,resumable:!!savedPve()}),"menu-dialog game-menu");
  dialog.dataset.view="menu";dialog.dataset.page=page;
  const firstEntrance=!menuLoaded,entrance=++menuEntrance,root=dialog.querySelector('.menu-body'),buttons=[...dialog.querySelectorAll('.menu-body button')];
  buttons.forEach(b=>b.disabled=true);root.classList.add('menu-entering');
  const loader=document.createElement('div');loader.className='menu-loader';loader.setAttribute('role','status');loader.innerHTML='<div class="loader-emblem" aria-hidden="true"><b>99</b></div><span>LOADING</span><p>按 <kbd>F11</kbd> 以获得更好体验</p>';if(firstEntrance)dialog.append(loader);
  await Promise.all([dialog.querySelector('.menu-keyart img').decode().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,firstEntrance?650:0))]);
  if(entrance!==menuEntrance||!root.isConnected)return;
  loader.remove();menuLoaded=true;if(firstEntrance)await new Promise(resolve=>setTimeout(resolve,500));
  if(entrance!==menuEntrance||!root.isConnected)return;
  const quiet=matchMedia('(prefers-reduced-motion: reduce)').matches;
  await Promise.all(buttons.map((b,i)=>b.animate(quiet?[{opacity:0},{opacity:1}]:[{opacity:0,transform:'translateY(18px) scale(1.12)'},{opacity:1,transform:'translateY(-2px) scale(.99)',offset:.75},{opacity:1,transform:'none'}],{duration:firstEntrance?300:160,delay:i*(firstEntrance?200:50),fill:'both',easing:'cubic-bezier(.2,.8,.2,1)'}).finished.catch(()=>{})));
  if(entrance!==menuEntrance||!root.isConnected)return;
  root.classList.remove('menu-entering');buttons.forEach(b=>b.disabled=false);dialog.setAttribute('tabindex','-1');dialog.focus({preventScroll:true});
}
function dismissDialog() {
  if(dialog.dataset.view==='settings'){
    if(settingsReturn?.view==='battle'){showBattleMenu();return;}
    if(settingsReturn?.view==='menu'){showMenu(settingsReturn.page||'home');return;}
  }
  if(dialog.dataset.view==='name-editor' && nameEditorReturn){showBattleMenu();return;}
  if(dialog.dataset.view==="menu"){if(dialog.dataset.page!=="home")showMenu(dialog.dataset.page==="difficulty"?"local":dialog.dataset.page==="local"?"play":"home");return;}
  if(dialog.dataset.view==="tutorial-note"){closeDialog();render();return;}
  if(dialog.dataset.view==="developer-slide"){showDeveloper();dialog.querySelector("[data-developer-slide]").focus({preventScroll:true});return;}
  if(dialog.dataset.view==="developer"){showMenu("home");return;}
  if(dialog.dataset.view==="online") {
    if(online?.packet?.queued || online?.packet?.room?.status==="waiting") {
      toast("请先取消匹配或离开房间");return;
    }
    if(!started){showMenu("play");return;}
  }
  if(!started){showMenu(dialog.dataset.page==="local"?"play":"home");return;}
  closeDialog();
}
function showNameEditor(seat) {
  nameEditorReturn=dialog.open&&dialog.dataset.view==='battle';
  openDialog(`<form id="player-name-form" class="dialog-body" data-seat="${seat}"><button type="button" class="dialog-close" data-close aria-label="取消改名">×</button><h2>你的名字</h2><label for="player-name-input">最多 10 个字符</label><input id="player-name-input" name="name" maxlength="200" value="${name(seat)}" autocomplete="nickname"><p class="name-error" role="status"></p><button class="primary" type="submit">保存</button></form>`);
  dialog.dataset.view='name-editor';
  document.querySelector('#player-name-input').focus();
}
function showBattleMenu() {
  const remote=mode==='online',tutorial=mode==='tutorial';
  openDialog(`<div class="dialog-body battle-menu"><button class="dialog-close" data-close aria-label="继续游戏">×</button><small class="scene-kicker">${remote?'LIVE MATCH':tutorial?'TRAINING':'TIME OUT'}</small><h2>${remote?'战局菜单':tutorial?'教学已暂停':'对局已暂停'}</h2><p class="pause-context ${remote?'live-context':''}">${remote?'联机对局继续计时，及时返回战场。':tutorial?'当前步骤已保留，准备好再继续。':`第 ${Math.ceil(state.turn/2)} 回合 · ${name(state.active)} · 剩余 ${Math.ceil(remaining)} 秒`}</p><button class="resume-choice" data-close>${tutorial?'继续教学':'返回战场'}<span aria-hidden="true">↗</span></button>${tutorial?'<button data-tutorial-help>本节提示</button><button data-tutorial-retry>重试本节</button><button data-tutorial-exit>退出教学</button>':`<button data-battle-online>${remote?'房间和玩家':'修改昵称'}</button>`}<button data-menu-settings>声音设置</button>${remote||tutorial?'':'<button data-menu="home">返回主菜单</button>'}</div>`,"scene-dialog pause-dialog");
  dialog.dataset.view='battle';
}

function showDeveloper(){
  openDialog(`<article class="developer-story"><button class="dialog-close" data-close aria-label="返回主菜单">×</button><header><h2>开发者<span>说。</span></h2></header><div class="developer-copy"><p>考虑 finger fight 稍作改编就可以贴合本次“99”主题，但之前就做过了，还是不做回锅肉，就新做了个躲避球游戏。本游戏其实是 2023 年首次 minigame 设计推出的（尊重给到 [UI&amp;特效] <span class="developer-credit">潘朱炜</span>，[程序] <span class="developer-credit">王璨、王崴、佘壕镪</span>），可惜完成度不高，也没有拿到任何奖项。</p><p>今年响应“超级个体”的号召，solo 参赛做了。躲避球晋级后自觉内容量已足够，不太想进一步开发了。于是移植了 finger fight 到网页端，补全了玩法，实现了联网，重做了美术，打磨了交互体验。既然今年躲避球晋级决赛，就私心把这个游戏再塞进来给大家再玩玩了。</p><p>至于这个游戏的灵感来源，可以点击<button class="story-slide-link" data-developer-slide>当时的幻灯片页面</button>查看。大家可以按F11全屏游玩以获得更好体验。感谢体验！</p></div><footer>开发者：<span class="developer-signature">谭越天</span></footer></article>`,"developer-dialog");
  dialog.dataset.view="developer";
}
function showDeveloperSlide(){
  openDialog(`<div class="developer-slide"><img src="./assets/story/inspiration-full.png" alt="2023 年 Finger Fight 游戏介绍：灵感来源于宿舍里的手指数字博弈"><button class="dialog-close" data-close aria-label="返回开发者说">×</button></div>`,"developer-slide-dialog");
  dialog.dataset.view="developer-slide";
}
function showTutorialIntro(){
 openDialog(`<div class="dialog-body tutorial-intro"><button class="dialog-close" data-close aria-label="返回主菜单">×</button><h2>指尖上的博弈</h2><p>改变双手数值，形成手势组合，解锁不同能力。</p><div class="tutorial-goals"><b>清空对手 HP</b><span>或</span><b>九九归一</b></div><p>正式开局双方都是 [1] / [1]、99 HP。接下来模拟一段连续攻防：计算、对手行动、获得道具，再合成技能。最后演示两次归一的特殊胜利。</p><button class="primary" data-tutorial-confirm>开始教学</button></div>`);
}
function showSettings() {
  settingsReturn=dialog.open?{view:dialog.dataset.view,page:dialog.dataset.page}:null;
  openDialog(`<div class="dialog-body settings-body"><button class="dialog-close" data-close aria-label="关闭设置">×</button><small class="scene-kicker">SOUND MIX</small><h2>声音设置</h2>${['music','effects'].map(k=>`<label class="volume-row">${k==='music'?'背景音乐':'游戏音效'}<output id="volume-${k}">${Math.round(audioSettings.values[k]*100)}%</output><input aria-label="${k==='music'?'背景音乐':'游戏音效'}" type="range" min="0" max="100" value="${Math.round(audioSettings.values[k]*100)}" data-volume="${k}"></label>`).join('')}<button class="primary" data-close>返回</button></div>`);
  dialog.dataset.view='settings';
}

function showResult() {
  const winner = state.winner;
  const lost = mode === "online" ? winner !== online.packet.room.seat : mode === "ai" && winner !== 0;
  openDialog(
    `<div class="result-art">${img(`manga/${winner ? "red" : "blue"}.webp`)}<span aria-hidden="true">${lost ? "DEFEAT" : "VICTORY"}</span></div><div class="result-content"><div class="result-stamp">${lost ? "败北" : "胜利"}<i>!</i></div><h2>${name(winner)}<span>获胜</span></h2><p class="result-reason">第 ${Math.ceil(state.turn/2)} 回合 · ${state.winReason ? escapeHtml(state.winReason) : mode === "online" && online.packet.room.finishReason ? escapeHtml(online.packet.room.finishReason) : name(1-winner)+" HP 归零"}</p><div class="result-scores">${state.players.map((p,i)=>`<div class="${i===winner?'won':''}"><small>${name(i)}</small><strong>${p.hp}<span> HP</span></strong><b>${p.nine} / 2 归一</b></div>`).join('')}</div>${mode === "online" ? '<button class="primary" id="online">返回房间 / 再战 </button>' : `<button class="primary" data-mode="${mode}">再战一局 </button>`}<button class="text-button" data-close>查看战场</button></div>`,
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
      openDialog('<div class="dialog-body"><h2>离开当前对局？</h2><p>离开会判负，对手将获胜。</p><button class="primary" id="online-leave-confirm">离开并认输</button><button class="text-button" data-close>继续对局</button></div>',"scene-dialog leave-dialog");return;
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
listen(dialog,"input",e=>{if(e.target.dataset.volume){const k=e.target.dataset.volume;audioSettings.set(k,Number(e.target.value)/100);dialog.querySelector(`#volume-${k}`).textContent=`${e.target.value}%`;return;}if(e.target.id==="room-code")online.joinCode=e.target.value;if(e.target.id==="online-name")online.nameDraft=e.target.value;});
listen(dialog,"submit",async e=>{
  if(e.target.id==="player-name-form") {
    e.preventDefault();const form=e.target,button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;
    try{const value=shortName(new FormData(form).get('name'));if(mode==='online')await online.rename(value);else {session.rename(Number(form.dataset.seat),value);savePve();}if(dialog.contains(form)){dismissDialog();render();}}
    catch(error){if(dialog.contains(form)){form.querySelector('.name-error').textContent=error.message;button.disabled=false;}}return;
  }
  if(!["name-form","join-form"].includes(e.target.id))return;
  e.preventDefault();if(online.busy)return;
  const form=e.target, value=new FormData(form).get(form.id==="name-form"?"name":"code");
  online.busy=true;online.error="";refreshLobby();
  try {if(form.id==="name-form"){await online.rename(value);toast("名字已保存");}else {await online.saveDraft();await online.join(value);}}
  catch(error){online.error=error.message;}
  finally {online.busy=false;refreshLobby();}
});
function receiveRemote(packet) {
  const room=packet.room;
  if(room){online.view="home";online.joinCode="";const url=new URL(location.href);if(url.searchParams.has("room")){url.searchParams.delete("room");history.replaceState(null,"",url);}}
  refreshLobby();
  if(!room?.state){if(room?.status==="waiting"&&dialog.dataset.view==="menu")showOnline();if(mode==="online"){remoteMatch=null;remoteQueue=[];started=false;startGame("ai");showOnline();}return;}
  if(remoteMatch!==room.matchId||mode!=="online") {
    actionSerial++;stage?.cancel();feedback.reset();unsubscribe?.();session?.dispose();stopAI();
    remoteQueue=[];remoteApplying=false;remoteMatch=room.matchId;session=online;mode="online";started=true;selected=null;busy=false;remotePending=false;paused=false;state=room.state;
    stage?.setPaused(false);if(dialog.open)closeDialog();render();if(state.winner!==null)showResult();else if(state.phase==="start")introRemote();return;
  }
  if(room.state.revision<=state.revision){if(!busy)render();return;}
  if(remoteQueue.some(p=>p.room.state.revision===room.state.revision))return;
  remoteQueue.push(packet);drainRemote();
}
async function introRemote() {
  const serial=actionSerial;busy=true;remoteApplying=true;render();
  await feedback.intro(participants(),online.packet.room.seat);
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

      }
      if(serial!==actionSerial)return;
      state=next;document.querySelector('#combat-callout').textContent='';document.querySelector('#combat-callout').classList.remove('visible');document.querySelector('#contact-fx').classList.remove('visible');render();
      if(!document.hidden&&!dialog.open&&!remoteQueue.length)await feedback.phase(phaseCue(old,next,participants()),asset);
      if(serial!==actionSerial)return;
      busy=false;render();announceSupply(state);if(state.winner!==null)showResult();
    }
  } finally {if(serial===actionSerial){remoteApplying=false;busy=false;render();}}
}

info = setupInfo(app, () => state, asset, participants, () => mode === "online", key => {
  if(mode!=="tutorial" || !session.inspect(key))return;
  render(true);scheduleAI();
},()=>{if(mode==='tutorial')scheduleAI();});
listen(app, "click", (e) => {
  const tutorialAction=e.target.closest('button')?.id;
  if(mode==='tutorial') {
    if(tutorialAction==='tutorial-exit'){exitTutorial();return;}
    if(tutorialAction==='tutorial-retry'){nextTutorial(session.chapter);return;}
    if(tutorialAction==='tutorial-next'&&!busy){if(session.chapter===LESSONS.length-1)exitTutorial();else nextTutorial(session.chapter+1);return;}
    if(tutorialAction==='tutorial-demo'&&!busy){send({type:'demo'});return;}
    if(tutorialAction==='online'){toast('先退出教学，再选择联机对战');return;}
  }

  battleSound.unlock();
  const recipe=e.target.closest(".reference-recipe");
  if(recipe){battleSound.play('inspect',.5);info.show(recipe,true);return;}
  const detail=e.target.closest('.hand-shield');
  if(detail){info.show(detail,true);return;}
  const button = e.target.closest("button");
  if (!button) return;
  if (button.disabled) return;
  if (button.hasAttribute("data-info-only")) {
    info.show(button, true);
    return;
  }
  if(button.dataset.editName!==undefined){showNameEditor(Number(button.dataset.editName));return;}
  if(button.id==='back-forge'){battleSound.play('back',.5);const choice=forgeUi.choice;forgeUi.choice=null;render();document.querySelector(`[data-forge="${choice}"]`)?.focus({preventScroll:true});return;}
  if(button.id==='cancel-forge'){battleSound.play('back',.5);forgeUi.choice=null;forgeUi.hidden=true;render();document.querySelector('#open-forge')?.focus({preventScroll:true});return;}
  if(button.id==='open-forge'){battleSound.play('inspect',.5);forgeUi.hidden=false;render();document.querySelector('#forge-options [data-forge]:not(:disabled)')?.focus({preventScroll:true});return;}
  if(button.id==='confirm-forge'){if(forgeUi.choice)send({type:'forge',weapon:forgeUi.choice});return;}
  if (button.dataset.forge) { battleSound.play('select',.6);forgeUi.choice=button.dataset.forge;render();document.querySelector('#confirm-forge')?.focus({preventScroll:true});return; }
  if (button.dataset.hand !== undefined) {
    if(mode==='tutorial' && !session.canProceed)return;
    const owner = Number(button.dataset.owner),
      hand = Number(button.dataset.hand);
    if (busy || remotePending || (mode === "online" && (online.status !== "connected" || online.serverNow() < (online.packet?.room?.readyAt || 0)))) return;
    const computing = humanTurn() && state.phase === "action" && !state.calculated && !state.players[state.active].weapon && state.winner === null;
    if (selected?.kind === "prop") {
      if (canTarget(owner, hand)) send({type:"prop",slot:selected.slot,target:owner,targetHand:hand});
      return;
    }
    if (!computing) return;
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
    "end-turn": () => send({ type: "end" }),
    attack: () => send({ type: "attack" }),
    cancel: () => {
      selected = null;
      render();
    },
    again: () => mode === "online" ? showOnline() : startGame(),
    online: showOnline,
    menu: showBattleMenu,
    settings: showSettings,
    sound: () => {
      sound = !sound;
      button.setAttribute("aria-pressed", String(sound));
      button.innerHTML = `音效 <span>${sound ? "开" : "关"}</span>`;
      play("click");
    },
    history: () => openDialog(historyMarkup(state.log,participants())),
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
  if(e.target===dialog && ["recipes","developer-slide"].includes(dialog.dataset.view)) {
    dismissDialog();return;
  }
  const b = e.target.closest("button");
  if (!b || b.disabled) return;
  if (b.dataset.menu) {showMenu(b.dataset.menu);return;}
  if(b.dataset.ai){aiDifficulty=b.dataset.ai;started=true;closeDialog();startGame("ai");return;}
  if(b.hasAttribute("data-battle-online")){mode==="online"?showOnline():showNameEditor(mode==="local"?state.active:0);return;}
  if(b.hasAttribute("data-resume-pve")){const saved=savedPve();if(saved){started=true;closeDialog();startGame("ai",0,saved);}return;}
  if(b.hasAttribute("data-tutorial-understood")){closeDialog();render();return;}
  if(b.hasAttribute("data-tutorial-next")){if(session.chapter===LESSONS.length-1)exitTutorial();else nextTutorial(session.chapter+1);return;}
  if(b.hasAttribute("data-tutorial-retry")){nextTutorial(session.chapter);return;}
  if(b.hasAttribute("data-tutorial-exit")){exitTutorial();return;}
  if(b.hasAttribute("data-tutorial-help")){showTutorialNote();return;}
  if(b.hasAttribute("data-developer")){showDeveloper();return;}
  if(b.hasAttribute("data-developer-slide")){showDeveloperSlide();return;}
  if(b.hasAttribute("data-tutorial")){showTutorialIntro();return;}
  if(b.hasAttribute("data-tutorial-confirm")){started=true;closeDialog();startGame("tutorial");return;}
  if (b.hasAttribute("data-menu-settings")) {showSettings();return;}
  if(b.id==="sound"){sound=!sound;b.setAttribute("aria-pressed",String(sound));b.innerHTML=`音效 <b>${sound?"开":"关"}</b>`;play("click");return;}
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
  if(e.defaultPrevented)return;
  if(e.key === "Escape" && dialog.open){
    e.preventDefault();
    e.stopPropagation();
    if(!e.repeat)dismissDialog();
    return;
  }
  if (e.key === "Escape" && !dialog.open && started && !e.repeat) {
    e.preventDefault();showBattleMenu();
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
    openDialog('<div class="dialog-body"><div class="kicker">PAUSED</div><h2>下一手，等你。</h2><button class="primary" data-close>继续对局 </button></div>');
});
const ticker = setInterval(() => {
  if(mode === "online") {
    const room=online.packet?.room;
    updateNetworkNotice();
    if(room?.state){remaining=room.deadlineAt ? Math.max(0,Math.ceil((room.deadlineAt-Math.max(online.serverNow(),room.readyAt||0))/1000)):0;document.querySelector("#clock").textContent=online.status==="connected"?Math.ceil(remaining):"—";updateClockWarning();
      const ready = online.status === 'connected' && online.serverNow() >= room.readyAt;
      if(!busy && !remotePending && ready !== renderedRemoteReady)render();}
    return;
  }
  if (mode === "tutorial" || paused || busy || !started || !state || state.winner !== null) return;
  remaining = Math.max(0, (deadline - Date.now()) / 1000);
  document.querySelector("#clock").textContent = mode==="tutorial"?"∞":mode==="online"&&online.status!=="connected"?"—":Math.ceil(remaining);
  updateClockWarning();
  if (remaining === 0)
    send(state.phase === "start" ? {type:"advance"} : {type:"end"});
}, 200);

startGame();
showMenu("home");
document.body.classList.remove("booting");
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
  stage.setPaused(paused);
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
    stopAI();
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
    const holes=[...document.querySelectorAll('.tutorial-target, .arena-actions, #forge-options, .scoreboard, .hud-tools')].filter(el=>el.getClientRects().length).map(el=>{
      const r=el.getBoundingClientRect();return `<rect x="${r.left-5}" y="${r.top-5}" width="${r.width+10}" height="${r.height+10}" rx="8" fill="black"/>`;
    }).join('');
    const markup=`<defs><mask id="tutorial-holes"><rect width="100%" height="100%" fill="white"/>${holes}</mask></defs><rect width="100%" height="100%" fill="#32343d" opacity=".22" mask="url(#tutorial-holes)"/>`;
    if(markup!==spotlightMarkup){spotlight.innerHTML=markup;spotlightMarkup=markup;}
  }
  spotlightFrame=requestAnimationFrame(updateSpotlight);
}
spotlightFrame=requestAnimationFrame(updateSpotlight);

if(import.meta.hot)import.meta.hot.dispose(()=>{cancelAnimationFrame(spotlightFrame);spotlight.remove();});
