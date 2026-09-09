import { playerName } from "./identity.js";
export function phaseCue(old, next, participants) {
  if (next.winner !== null) return old?.winner === next.winner ? null : {kind:"finish", owner:next.winner, title:next.winReason || "胜负已定", label:"决 着", detail:`${playerName(participants, next.winner)} 获胜`, duration:1000};
  if (old && old.turn === next.turn && old.phase === next.phase) return null;
  const attack=!!next.players[next.active].weapon;
  const cues={start:["回合开始","01 / TURN",next.skipping ? "本回合无法行动 · 补给和持续伤害照常" : "准备出手"],planning:["规划阶段","02 / PLAN","使用道具 · 安排组合"],synthesis:["合成阶段","03 / FUSE","选择武器 · 或保留数字"],action:["行动阶段", "04 / ACT",attack ? "发动技能，结束本回合" : next.synthesis === "skipped" ? "无合法组合 · 完成一次计算" : "完成一次计算，结束本回合"]};
  const [title,label,detail]=cues[next.phase];
  return {kind:next.phase,owner:next.active,title,label,detail:`${playerName(participants,next.active)} · ${detail}`,duration:next.phase === "start" ? 450 : 650};
}
export function turnSteps(state) {
  const phases=["start","planning","synthesis","action"];
  const current=phases.indexOf(state.phase);
  return phases.map((id,i)=>({id,label:["开始","规划","合成","行动"][i],current:i===current,done:state.phase==="over" || i<current,note:state.skipping && state.phase==="start" && i>0 ? "本回合跳过" : id==="synthesis" ? ({skipped:"无组合 · 略过",declined:"已放弃",forged:"已合成"}[state.synthesis] || "有配方时进入") : id==="action" ? state.phase === "over" ? "已结束" : state.phase !== "action" ? "技能 / 计算" : state.players[state.active].weapon ? "攻击" : "计算" : id==="planning" ? "使用道具" : "切换回合"}));
}
export const phaseSeconds = s => s.phase === "action" && s.players[s.active].weapon ? 10 : 30;
