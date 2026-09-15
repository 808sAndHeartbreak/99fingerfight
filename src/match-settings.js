import {DEFAULT_MATCH_OPTIONS} from './match-options.js';

export function matchSettings({options=DEFAULT_MATCH_OPTIONS,difficulty=null,scope='local',disabled=false}={}) {
  const group=(name,label,choices,current)=>`<fieldset class="match-setting"><legend>${label}</legend><div class="setting-segments" role="group" aria-label="${label}">${choices.map(([value,text])=>`<button type="button" data-match-setting="${name}" data-setting-scope="${scope}" data-value="${value}" aria-pressed="${String(value)===String(current)}" ${disabled?'disabled':''}>${text}</button>`).join('')}</div></fieldset>`;
  return `<div class="match-settings">${difficulty?group('difficulty','对手实力',[['easy','简单'],['advanced','进阶'],['master','大师']],difficulty):''}${group('itemsEnabled','道具启用',[['false','关闭'],['true','开启']],options.itemsEnabled)}${group('turnSeconds','回合时长',[[10,'10 秒'],[30,'30 秒'],[60,'60 秒']],options.turnSeconds)}<p class="match-setting-note">${options.itemsEnabled?'随机补给道具，计算与合成自由组合':'纯粹数字攻防，依靠计算与技能取胜'}</p></div>`;
}
