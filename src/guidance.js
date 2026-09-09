import { calculationOutcome } from "./engine.js";
import { WEAPONS, PROPS, weaponById, matchingWeapons, handPropNumber, MAX_HP } from "./catalog.js";

export function handPreview(state, selected, owner, hand) {
  if (!selected) return null;
  let affected = owner,
    affectedHand = hand,
    number;
  if (selected.kind === "hand") {
    if (owner === state.active || state.players[owner].locks[hand]) return null;
    const result=calculationOutcome(state,{actor:state.active,hand:selected.hand,targetHand:hand});
    affected=result.writes[0].owner;affectedHand=result.writes[0].hand;number=result.value;
  } else {
    const id = state.players[state.active].props[selected.slot];
    if (PROPS[id]?.target !== "hand") return null;
    if (id === "lock")
      return {
        text: state.players[owner].locks[hand] ? "已被封印" : "封印此手",
        note: state.players[owner].locks[hand]
          ? "不能重复封印"
          : "到其回合结束",
        number: null,
      };
    number = handPropNumber(id,state.players[owner].hands,hand);
  }
  const other = selected.kind==="hand"&&state.players[state.active].echo&&!state.players[state.active].mirror ? number : state.players[affected].hands[1 - affectedHand];
  const weapon =
    matchingWeapons([number, other])[0];
  return {
    number,
    weapon: weapon?.id,
    text:
      selected.kind === "hand"
        ? `碰这里 → ${number}`
        : `${state.players[owner].hands[hand]} → ${number}`,
    note: (selected.kind==="hand" ? state.players[state.active].mirror?"镜像：改变对手目标手 · ":state.players[state.active].echo?"回响：己方双手同值 · ":"" : "") + (weapon ? `${affected === state.active ? "本回合可合成 · " : "对手回合可合成 · "}${matchingWeapons([number,other]).length>1?`${matchingWeapons([number,other]).length} 种技能`:weapon.name}` : number === 5 ? "获得护盾" : ""),
  };
}

export function propUseDetail(state,id) {
  const p=state.players[state.active],e=state.players[1-state.active],sum=p.hands[0]+p.hands[1],enemySum=e.hands[0]+e.hands[1],ruinDamage=Math.max(0,enemySum+(p.adrenaline>0?5:0)-(e.adrenaline>0?5:0));
  return ({wine:`下一次直接攻击首段 +${(p.wine+1)*10}，一次消耗所有酒；无回合期限`,adrenaline:`${p.resilience?"坚韧：本回合继续":"立即结束本回合"}；后续 ${p.adrenaline+3} 个己方回合，所有伤害 +5、受到伤害 −5`,greed:`获得 ${Math.min(2,4-p.props.length)} 个道具，${p.resilience?"坚韧：本回合继续":"立即结束回合"}`,balance:`自己重抽 ${p.props.length-1} 个，对手重抽 ${e.props.length} 个；先消耗制衡`,boon:`自己补 ${4-p.props.length} 个，对手补 ${3-e.props.length} 个；各自最多 3 个`,grace:`恢复 ${Math.min(MAX_HP-p.hp,sum)} 生命（己方数字 ${p.hands.join(" + ")}）`,ruin:e.peace>0?`对手处于和平，伤害被免疫（数字总和 ${enemySum}）`:`造成 ${ruinDamage} 点直接伤害（对手数字 ${e.hands.join(" + ")}），不触发护盾`,echo:p.echo?"已有回响，重复使用不会增加次数": "本回合下一次计算将同一个结果写入己方双手",mirror:p.mirror?"已有镜像，重复使用不会增加次数":"本回合下一次计算只改变对手目标手",silence:"对手下回合不能主动使用道具，正常补给不受影响"})[id] || PROPS[id].detail;
}
export function guidance(state, selected, human, busy) {
  const p = state.players[state.active];
  const canTouch =
    p.locks.some((v) => !v) &&
    state.players[1 - state.active].locks.some((v) => !v);
  if (state.winner !== null)
    return { title: "对局结束", detail: "", step: "over", canTouch: false };
  if (busy) return { title: "出手！", detail: "", step: "resolving", canTouch };
  if (!human)
    return {
      title: ({start:"对手回合开始",planning:"对手正在使用道具",synthesis:"对手正在选择武器",action:p.weapon?"对手准备进攻":"对手正在选择触碰"})[state.phase] || "等待对手",
      detail: "",
      step: "waiting",
      canTouch,
    };
  if (selected?.kind === "prop") {
    const prop = PROPS[p.props[selected.slot]];
    return {
      title: prop.target==="hand"?(p.props[selected.slot]==="lock" && state.players.every(p=>p.locks.some(Boolean))?"双方已有封印，请取消选择":"选择一只手"):`确认使用「${prop.name}」`,
      detail: prop.target==="hand" ? `己方、对方都可选 · 再点道具取消` : "点击道具旁的确认按钮 · 再点道具取消",
      step: "target",
      canTouch,
    };
  }
  if (state.phase === "start") return {title:state.skipping?"本回合无法行动":"回合开始",detail:state.skipping?"补给与持续伤害照常，随后交给对手。":"",step:"start",canTouch};
  if (state.phase === "synthesis") return {title:"选择要合成的技能",detail:state.calculated?"已计算；合成并使用，或结束回合。":"选招后仍可计算一次；也可放弃当前组合。",step:"synthesis",canTouch};
  if (state.phase === "planning")
    return {
      title: p.silenced ? "本回合被沉默，准备行动" : p.weapon
        ? `${weaponById(p.weapon).name}已就绪`
        : p.props.length
          ? "点击道具，选择目标使用"
          : "没有道具，准备行动",
      detail: "",
      step: "planning",
      canTouch,
    };
  if (state.phase === "action" && p.weapon)
    return {
      title: "技能释放中",
      detail: weaponById(p.weapon).name,
      step: "battle",
      canTouch,
    };
  if (!canTouch)
    return {
      title: "暂时没有可碰的手",
      detail: "有手被封印，将自动结束本回合。",
      step: "blocked",
      canTouch,
    };
  return {
    title: selected ? "选对手的一只手" : "选自己的一只手",
    detail: selected ? p.mirror ? "镜像：相加取个位，改变对手目标手" : p.echo ? "回响：相加取个位，写入自己的双手" : "两数相加取个位，改变主动手" : "选好后，再碰对手的手",
    step: selected ? "target" : "source",
    canTouch,
  };
}

