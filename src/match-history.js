import {escapeHtml,playerName} from './identity.js';
export function compactRecord(text) {
 return text.replace(/回合补给获得/g,'补给').replace(/获得「/g,'获得「').replace(/合成「([^」]+)」，双手重置为 1。/g,'合成「$1」 · 双手归 1').replace(/使用「/g,'使用「').replace(/造成 (\d+) 点真实伤害/g,'HP−$1 · 真实').replace(/造成 (\d+) 点普通伤害/g,'HP−$1').replace(/恢复 (\d+) 生命/g,'HP+$1').replace(/，之后还需跳过 (\d+) 回合/g,' · 剩余 $1 回合').replace(/[。]$/,'');
}
export function historyMarkup(log,participants) {
 const groups=[];let phase='回合结算';
 for(const [index,line] of log.entries()){const m=line.match(/^\[回合 (\d+)\] (.*)$/),round=m?.[1]||'开局',text=m?.[2]||line;
 if(/无合法组合，略过合成/.test(text))continue;
 const forge=text.match(/^(蓝方|红方)合成「([^」]+)」，即将释放/);
 if(forge && log.slice(index+1).some(l=>l.includes(`${forge[1]}发动「${forge[2]}」`)))continue;
 let group=groups.at(-1);if(group?.round!==round){group={round,parts:[]};groups.push(group);phase='回合结算';}
 if(/回合补给|本回合无法行动|^(七伤拳|玄冥神掌|中毒)对/.test(text))phase='回合结算';else if(/使用「/.test(text))phase='道具';else if(/合成|计算：|发动「|获胜|认输|离开了对局/.test(text))phase='行动';
 let part=group.parts.at(-1);if(part?.phase!==phase){part={phase,lines:[]};group.parts.push(part);}
 const previous=part.lines.at(-1);
 if(previous?.text===text && /造成 \d+ 点/.test(text))previous.count++;else part.lines.push({text,count:1});
 }
 const render=({text,count})=>{
  let value=compactRecord(text);
  if(count>1)value=value.replace(/HP−(\d+)/,(_,n)=>`HP−${Number(n)*count} · ${count}击`);
  value=value.replace(/玩家一|玩家二|蓝方|红方/g,n=>{const owner=['玩家一','蓝方'].includes(n)?0:1;return `${playerName(participants,owner)}（${owner?'红':'蓝'}方）`;});
  return escapeHtml(value).replace(/HP([−+])(\d+)/g,(_,sign,n)=>`<em class="record-${sign==='+'?'heal':'damage'}">HP${sign}${n}</em>`);
 };
 return `<div class="dialog-body match-history"><button class="dialog-close" data-close aria-label="关闭对局记录">×</button><h2>对局记录</h2><p class="history-note">最近 120 条 · 新回合在上方，同回合按发生顺序阅读</p>${groups.reverse().map(g=>`<section><h3>${g.round==='开局'?'开局':`回合 ${g.round}`}</h3>${g.parts.map(p=>`<div class="history-phase"><ul>${p.lines.map(t=>`<li>${render(t)}</li>`).join('')}</ul></div>`).join('')}</section>`).join('')}</div>`;
}
