import { RULES_VERSION } from "./engine.js";
import { escapeHtml, normalizeParticipants } from './identity.js';
const read=(key,storage='sessionStorage')=>{try{return window[storage].getItem(key);}catch{return null;}};
const write=(key,value,storage='sessionStorage')=>{try{window[storage].setItem(key,value);}catch{}};
export class OnlineClient {
 constructor(onChange,onStatus) {this.onChange=onChange;this.onStatus=onStatus;this.pending=new Map();this.status='offline';this.packet=null;this.retry=0;this.closed=false;}
 connect(){
  clearTimeout(this.timer);
  const previous=this.socket;this.socket=null;previous?.close();
  for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('连接已更新，请重试'));}this.pending.clear();
  this.closed=false;this.status='connecting';this.onStatus?.();
  const url=new URL('/ws',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';
  const socket=this.socket=new WebSocket(url);
  socket.onopen=()=>this.socket===socket&&socket.send(JSON.stringify({type:'hello',protocolVersion:2,rulesVersion:RULES_VERSION,token:read('ff-token'),displayName:read('ff-name','localStorage')||''}));
  socket.onmessage=e=>{
   if(this.socket!==socket)return;
   let m;try{m=JSON.parse(e.data);}catch{return;}
   if(m.type==='welcome'){write('ff-token',m.token);this.status='connected';this.retry=0;this.onStatus?.();}
   if(m.type==='snapshot'){this.packet=m;this.offset=Date.now()-m.serverNow;this.onChange(m);}
   if(m.type==='ack'||m.type==='error'){const p=this.pending.get(m.id);if(p){clearTimeout(p.timer);this.pending.delete(m.id);m.type==='ack'?p.resolve():p.reject(new Error(m.message));}else if(m.type==='error')this.onStatus?.(m.message);}
  };
  socket.onclose=e=>{
   if(this.socket!==socket)return;
   this.status=e.code===4004?'outdated':e.code===4001?'replaced':'reconnecting';
   for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error('连接中断，重连后以服务器状态为准'));}this.pending.clear();this.onStatus?.();
   if(!this.closed&&![4001,4004].includes(e.code))this.timer=setTimeout(()=>this.connect(),Math.min(8000,700*2**this.retry++));
  };socket.onerror=()=>{};
 }
 request(op,fields={}){
  if(this.status!=='connected'||this.socket.readyState!==WebSocket.OPEN)return Promise.reject(new Error('正在重连，请稍候'));
  const id=crypto.randomUUID();
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('请求未确认，正在刷新状态'));this.socket.close();},8000);this.pending.set(id,{resolve,reject,timer});this.socket.send(JSON.stringify({type:'request',id,op,...fields}));});
 }
 async saveDraft(){if(this.nameDraft!=null)await this.rename(this.nameDraft);}
 async rename(name){await this.request('name',{name});write('ff-name',name.trim()?normalizeParticipants([{displayName:name}])[0].displayName:'','localStorage');if(this.nameDraft===name)this.nameDraft=null;}
 serverNow(){return Date.now()-(this.offset||0);}
 getParticipants(){return this.packet?.room?.participants||[];}
 getSnapshot(){return this.packet?.room?.state;}
 send(command){return this.request('command',{matchId:this.packet?.room?.matchId,command});}
 dispose(){} // Leaving a match is explicit; the lobby connection persists.
 close(){this.closed=true;clearTimeout(this.timer);this.socket?.close();}
}
export function onlineMarkup(net){
 const p=net.packet,r=p?.room,e=escapeHtml,connected=net.status==='connected',disabled=connected&&!net.busy?'':'disabled';
 const invite=new URL(location.href).searchParams.get('room')||'';
 const peer=r?.participants?.find(x=>x.seat!==r.seat);
 const canRematch=!!peer&&!peer.departed&&peer.connected;
 let body='';
 if(r){
  body=`<div class="room-code"><span>房间码</span><strong>${r.code}</strong><button id="copy-room">复制邀请</button></div><div class="room-players">${[0,1].map(i=>{const player=r.participants[i],present=player&&!player.departed;return `<div class="${present&&player.connected?'present':''}"><small>PLAYER 0${i+1}${i===r.seat?' / 你':''}</small><b title="${present?e(player.displayName):'等待玩家'}">${present?e(player.displayName):'等待玩家'}</b><span>${present?player.connected?(r.status==='finished'?(r.rematch[i]?'想再战一局':'对局结束'):r.ready[i]?'已准备':r.status==='playing'?'对局中':'未准备'):'等待重连':player?.departed?'已离开房间':'分享房间码邀请加入'}</span></div>`;}).join('')}</div>`;
  body+=r.status==='waiting'?`<button id="online-ready" class="primary" ${disabled}>${r.ready[r.seat]?'取消准备':'准备对战'} </button><p class="lobby-hint">${!peer?'邀请一位对手，双方准备后开始':!peer.connected?'等待对手恢复连接':r.ready[r.seat]?'你已就绪，等待对手准备':'双方准备后开始'}</p>`:r.status==='finished'?`<button id="online-rematch" class="primary" ${disabled} ${r.rematch[r.seat]||!canRematch?'disabled':''}>${peer?.departed?'对手已离开':!canRematch?'等待对手返回':r.rematch[r.seat]?'已发出再战邀请':'再战一局 '}</button><p class="lobby-hint">${peer?.departed?'对手已离开，返回大厅开始新的对战。':r.rematch[1-r.seat]?'对手想再战一局，确认即可开始。':'双方确认后开始新对局。'}</p>`:'<p class="lobby-hint">对局仍在继续，返回战场即可出手。</p><button class="primary" data-close>返回对局 </button>';
  body+=`<button id="online-leave" class="text-button" ${disabled}>${r.status==='playing'?'离开并认输':'离开房间'}</button>`;
 } else if(p?.queued)body=`<div class="match-search" role="status"><div class="search-orbit" aria-hidden="true">VS</div><b>正在寻找对手</b><span>匹配成功后自动开始</span></div><button id="online-cancel" class="secondary" ${disabled}>取消匹配</button>`;
 else if(net.view==='join'||invite)body=`<form id="join-form"><label for="room-code">输入好友的房间码</label><div class="name-entry"><input id="room-code" name="code" maxlength="6" value="${e(net.joinCode||invite)}" placeholder="六位房间码" autocomplete="off" autocapitalize="characters" spellcheck="false" required><button class="secondary" ${disabled}>加入房间</button></div></form><button id="online-options" class="text-button"> 联机选项</button>`;
 else body=`<div class="online-options"><button id="online-queue" class="menu-choice" ${disabled}><span>开始匹配<small>寻找一位在线对手</small></span></button><button id="online-create" class="menu-choice" ${disabled}><span>创建房间<small>邀请好友，准备后开局</small></span><b>＋</b></button><button id="online-join" class="menu-choice" ${disabled}><span>加入房间<small>输入好友的房间码</small></span></button></div>`;
 return `<div class="dialog-body online-lobby">${!p?.queued&&r?.status!=="waiting"?`<button class="dialog-close" data-close aria-label="${r?.state?'返回对局':'返回菜单'}">×</button>`:""}<small class="kicker">FINGER FIGHT / ONLINE</small><h2>${r?'对战房间':p?.queued?'寻找下一位对手。':net.view==='join'||invite?'加入房间':'联机对战。'}</h2><p class="network-state" role="status"><i class="status-dot ${connected?'connected':''}"></i>${connected?'已连接':net.status==='outdated'?'版本已更新，请刷新页面':net.status==='replaced'?'此身份已在其他页面打开':'连接中 · 自动重试'}${net.status==='replaced'?'<button id="online-reconnect">重新连接</button>':''}</p><form id="name-form"><label for="online-name">你的名字 <small>最多 10 个字符</small></label><div class="name-entry"><input id="online-name" name="name" maxlength="200" value="${e(net.nameDraft ?? (p?.profile?.displayName||read('ff-name','localStorage')||''))}" placeholder="输入昵称（可选）" autocomplete="nickname"><button class="secondary" ${disabled}>保存</button></div></form>${body}<p class="online-error" id="online-error" role="status">${e(net.error||'')}</p>${!r&&!p?.queued?'<button id="online-back" class="text-button"> 返回模式选择</button>':''}</div>`;
}
