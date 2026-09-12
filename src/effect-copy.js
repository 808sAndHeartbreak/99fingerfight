import {PROPS} from './catalog.js';
const team=o=>o?'红方':'蓝方';
const hands=p=>p.hands.map(n=>`[${n}]`).join(' / ');
export function defenseDetail(beat) {
 return ({护盾:'[5] 护盾减半伤害，格挡后变为 [1]',盾墙:'盾墙挡住本次伤害，消耗 1 次',绝对防御:'[5] + [5] 完全挡住普通伤害，数字不变',和平:'和平期间免疫伤害',肾上腺素:'肾上腺素抵消本次伤害'})[beat.blocked]||'';
}
/** Actual outcomes, shared by the live presentation and authoritative history. */
export function effectDetail(old,next,command) {
 const a=old.active,b=1-a,p=next.players[a],e=next.players[b],id=command.type==='attack'?old.players[a].weapon:old.players[a].props[command.slot];
 if(command.type==='prop') {
  const t=command.target,target=next.players[t];
  if(command.targetHand!==undefined)return id==='lock'?`${team(t)}${command.targetHand?'右':'左'}手被封印，不能参与计算，至其回合结束`:`${team(t)}${command.targetHand?'右':'左'}手 [${old.players[t].hands[command.targetHand]}] → [${target.hands[command.targetHand]}]`;
  const details={echo:`${team(a)}下一次计算复制到己方双手`,mirror:`${team(a)}下一次计算写入${team(b)}目标手，己方不变`,silence:`${team(b)}下个回合不能使用道具，仍可计算和合成`,wine:`${team(a)}下次直接攻击首段 +${p.wine*10} 伤害，出手后消耗`,adrenaline:`${team(a)}造成伤害 +5、受到伤害 −5，剩 ${p.adrenaline} 个己方回合${next.active!==a?'；本回合结束':''}`,grace:`${team(t)} HP ${old.players[t].hp} → ${target.hp}，回复 ${target.hp-old.players[t].hp}`,ruin:`${team(b)} HP ${old.players[b].hp} → ${e.hp}；无视护盾`,balance:`双方按原数量重抽道具：${team(a)} ${p.props.length} 个，${team(b)} ${e.props.length} 个`,boon:`双方道具补充完毕：${team(a)} ${p.props.length}/3，${team(b)} ${e.props.length}/3`,greed:`${team(a)}获得 ${Math.max(0,p.props.length-old.players[a].props.length+1)} 个道具${next.active!==a?'，本回合结束':''}`};
  if(['echo','mirror'].includes(id)&&p.echo&&p.mirror)return `${team(a)}镜像＋回响：下次加和结果写入${team(b)}双手，己方不变`;
  return details[id]||`${team(t)}获得${PROPS[id].name}`;
 }
 if(command.type!=='attack')return '';
 // A lethal direct hit stops secondary effects in the shared rules.
 if(next.winner!==null&&id!=='unify'&&id!=='serious')return '';
 const buffs=[['knuckles','指虎','层'],['wine','酒','层'],['adrenaline','肾上腺素','回合'],['peace','和平','回合'],['resilience','坚韧','回合']].flatMap(([key,label,unit])=>Number(p[key])>Number(old.players[a][key])?[`${label} +${Number(p[key])-Number(old.players[a][key])}${unit}`]:[]);
 const stolen=Math.max(0,p.props.length-old.players[a].props.length);
 const lost=old.players[b].props.filter((item,i,all)=>all.slice(0,i+1).filter(x=>x===item).length>e.props.filter(x=>x===item).length);
 return ({serious:`${team(b)}双手归 [1]、盾墙清除；${team(a)}本回合结束${old.players[a].resilience?'，坚韧免疫跳过':'，下回合无法行动'}`,scissors:`${team(b)}双手 ${hands(old.players[b])} → ${hands(e)}`,seven:`${team(b)}每回合开始受到 7 点真实伤害，剩 ${e.seven} 次`,dark:`${team(b)}每回合开始受到 5 点真实伤害，持续至被净化`,buddha:`${team(b)}双手归 [1]；${old.players[b].resilience?'坚韧免疫跳过':`跳过接下来 ${e.skip} 个回合`}`,taser:`${team(b)}${old.players[b].resilience?'坚韧免疫跳过':`跳过接下来 ${e.skip} 个回合`}`,foam:`${team(a)}盾墙可完全挡住 ${p.foam} 次普通伤害`,knuckles:`${team(a)}每段直接技能伤害 +${p.knuckles*10}，永久保留`,peace:`双方免疫伤害：蓝方剩 ${next.players[0].peace} 个己方回合，红方剩 ${next.players[1].peace} 个己方回合`,serpent:`${team(b)}虚弱：技能每击 −5；中毒：回合开始受到 2 点普通伤害（各延长 5 回合）`,steal:`${team(a)}从${team(b)}夺取 ${stolen} 个道具${buffs.length?'；'+buffs.join('、'):'；没有可转移的增益'}${old.players[b].props.length>stolen?'（背包溢出的道具已弃置）':''}`,fan:lost.length?`${team(b)}失去${lost.map(id=>`「${PROPS[id].name}」`).join('、')}`:`${team(b)}没有道具可弃置`,dual:`${team(a)}道具补至 ${p.props.length}/3`,unify:p.nine>=2?`${team(a)}第二次使用归一，九九归一获胜`:`${team(a)}首次使用归一，清除减益；双方双手归 [1]`})[id]||'';
}
