import { playerName } from "./identity.js";
export function phaseCue(old, next, participants) {
  if (next.winner !== null) return old?.winner === next.winner ? null : {kind:"finish", owner:next.winner, title:next.winReason || "胜负已定", label:"决 着", detail:`${playerName(participants, next.winner)} 获胜`, duration:1000};
  if (old && old.turn === next.turn && old.phase === next.phase) return null;
  const attack=!!next.players[next.active].weapon;
  const cues={start:["回合开始","01 / TURN",next.skipping ? "本回合无法行动 · 补给和持续伤害照常" : "准备出手"],planning:["道具阶段","01 / ITEM","点击道具，选择目标使用"],synthesis:["行动阶段","02 / ACT","合成并使用 · 或结束回合"],action:["行动阶段", "02 / ACT",attack ? "发动技能，结束本回合" : next.synthesis === "skipped" ? "无合法组合 · 完成一次计算" : "完成一次计算，结束本回合"]};
  const [title,label,detail]=cues[next.phase];
  return {kind:next.phase,owner:next.active,title,label,detail:`${playerName(participants,next.active)} · ${detail}`,duration:!old && next.phase==="start"?1400:0};
}
export function turnSteps(state) {
  const current=state.phase==="planning"?0:["synthesis","action"].includes(state.phase)?1:-1;
  return ["planning","action"].map((id,i)=>({id,label:["道具","行动"][i],current:i===current,done:state.phase==="over"||i<current,note:state.skipping&&state.phase==="start"?"本回合跳过":id==="planning"?"使用道具":state.phase==="synthesis"?"选招 / 结束":state.players[state.active].weapon?"攻击":"计算"}));
}
export const autoItemPhase = s => s.phase==="planning" && (!s.players[s.active].props.length || s.players[s.active].silenced);
export const phaseSeconds = s => autoItemPhase(s) ? 1 : s.phase === "action" && s.players[s.active].weapon ? 0 : 30;
