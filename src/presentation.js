import {effectDetail,defenseDetail} from "./effect-copy.js";
import {stateChanges} from "./state-changes.js";
import {TOUCH_DURATION_MS} from "./motion.js";
import {PROPS,weaponById} from './catalog.js';
import {phaseCue} from './phase-cue.js';
export const ITEM_NOTICE_MS=4000, ITEM_SETTLE_MS=1000;
export const SKILL_MOTION=Object.freeze({
 serious:['punch','归一 · 破盾 · 真实伤害'],drunken:['swirl','醉拳 · 5～10 连击'],seven:['curse','七伤 · 七回合'],scissors:['slash','剪断 · 双手减一'],fan:['fan','花蝶 · 弃置道具'],claw:['slash','爪击 · 两段真实伤害'],buddha:['palm','神掌 · 三回合禁行动'],dragon:['dragon','降龙 · 重击'],sorrow:['palm','残血 · 反击'],dark:['curse','玄冥 · 永久侵蚀'],frag:['burst','爆破'],foam:['guard','盾墙 · 两次防御'],knuckles:['guard','指虎 · 永久强化'],peace:['guard','和平 · 免疫伤害'],serpent:['curse','双头蛇 · 虚弱与中毒'],steal:['steal','窃取 · 道具与增益'],dual:['gun','双枪 · 四连击'],sniper:['snipe','狙击 · 真实伤害'],taser:['bolt','电击 · 三回合禁行动'],unify:['nine','归一 · 再次使用即可获胜']
});
export function actionBeats(old,next,command) {
 const beats=[];
 for(const e of next.events||[])if(e.type==='skip'||e.type==='resilience')beats.push({type:'effect',owner:e.owner,label:e.type==='skip'?'本回合无法行动':'获得坚韧 · 免疫跳过'});
 for(const e of next.events||[])if(e.type==='damage')beats.push({...e,label:e.blocked&&e.amount===0?e.blocked:`${e.source} · ${e.trueDamage?'真实伤害':'伤害'} HP-${e.amount}`});
 if(command.type==='attack'){
  const id=old.players[old.active].weapon;
  const effects=['serious','seven','scissors','fan','buddha','dark','foam','knuckles','peace','serpent','steal','dual','taser','unify'];
  if((next.winner===null||id==='unify')&&effects.includes(id))beats.push({type:'effect',owner:old.active,skillEffect:true,label:effectDetail(old,next,command)});
 }
 if(command.type==='prop')beats.push({type:'effect',owner:command.target,label:effectDetail(old,next,command)});
 return beats;
}
export function actionDuration(old,next,c) {
 if(c.type==='add')return TOUCH_DURATION_MS * (old.players[old.active].echo?2:1);
 if(c.type==='forge')return 650;
 if(c.type==='attack')return old.players[old.active].weapon==='unify'?(next.winReason==='九九归一'?4400:3000):3650+Math.max(0,actionBeats(old,next,c).length-1)*400;
 if(c.type==='prop')return ITEM_NOTICE_MS+ITEM_SETTLE_MS;
 return actionBeats(old,next,c).length?900*actionBeats(old,next,c).length+1200:stateChanges(old,next).length?900:0;
}
export function presentationDuration(old,next,c) {
 const cue=phaseCue(old,next);
 return actionDuration(old,next,c)+(['start','finish'].includes(cue?.kind)?cue.duration:0);
}
export const commandArt=(old,c)=>c.type==='attack'?weaponById(old.players[old.active].weapon):c.type==='prop'?PROPS[old.players[old.active].props[c.slot]]:null;

export function skillSummary(old,next,command) {
 const weapon=weaponById(old.players[old.active].weapon);
 const hits=(next.events||[]).filter(e=>e.type==='damage'&&e.owner===1-old.active&&e.source===weapon?.name);
 return {hits:hits.length,damage:hits.reduce((sum,e)=>sum+e.amount,0),effects:[...new Set([...actionBeats(old,next,command).filter(e=>e.type==='effect').map(e=>e.label),...hits.filter(e=>e.blocked).map(defenseDetail)])]};
}
