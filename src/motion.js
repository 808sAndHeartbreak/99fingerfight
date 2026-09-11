import { calculationOutcome } from "./engine.js";
// Pure presentation timing: rule state remains authoritative and separate.
export const TOUCH_DURATION_MS = 1000;
export const CONTACT_AT = 0.46;
export const RELEASE_AT = 0.74;
export const smooth = (t) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};
export function touchProgress(t) {
  if (t <= 0 || t >= 1) return 0;
  if (t < 0.16) return -0.065 * Math.sin((t / 0.16) * Math.PI);
  if (t < CONTACT_AT) return smooth((t - 0.16) / (CONTACT_AT - 0.16));
  if (t < RELEASE_AT) return 1;
  return 1 - smooth((t - RELEASE_AT) / (1 - RELEASE_AT));
}
export const closeupProgress = (t) =>
  smooth(t / 0.28) * (1 - smooth((t - RELEASE_AT) / (1 - RELEASE_AT)));
export const touchResult = (state, command) =>
  (state.players[command.actor].hands[command.hand] +
    state.players[1 - command.actor].hands[command.targetHand]) %
  10;

export function touchVisualSteps(state, command) {
  const outcome=calculationOutcome(state,command),p=state.players[command.actor];
  const writes=outcome.writes;
  return writes.map(write=>({type:"add",actor:command.actor,hand:outcome.mirror?command.hand:write.hand,targetHand:outcome.mirror?write.hand:command.targetHand,
    visualResult:outcome.value,visualOperands:[p.hands[command.hand],state.players[1-command.actor].hands[command.targetHand]],
    visualWrites:[write],
    visualLabel:outcome.mirror?(outcome.echo?"镜像 × 回响 · 对手双手同值":"镜像 · 对手目标手变数"):outcome.echo?"回响 · 己方双手同值":"主动手变数"}));
}
