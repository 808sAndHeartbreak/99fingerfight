import { playerName } from "./identity.js";
export const TURN_SECONDS = 30;
export const turnSeconds = () => TURN_SECONDS;
export function phaseCue(old,next,participants) {
  if(next.winner!==null)return old?.winner===next.winner?null:{kind:"finish",owner:next.winner,title:next.winReason||"胜负已定",label:"决 着",detail:`${playerName(participants,next.winner)} 获胜`,duration:1000};
  if(old && old.turn===next.turn)return null;
  return {kind:"start",owner:next.active,title:next.skipping?"本回合无法行动":"回合开始",label:"TURN",detail:`${playerName(participants,next.active)} 的回合`,duration:!old?1400:1200};
}
