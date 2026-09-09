export function menuMarkup(page, {started=false, online=false}={}) {
 const button=(label,attr,note='')=>`<button class="menu-choice" ${attr}><span>${label}${note?`<small>${note}</small>`:''}</span><b>↗</b></button>`;
 const pages={
  home:{label:'MAIN MENU',title:'指尖<span>对决。</span>',body:button('开始游戏','data-menu="play"','触碰数字，合成绝招')},
  play:{label:'SELECT MODE',title:'选择<span>战场。</span>',body:button('游戏教学','data-mode="tutorial"','三个短练习，立即上手')+button('本地对战','data-menu="local"','同一台设备，随时开打')+button('联机对战','id="online"','与好友或匹配玩家交手')},
  local:{label:'LOCAL BATTLE',title:'这一局<span>和谁打？</span>',body:button('PVE · 人机对战','data-mode="ai"','独自练习，挑战电脑')+button('PVP · 双人对战','data-mode="local"','同屏轮流操作')}
 };
 const p=pages[page]||pages.home;
 return `<div class="menu-body"><small class="kicker">${p.label}</small><h2>${p.title}</h2><div class="menu-actions">${p.body}</div>${page==='home'?'<button class="text-button" data-menu-help>玩法说明</button>':`<button class="text-button" data-menu="${page==='local'?'play':'home'}">← 返回</button>`}${started?`<button class="secondary" data-close>继续${online?'联机':'当前'}对局 →</button>`:''}${started?'<p class="menu-footnote">开启新对局将替换当前本地进度。</p>':''}</div><div class="menu-keyart"><img src="./assets/manga/menu-99.webp" alt="指尖对决漫画角色"><div class="menu-wordmark" aria-label="FINGER FIGHT"><span>FINGER</span><strong>FIGHT<i>!</i></strong><small>指尖对决 / ONE TOUCH. NEXT MOVE.</small></div></div>`;
}
