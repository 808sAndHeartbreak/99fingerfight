import { supplyIn } from "./engine.js";
import { playerName, escapeHtml } from "./identity.js";
import { PROPS, MAX_HP, WEAPONS, weaponById } from "./catalog.js";

const PROP_INFO = {
  add: "一只手数字 +1，9 变成 0。",
  sub: "一只手数字 −1，0 变成 9。",
  lock: "一只手不能参与触碰计算；所属玩家回合结束解除。道具仍能改变它的数字。每人最多封印一只手；已有封印时不能再对该玩家使用。",
};
export function describe(key, state, participants) {
  const [kind, id, hand] = key.split(":");
  if(kind === "recipe" || kind === "combo") {
    const options=WEAPONS.filter(w=>w.recipe.every(n=>n===Number(id)));
    if(!options.length)return null;
    return {title:`${id} + ${id}`,tag:"配方选项",stats:[],body:(kind==="combo"?`组合已满足，行动时可合成。${id==="5"?"55：免疫普通伤害，不消耗数字；真实伤害仍可生效。":""}<br><br>`:"")+options.map(w=>`${w.name}：${w.detail}`).join("<br><br>"),note:"行动时选择其中一种，双手归 1 并自动释放；每回合可计算一次，计算前后均可合成。"};
  }
  if (kind === "weapon") {
    const w = weaponById(id);
    if (!w) return null;
    return {
      title: w.name,
      image:w.image,
      tag: "合成武器",
      stats: [
        ["合成", w.recipe.join(" · ")],
        ["使用", "行动阶段"],
      ],
      body: w.detail,
      note: "合成后双手归 1 并自动释放；每回合计算一次，计算前后均可合成。",
    };
  }
  if (kind === "prop") {
    const owner=hand===undefined?state.active:Number(hand),p=state.players[owner],e=state.players[1-owner];
    const sum=p.hands[0]+p.hands[1],enemySum=e.hands[0]+e.hands[1];
    const ruinDamage=Math.max(0,enemySum+(p.adrenaline>0?5:0)-(e.adrenaline>0?5:0));
    const preview={wine:`（当前叠加后首段 +${(p.wine+1)*10}）`,adrenaline:`（当前剩余 ${p.adrenaline} 个己方回合，使用延长 3 回合）`,grace:`（当前回复 ${Math.min(MAX_HP-p.hp,sum)}，数字总和 ${sum}）`,ruin:`（当前伤害 ${ruinDamage}，实际扣血 ${e.peace>0?0:Math.min(e.hp,ruinDamage)}）`,greed:`（当前获得 ${Math.min(2,4-p.props.length)} 个）`,boon:`（当前己方补 ${4-p.props.length} 个，对方补 ${3-e.props.length} 个）`,balance:`（当前己方重抽 ${Math.max(0,p.props.length-1)} 个，对方重抽 ${e.props.length} 个）`}[id]||'';
    return {
      title: PROPS[id].name,
      image: PROPS[id].image,
      tag: "一次性道具",
      stats: [
        ["阶段", "道具阶段"],
        ["目标", ({hand:"任意一方的手",self:"自己",enemy:"对手",all:"双方"})[PROPS[id].target]],
      ],
      body: (p.resilience>0 && ["greed","adrenaline"].includes(id) ? PROPS[id].detail.replace("立即结束本回合；", "").replace("，立即结束回合", "")+"（坚韧：使用后继续本回合）" : PROP_INFO[id] || PROPS[id].detail)+preview,
      note: ({wine:"只强化下一次有直接伤害的技能首段，出手时一次消耗全部酒；无伤害技能不消耗，被免疫或护盾挡住仍消耗。无回合期限，可被窃取。",adrenaline:"包括真实伤害、道具与持续伤害；先合并增减伤，再结算护盾，最低 0。重复使用延长三回合，不叠加强度；可被窃取。",echo:"本回合下一次计算复制同一个结果；另一只手被封印也会接收复制值。未计算则回合结束失效；重复使用不叠加。",mirror:"与回响同时存在时，两次触碰使用同一个结果，只写入对手目标手。回合结束失效，重复使用不叠加。",silence:"持续到对手下一回合结束；禁止主动使用道具，不影响补给和武器补牌。",balance:"先消耗制衡，再按双方各自剩余道具数量重抽。允许抽到同名道具。",boon:"补到每人 3 个，已满的玩家不会再获得；不会移除已有状态。",greed:"先消耗强欲，最多补至 3 个；跳过本回合行动，回合状态结束；坚韧期间仍可继续行动。",grace:"以使用时自己的双手数字之和计算，生命最多为 99；满血或数字总和为 0 仍会消耗。",ruin:"以使用时对手双手数字之和计算，忽略护盾且不消耗护盾；生命归零立即结算。"})[id] || "点击道具，再点高亮手势即生效；数字变化不会立即合成。",
    };
  }
  if(kind==="status") {
    const p=state.players[Number(hand)];
    const data={
      echo:["回响","本回合","下一次计算复制同一个结果给自己的两只手。重复使用不叠加。"],
      mirror:["镜像","本回合","下一次计算只写入对手目标手；与回响同时存在也不会改变自己的手。"],
      silenced:["沉默",Number(hand)===state.active?"本回合":"下个己方回合","不能主动使用道具，补给与技能补牌仍生效。"],
      skip:["无法行动",`${p.skip} 个后续己方回合`,"跳过整回合操作；补给、持续伤害和状态计数照常。重复效果累计回合。"],
      seven:["七伤拳",`剩余 ${p.seven} 次`,"每个己方回合开始受到 7 点真实伤害。重复施加剩余次数 +7。"],
      dark:["玄冥神掌","永久","每个己方回合开始受到 5 点真实伤害；不叠加，可与七伤拳共同生效。"],
      foam:["泡沫盾墙",`剩余 ${p.foam} 次`,"完全挡住普通伤害，每段消耗一次。真实伤害穿透且不消耗。重复获得次数 +2。"],
      knuckles:["指虎",`永久 ${p.knuckles} 层 · +${p.knuckles*10}`,"每段直接技能伤害 +10，包括真实伤害和双枪每发；不增加道具或持续伤害。可重复叠加，无层数上限。"],
      wine:["酒",`${p.wine} 层 · 首段 +${p.wine*10}`,"下一次直接技能攻击只强化第一段；一次消耗全部层数，被挡住也消耗。无伤害技能不消耗，无回合期限，可被窃取。"],
      adrenaline:["肾上腺素",`剩余 ${p.adrenaline} 个己方回合`,"造成的所有伤害 +5，受到的所有伤害 −5，包括真实伤害、道具和持续伤害。先增减伤，再结算护盾，最低 0；重复延长、可被窃取。"],
      peace:["和平",`剩余 ${p.peace} 个己方回合`,"免疫所有伤害，包括真实伤害、道具与持续伤害，不消耗护盾。各自后续回合结束计数，跳过的回合照常计数；不阻止九标记胜利。"],
      weak:["虚弱",`剩余 ${p.weak} 个己方回合`,"每段直接技能伤害 −5，最低 0；不影响道具与持续伤害。重复施加延长回合。"],
      poison:["中毒",`剩余 ${p.poison} 次`,"每个己方回合开始受到 2 点普通伤害，可被防御阻挡。重复施加延长回合。"],
      resilience:["坚韧",`剩余 ${p.resilience} 个己方回合`,"免疫跳过回合与行动。连续两个己方回合被跳过后获得；强欲、肾上腺素不再结束回合。可被窃取；不解除封印。"],
      nine:["九标记",`${p.nine} / 2`,"再次发动归一获得第二枚时，九九归一立即获胜。手的数字变化不影响标记。"]
    }[id];
    return data?{title:data[0],tag:"持续状态",stats:[["时限 / 数量",data[1]]],body:data[2],note:""}:null;
  }
  if(kind==="supply") {
    const p=state.players[Number(id)];
    const rounds=p.turns===0?1:supplyIn(p);
    return {title:"道具补给",tag:"",stats:[],body:`将在 ${rounds} 回合后的开始阶段获得一个随机道具。`,note:"按该玩家自己的回合计数；背包满时跳过本次补给。"};
  }
  if (kind === "hand") {
    const owner = Number(id),
      h = Number(hand),
      p = state.players[owner],
      n = p.hands[h];
    return {
      title: `${owner === 0 ? "蓝方" : "红方"} · ${h === 0 ? "左手" : "右手"}`,
      tag: "手势信息",
      stats: [
        ["当前数字", String(n)],
        ["状态", p.locks[h] ? "已封印" : n === 5 ? "护盾生效" : "可参与计算"],
      ],
      body: p.locks[h]
        ? PROP_INFO.lock
        : "行动时先选自己的手，再选对方的手。两手触碰后，通常主动手变为两数之和的个位数。回响会复制给己方双手，镜像会改为写入对手目标手。",
      note:
        n === 5
          ? "单个 5：普通伤害减半并变为 1。双手 55：完全免疫普通伤害且数字不变，数字变化后立即失效。真实伤害不消耗防御。"
          : "双手同为 0、2、4、5、6、7、8、9 时有技能配方；悬停底部配方查看全部选项。",
    };
  }
  if (kind === "shield")
    return {
      title: "护盾",
      image: "ink-mono/foam.webp",
      tag: "被动效果",
      stats: [
        ["条件", "单手为 5"],
        ["减伤", "50%"],
      ],
      body: "单个 5 使普通伤害减半（向上取整），然后变为 1；双手 55 完全免疫普通伤害，不消耗数字且不限次数，数字变化后立即失效。",
      note: "防御顺序：和平 → 55 → 盾墙 → 单个 5。真实伤害跳过护盾，仍受和平与肾上腺素影响；认真一拳先将双手变为 1 并清除盾墙。零伤害不消耗防御。",
    };
  if (kind === "player") {
    const p = state.players[Number(id)];
    return {
      title: playerName(participants, Number(id)),
      tag: "对战角色",
      stats: [
        ["生命", `${p.hp} / ${MAX_HP}`],
        ["道具", `${p.props.length} / 3`],
      ],
      body: "生命先降为 0 的一方失败；获得两枚九标记立即获胜。双方开局 99 生命。悬停或点击状态、道具可查看详细规则。",
      note: `当前武器：${p.weapon ? weaponById(p.weapon).name : "尚未合成"}。${p.hands.includes(5) ? "护盾生效中。" : ""}`,
    };
  }
  if (kind === "phase")
    return {
      title: "回合流程",
      tag: "行动规则",
      stats: [
        ["道具 / 选招 / 计算", "20 秒"],
        ["技能", "合成后自动释放"],
      ],
      body: "道具 → 行动。每回合计算一次，可在计算前后合成并使用技能；放弃只针对当前组合，数字改变后重新询问。",
      note: "超时自动推进、选择合成或执行合法行动。计算已用或无法计算，且没有待选组合时结束回合。本地对局在查看菜单、说明或切到后台时暂停，触碰演出期间不扣操作时间。",
    };
  return null;
}