export function comboHint(state) {
  const p=state.players[state.active];
  if(p.weapon) return `${weaponById(p.weapon).name} · ${weaponById(p.weapon).detail}`;
  const options=matchingWeapons(p.hands);
  return options.length ? `配方已满足 · ${state.phase === "planning" || state.phase === "synthesis" ? "行动时可选" : "本回合可用"}` : "行动时选择技能或计算";
}
export function comboRoutes(state, owner, hand) {
  const p=state.players[owner], enemy=state.players[1-owner];
  if(p.echo||p.mirror)return WEAPONS.map(weapon=>{
    const targets=[0,1].filter(targetHand=>{
      if(p.locks[hand]||enemy.locks[targetHand])return false;
      const outcome=calculationOutcome(state,{actor:owner,hand,targetHand}),hands=[...p.hands];
      for(const w of outcome.writes)if(w.owner===owner)hands[w.hand]=w.value;
      return matchingWeapons(hands).some(w=>w.id===weapon.id);
    });
    const ready=targets.length>0&&state.phase==="action"&&!p.weapon&&state.active===owner&&state.winner===null;
    return {weapon,ready,status:p.mirror?"镜像不会改变己方配方":ready?`回响：碰${targets.map(i=>i?"右手":"左手").join(" / ")} · 本回合`:"当前无可用触碰组合"};
  });
  return WEAPONS.map(weapon => {
    const recipe=weapon.recipe;
    const other=p.hands[1-hand];
    const desired=recipe[0] === other ? recipe[1] : recipe[1] === other ? recipe[0] : null;
    const needed=desired === null ? null : (desired-p.hands[hand]+10)%10;
    const targets=enemy.hands.flatMap((n,i)=> n===needed && !enemy.locks[i] ? [i ? "右手":"左手"] : []);
    const ready=desired !== null && !p.locks[hand] && targets.length>0 && state.phase==="action" && !p.weapon && state.active===owner && state.winner===null;
    const satisfied=matchingWeapons(p.hands).some(w=>w.id===weapon.id);
    return {weapon,ready,status:satisfied ? "配方已满足" : desired === null ? `另一手需 ${[...new Set(recipe)].join(" / ")}` : p.locks[hand] ? "此手已封印" : ready ? `碰${targets.join(" / ")} · 本回合` : `需碰数字 ${needed}`};
  });
}
export function forgeEvents(old, next, command) {
  if(command.type !== "forge" || old.phase !== "synthesis") return [];
  const weapon=weaponById(command.weapon);
  return weapon && next.players[old.active].weapon === weapon.id ? [{owner:old.active,weapon}] : [];
}

export function propContactNumber(old, command) {
  const id=old.players[old.active].props[command.slot];
  return handPropNumber(id,old.players[command.target].hands,command.targetHand);
}
