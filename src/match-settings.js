import {DEFAULT_MATCH_OPTIONS} from './match-options.js';

const note=options=>options.itemsEnabled?'每 3 个己方回合，补给 1 个道具。（推荐）':'无道具补给，纯粹计算（不推荐）';
export function matchSettings({options=DEFAULT_MATCH_OPTIONS,difficulty=null,scope='local',disabled=false}={}) {
 const group=(name,label,choices,current)=>`<fieldset class="match-setting"><legend>${label}</legend><div class="setting-segments" role="group" aria-label="${label}" style="--count:${choices.length};--selected:${choices.findIndex(([v])=>String(v)===String(current))}">${choices.map(([value,text])=>`<button type="button" data-match-setting="${name}" data-setting-scope="${scope}" data-value="${value}" aria-pressed="${String(value)===String(current)}" ${disabled?'disabled':''}><span>${text}</span></button>`).join('')}</div></fieldset>`;
 return `<div class="match-settings" data-scope="${scope}">${difficulty?group('difficulty','对手实力',[['easy','简单'],['advanced','进阶'],['expert','高手'],['master','大师']],difficulty):''}${group('itemsEnabled','道具启用',[['false','关闭'],['true','开启']],options.itemsEnabled)}${group('turnSeconds','回合时长',[[10,'10 <small>秒</small>'],[30,'30 <small>秒</small>'],[60,'60 <small>秒</small>']],options.turnSeconds)}<p class="match-setting-note">${note(options)}</p></div>`;
}
// Keep the controls mounted: focus and the sliding selection survive a change.
export function updateMatchSettings(root,{options=DEFAULT_MATCH_OPTIONS,difficulty,disabled=false}={}) {
 for(const group of root.querySelectorAll('.setting-segments')) {
  const buttons=[...group.querySelectorAll('button')],key=buttons[0].dataset.matchSetting;
  const selected=key==='difficulty'?difficulty:options[key];
  group.style.setProperty('--selected',buttons.findIndex(b=>b.dataset.value===String(selected)));
  for(const b of buttons){b.setAttribute('aria-pressed',String(b.dataset.value===String(selected)));b.disabled=disabled;}
 }
 root.querySelector('.match-setting-note').textContent=note(options);
}