export function setupInfo(root, getState, asset, getParticipants = () => [], isRemote = () => false) {
  const listeners = new AbortController();
  const listen = (element, event, callback) =>
    element.addEventListener(event, callback, { signal: listeners.signal });
  const pop = document.querySelector("#info-popover");
  let anchor,
    timer,
    pinned = false;
  function hide() {
    clearTimeout(timer);
    anchor?.removeAttribute("aria-describedby");
    anchor = null;
    pinned = false;
    pop.hidden = true;
  }
  function show(button, pin = false) {
    if (
      !pin &&
      button?.matches(
        ".hand-hotspot.target:not([data-info='shield']),.hand-hotspot.selected:not([data-info='shield']),.prop-slot.selected .prop-use",
      )
    )
      return;
    if (
      !button ||
      document.querySelector("#dialog").open ||
      root.querySelector(".is-busy")
    )
      return;
    const data = describe(button.dataset.info, getState(), getParticipants());
    if (!data) return;
    if(isRemote() && button.dataset.info === "phase") data.note="服务器统一计时，菜单、图鉴、后台和断线都不会暂停对局。超时自动执行合法操作。";
    clearTimeout(timer);
    anchor?.removeAttribute("aria-describedby");
    anchor = button;
    pinned = pin;
    button.setAttribute("aria-describedby", "info-popover");
    const kind=button.dataset.info.split(':')[0];
    const stats=data.stats.filter(([label])=>!['阶段','使用'].includes(label));
    pop.setAttribute('role',pin?'dialog':'tooltip');
    pop.setAttribute('aria-label',data.title);
    pop.innerHTML = `${pin?'<button class="info-close" aria-label="关闭详情">×</button>':''}<div class="info-heading">${data.image?`<img src="${asset(data.image)}" alt="">`:''}<div><h3>${escapeHtml(data.title)}</h3><div class="info-tags">${stats.map(([label,value])=>`<span>${kind==='prop'||kind==='weapon'||kind==='status'?'':label+' '}${escapeHtml(value)}</span>`).join('')}</div></div></div><p>${data.body}</p>${pin&&data.note?`<details class="info-rules"><summary>规则细节</summary><p class="info-note">${data.note}</p></details>`:''}`;
    pop.hidden = false;
    const r = button.getBoundingClientRect(),
      box = pop.getBoundingClientRect();
    const mobile = innerWidth < 650;
    const x = mobile
      ? 12
      : Math.min(
          innerWidth - box.width - 12,
          Math.max(12, r.left + r.width / 2 - box.width / 2),
        );
    const y = mobile
      ? Math.max(12, innerHeight - box.height - 16)
      : r.top > box.height + 18
        ? r.top - box.height - 12
        : Math.min(innerHeight - box.height - 12, r.bottom + 12);
    pop.style.left = `${x}px`;
    pop.style.top = `${Math.max(12, y)}px`;
  }
  listen(root, "pointerover", (e) => {
    if (e.pointerType === "touch" || pinned) return;
    const b = e.target.closest("[data-info]");
    clearTimeout(timer);
    if (b && b !== anchor) timer = setTimeout(() => show(b), 220);
  });
  listen(root, "pointerout", (e) => {
    if (pinned) return;
    clearTimeout(timer);
    if (
      e.relatedTarget?.closest?.("#info-popover") ||
      e.relatedTarget?.closest?.("[data-info]") === anchor
    )
      return;
    timer = setTimeout(hide, 150);
  });
  listen(root, "focusin", (e) => {
    const b = e.target.closest("[data-info]");
    if (
      b?.matches(
        '.hand-hotspot.available,.hand-hotspot.target,.prop-use[aria-disabled="false"]',
      )
    )
      return;
    if (b) show(b);
  });
  listen(root, "focusout", (e) => {
    if (!pinned && !pop.contains(e.relatedTarget))
      timer = setTimeout(hide, 100);
  });
  listen(pop, "pointerenter", () => clearTimeout(timer));
  listen(pop, "pointerleave", () => {
    if (!pinned) hide();
  });
  listen(pop, "click", (e) => {
    if (e.target.closest("button")) hide();
  });
  listen(document, "keydown", (e) => {
    if (e.key === "Escape") hide();
  });
  listen(document, "pointerdown", (e) => {
    if (pinned && !pop.contains(e.target) && !anchor?.contains(e.target))
      hide();
  });
  listen(window, "resize", hide);
  return {
    show,
    hide,
    dispose() {
      hide();
      listeners.abort();
    },
  };
}
