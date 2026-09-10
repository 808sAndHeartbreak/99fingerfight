export function menuMarkup(page, {started=false, online=false, resumable=false}={}) {
 const button=(label,attr,note='')=>`<button class="menu-choice" ${attr}><span>${label}${note?`<small>${note}</small>`:''}</span></button>`;
 const pages={
  home:{label:'',title:'',body:button('开始游戏','data-menu="play"')+button('新手教学','data-tutorial')+button('设置','data-menu-settings')+button('开发者说','data-developer')},
  play:{label:'SELECT MODE',title:'选择<span>战场。</span>',body:button('本地对战','data-menu="local"','同一台设备，随时开打')+button('联机对战','id="online"','与好友或匹配玩家交手')},
  local:{label:'LOCAL BATTLE',title:'这一局<span>和谁打？</span>',body:'<div class="pve-menu-row">'+button('PVE · 人机对战','data-mode="ai"','独自练习，挑战电脑')+(resumable?button('继续<br>上次对局','data-resume-pve aria-label="继续上次对局"'):'')+'</div>'+ button('PVP · 双人对战','data-mode="local"','同屏轮流操作')}
 };
 const p=pages[page]||pages.home;
 return `<div class="menu-body" data-menu-page="${page}">${page==='home'?'':`<h2>${p.title}</h2>`}<div class="menu-actions">${p.body}</div>${page==='home'?'':`<button class="menu-choice menu-back" data-menu="${page==='local'?'play':'home'}"> 返回</button>`}</div><div class="menu-keyart"><img src="./assets/manga/menu-99.webp" alt="指尖对决漫画角色"><div class="menu-wordmark" aria-label="FINGER FIGHT"><span>FINGER</span><strong>FIGHT<i>!</i></strong><small>指尖对决 / ONE TOUCH. NEXT MOVE.</small></div></div>`;
}
