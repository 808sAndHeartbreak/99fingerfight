import {TOUCH_DURATION_MS} from "./motion.js";
import {PROPS,weaponById} from './catalog.js';
import {phaseCue} from './phase-cue.js';
export const SKILL_MOTION=Object.freeze({
 serious:['punch','归一 · 破盾 · 真实伤害'],drunken:['swirl','醉拳 · 5～10 连击'],seven:['curse','七伤 · 七回合'],scissors:['slash','剪断 · 双手减一'],fan:['fan','花蝶 · 弃置道具'],claw:['slash','爪击 · 两段真实伤害'],buddha:['palm','神掌 · 三回合禁行动'],dragon:['dragon','降龙 · 重击'],sorrow:['palm','残血 · 反击'],dark:['curse','玄冥 · 永久侵蚀'],frag:['burst','爆破'],foam:['guard','盾墙 · 两次防御'],knuckles:['guard','指虎 · 永久强化'],peace:['guard','和平 · 免疫伤害'],serpent:['curse','双头蛇 · 虚弱与中毒'],steal:['steal','窃取 · 道具与增益'],dual:['gun','双枪 · 四连击'],sniper:['snipe','狙击 · 真实伤害'],taser:['bolt','电击 · 三回合禁行动'],unify:['nine','归一 · 累积九印']
});
export function actionBeats(old,next,command) {
 const beats=[];
 for(const e of next.events||[])if(e.type==='damage')beats.push({...e,label:e.blocked&&e.amount===0?e.blocked:`${e.source} · ${e.trueDamage?'真实伤害':'伤害'} HP-${e.amount}`});
 if(command.type==='attack'){
  const id=old.players[old.active].weapon,p=next.players[old.active],e=next.players[1-old.active];
  if(next.winner===null||id==='unify') {
   const labels={serious:old.players[old.active].resilience?'双手归一 · 破盾 · 本回合结束 · 坚韧免疫下回合跳过':'双手归一 · 破盾 · 本回合结束 · 下回合无法行动',seven:`七伤已施加 · 剩余 ${e.seven} 次`,scissors:`对手双手 → ${e.hands.join(' / ')}`,fan:'花蝶扇 · 道具已结算',buddha:old.players[1-old.active].resilience?'双手归一 · 坚韧免疫跳过':'双手归一 · 跳过三回合',dark:'玄冥 · 永久侵蚀',foam:`盾墙 → ${p.foam} 次`,knuckles:`指虎 ${p.knuckles} 层 · 每段技能 +${p.knuckles*10}`,peace:'双方和平 · 各自接下来三回合免疫伤害',serpent:'虚弱与中毒 · 五回合',steal:'道具与增益已转移',dual:`道具补充 → ${p.props.length}/3`,taser:old.players[1-old.active].resilience?'坚韧：免疫跳过':'对手跳过三回合',unify:p.nine===2?'九九归一':'减益已清除 · 九印 1 / 2'};
   if(labels[id])beats.push({type:'effect',owner:old.active,label:labels[id]});
  }
 }
 if(command.type==='prop'){
  const id=old.players[old.active].props[command.slot],p=next.players[command.target];
  let label=PROPS[id].name+' · 生效';
  if(command.targetHand!==undefined)label=id==='lock'?'封印至该玩家回合结束':`数字 ${old.players[command.target].hands[command.targetHand]} → ${p.hands[command.targetHand]}`;
  if(id==='grace')label=`回复 ${p.hp-old.players[command.target].hp} 生命`;
  if(id==='wine')label=`首段伤害 +${next.players[old.active].wine*10} · 下次直接攻击消耗`;
  if(id==='adrenaline')label=`${old.players[old.active].resilience?'坚韧：本回合继续':'本回合结束'} · 三回合伤害 +5、减伤 5`;
  if(id==='greed')label=old.players[old.active].resilience?'获得道具 · 坚韧：本回合继续':'获得道具 · 立即结束回合';
  if(id==='echo'||id==='mirror')label=PROPS[id].name+' · 本回合计算生效';
  beats.unshift({type:'effect',owner:command.target,label});
 }
 return beats;
}
export function actionDuration(old,next,c) {
 if(c.type==='add')return TOUCH_DURATION_MS * (old.players[old.active].echo?2:1);
 if(c.type==='forge')return 0;
 if(c.type==='attack')return old.players[old.active].weapon==='unify'?(next.winReason==='九九归一'?3200:1800):2450+Math.max(0,actionBeats(old,next,c).length-1)*220;
 if(c.type==='prop')return 350;
 return actionBeats(old,next,c).length?900:0;
}
export function presentationDuration(old,next,c) {
 const cue=phaseCue(old,next);
 return actionDuration(old,next,c)+(['start','finish'].includes(cue?.kind)?cue.duration:0);
}
export const commandArt=(old,c)=>c.type==='attack'?weaponById(old.players[old.active].weapon):c.type==='prop'?PROPS[old.players[old.active].props[c.slot]]:null;

export function skillSummary(old,next,command) {
 const weapon=weaponById(old.players[old.active].weapon);
 const hits=(next.events||[]).filter(e=>e.type==='damage'&&e.owner===1-old.active&&e.source===weapon?.name);
 return {hits:hits.length,damage:hits.reduce((sum,e)=>sum+e.amount,0),effects:actionBeats(old,next,command).filter(e=>e.type==='effect').map(e=>e.label)};
}
