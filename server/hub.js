import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createGame, applyCommand, RULES_VERSION } from '../src/engine.js';
import { chooseCommand } from '../src/ai.js';
import { phaseSeconds, phaseCue, autoItemPhase } from '../src/phase-cue.js';
import { presentationDuration } from '../src/presentation.js';
import { normalizeParticipants } from '../src/identity.js';
const hash = token => createHash('sha256').update(token).digest('hex');
const check = (ok, message) => { if (!ok) throw new Error(message); };
const cleanName = value => typeof value==='string' && value.trim() ? normalizeParticipants([{displayName:value}])[0].displayName : '';
export class MatchHub {
  constructor({file=null, now=Date.now, graceMs=60000, animationMs=null}={}) {
    this.file=file; this.now=now; this.graceMs=graceMs; this.animationMs=animationMs;
    this.users=new Map(); this.rooms=new Map(); this.clients=new Map(); this.queue=[];
    if(file && existsSync(file)) {
      const saved=JSON.parse(readFileSync(file,'utf8'));
      check(saved.version===1,'Unsupported room persistence format');
      this.users=new Map(saved.users); this.rooms=new Map(saved.rooms);
      for(const u of this.users.values()) {u.name=cleanName(u.name);u.disconnectedAt=now();u.queued=false;}
      for(const r of this.rooms.values()) {
        if(r.state && r.state.rulesVersion!==RULES_VERSION) {r.state=null;r.status='waiting';r.ready=[false,false];r.seats=r.seats.filter(Boolean);r.matchId=null;r.readyAt=0;r.deadlineAt=null;r.cache={};r.finishReason=null;}
        if(r.seatNames)r.seatNames=r.seatNames.map(cleanName);
        r.rematch=[false,false];
      }
    }
  }
  save() {
    if(!this.file) return;
    mkdirSync(dirname(this.file),{recursive:true});
    writeFileSync(this.file+'.tmp',JSON.stringify({version:1,users:[...this.users],rooms:[...this.rooms]}),{mode:0o600});
    renameSync(this.file+'.tmp',this.file);
  }
  connected(id) {return this.clients.has(id);}
  packet(u, event=null) {
    const r=this.rooms.get(u.room);
    return {type:'snapshot',serverNow:this.now(),profile:{displayName:u.name},queued:!!u.queued,
      room:r ? {code:r.code,matchId:r.matchId,status:r.status,seat:r.seats.indexOf(u.id),ready:r.ready,rematch:r.rematch,
        participants:r.seats.map((id,seat)=> {const p=this.userById(id);return {seat,departed:!p,displayName:p?.name || r.seatNames?.[seat] || (seat===0?'玩家一':'玩家二'),connected:!!p&&this.connected(id),reconnectUntil:p&&!this.connected(id)&&r.status==='playing'?p.disconnectedAt+this.graceMs:null};}),
        state:r.state ? this.publicState(r.state):null,deadlineAt:r.deadlineAt,readyAt:r.readyAt,event,
        finishReason:r.finishReason || null} : null};
  }
  publicState(state) {const copy=structuredClone(state);delete copy.rng;return copy;}
  userById(id) {for(const u of this.users.values()) if(u.id===id)return u;return null;}
  emit(u,event=null) {this.clients.get(u.id)?.send(JSON.stringify(this.packet(u,event)));}
  broadcast(r,event=null) {for(const id of r.seats) {const u=this.userById(id);if(u)this.emit(u,event);}}
  hello(ws,{token,displayName,protocolVersion,rulesVersion}) {
    if(protocolVersion!==2){ws.close(4004,'Client updated; reload');throw new Error('客户端版本已更新，请刷新');}
    if(rulesVersion!==RULES_VERSION){ws.close(4004,'Rules updated; reload');throw new Error('规则已更新，请刷新页面');}
    let u=typeof token==='string'&&token.length<200?this.users.get(hash(token)):null;
    if(!u) {
      check(this.users.size<10000,'服务繁忙，请稍后重试');
      token=randomBytes(32).toString('hex');u={id:randomUUID(),name:cleanName(displayName),room:null,queued:false,lastSeen:this.now(),disconnectedAt:null};this.users.set(hash(token),u);
    }
    if(displayName===''&&u.name==='玩家一')u.name='';
    const previous=this.clients.get(u.id);if(previous&&previous!==ws)previous.close(4001,'Session opened elsewhere');
    this.clients.set(u.id,ws);ws.userId=u.id;u.disconnectedAt=null;u.lastSeen=this.now();
    ws.send(JSON.stringify({type:'welcome',token,protocolVersion:2}));
    this.save();const r=this.rooms.get(u.room);if(r)this.broadcast(r);else this.emit(u);
    return u;
  }
  disconnect(ws) {
    const u=this.userById(ws.userId);if(!u||this.clients.get(u.id)!==ws)return;
    this.clients.delete(u.id);u.disconnectedAt=this.now();u.lastSeen=this.now();
    this.queue=this.queue.filter(id=>id!==u.id);u.queued=false;
    const r=this.rooms.get(u.room);if(r){const seat=r.seats.indexOf(u.id);if(r.status==='waiting')r.ready[seat]=false;if(r.status==='finished')r.rematch[seat]=false;this.broadcast(r);}
    this.save();
  }
  begin(r) {
    check(r.seats.length===2&&r.seats.every(id=>this.connected(id)),'需要两位在线玩家');
    r.state=createGame(randomBytes(4).readUInt32LE());r.matchId=randomUUID();r.status='playing';r.ready=[false,false];r.rematch=[false,false];r.seatNames=r.seats.map(id=>this.userById(id).name);r.cache={};r.finishReason=null;
    r.readyAt=this.now()+(this.animationMs===null ? phaseCue(null,r.state).duration : 0);r.deadlineAt=r.readyAt+(this.animationMs===null?0:1000);
  }
  create(u) {
    check(!u.room&&!u.queued,'请先离开当前房间或取消匹配');check(this.rooms.size<1000,'房间已满，请稍后重试');
    let code;do{code=randomBytes(4).toString('hex').slice(0,6).toUpperCase();}while(this.rooms.has(code));
    const r={code,seats:[u.id],ready:[false,false],rematch:[false,false],status:'waiting',state:null,matchId:null,deadlineAt:null,readyAt:0,cache:{}};
    this.rooms.set(code,r);u.room=code;return r;
  }
  leave(u) {
    this.queue=this.queue.filter(id=>id!==u.id);u.queued=false;
    const r=this.rooms.get(u.room);if(!r){u.room=null;return;}
    if(r.status==='playing') this.finish(r,1-r.seats.indexOf(u.id),'对手离开了对局');
    if(r.status==='waiting')r.seats=r.seats.filter(id=>id!==u.id);
    else r.seats[r.seats.indexOf(u.id)]=null;
    u.room=null;
    if(!r.seats.some(Boolean))this.rooms.delete(r.code);
    else if(r.status==='waiting'){r.ready=[false,false];this.broadcast(r);}
    else {this.broadcast(r);}
  }
  finish(r,winner,reason) {
    if(r.status!=='playing')return;
    r.state={...r.state,revision:r.state.revision+1,winner,phase:'over',log:[...r.state.log,`[回合 ${Math.ceil(r.state.turn/2)}] ${reason}`].slice(-30)};
    r.status='finished';r.finishReason=reason;r.deadlineAt=null;r.readyAt=0;
  }
  step(r,command) {
    const old=r.state,next=applyCommand(old,command);r.state=next;
    if(next.winner!==null){r.status='finished';r.deadlineAt=null;r.readyAt=this.now()+presentationDuration(old,next,command);}
    else {
      const buffer=this.animationMs===null?presentationDuration(old,next,command):( ['add','forge','attack'].includes(command.type)?this.animationMs:1000);
      r.readyAt=this.now()+buffer;
      if(next.turn!==old.turn||next.phase!==old.phase||autoItemPhase(next))r.deadlineAt=r.readyAt+(next.phase==='start'?0:phaseSeconds(next)*1000);
      else r.deadlineAt+=buffer;
    }
    return {command,revision:next.revision,matchId:r.matchId};
  }
  request(ws,message) {
    const u=this.userById(ws.userId);check(u&&this.clients.get(u.id)===ws,'请重新连接');u.lastSeen=this.now();
    const {op,id}=message;check(typeof id==='string'&&id.length<=80,'无效请求');
    let r=this.rooms.get(u.room),event=null;
    if(op==='name') {check(typeof message.name==='string'&&message.name.length<=200,'名字过长');u.name=cleanName(message.name);if(r?.seatNames)r.seatNames[r.seats.indexOf(u.id)]=u.name;}
    else if(op==='create') r=this.create(u);
    else if(op==='join') {
      check(!u.room&&!u.queued,'请先退出当前房间或匹配');
      const code=String(message.code||'').trim().toUpperCase();check(/^[A-F0-9]{6}$/.test(code),'请输入六位房间码');
      r=this.rooms.get(code);check(r&&r.status==='waiting','房间不存在或已开始');check(r.seats.length<2,'房间已满');r.seats.push(u.id);u.room=code;
    } else if(op==='queue') {
      check(!u.room,'请先离开房间');
      if(!u.queued){const other=this.queue.find(id=>id!==u.id&&this.connected(id)&&!this.userById(id)?.room);
        if(other){const p=this.userById(other);this.queue=this.queue.filter(id=>id!==other);p.queued=false;r=this.create(p);r.seats.push(u.id);u.room=r.code;this.begin(r);}
        else {u.queued=true;this.queue.push(u.id);}}
    } else if(op==='cancel') {this.queue=this.queue.filter(id=>id!==u.id);u.queued=false;}
    else if(op==='leave') {this.leave(u);r=null;}
    else if(op==='ready') {check(r?.status==='waiting','当前不能准备');r.ready[r.seats.indexOf(u.id)]=message.ready===true;if(r.seats.length===2&&r.ready.every(Boolean))this.begin(r);}
    else if(op==='rematch') {check(r?.status==='finished'&&r.seats.length===2&&r.seats.every(Boolean),'对手已离开，请返回大厅');check(r.seats.every(id=>this.connected(id)),'等待对手重连后再战');r.rematch[r.seats.indexOf(u.id)]=true;if(r.rematch.every(Boolean))this.begin(r);}
    else if(op==='command') {
      check(r?.status==='playing'||r?.status==='finished','不在对局中');check(message.matchId===r.matchId,'对局已更新');
      const cacheKey=u.id+':'+id;
      if(r.cache[cacheKey]) {ws.send(JSON.stringify({type:"ack",id}));this.emit(u);return;}
      check(r.status==='playing','对局已结束');check(this.now()>=r.readyAt,'阶段切换中');
      check(message.command&&typeof message.command==='object','无效指令');
      check(['advance','prop','forge','decline','add','attack','surrender'].includes(message.command.type),'无效指令');
      check(r.state.phase!=='start','回合正在开始');
      const c={...message.command,actor:r.seats.indexOf(u.id)};
      event=this.step(r,c);r.cache[cacheKey]=true;
      const keys=Object.keys(r.cache);if(keys.length>256)delete r.cache[keys[0]];
    } else if(op!=='sync') throw new Error('未知操作');
    this.save();
    ws.send(JSON.stringify({type:'ack',id}));
    if(r)this.broadcast(r,event);else this.emit(u);
  }
  tick() {
    let changed=false;
    for(const r of this.rooms.values()) {
      if(r.status!=='playing')continue;
      const expired=r.seats.map((id,i)=>({u:this.userById(id),i})).filter(({u})=>u&&!this.connected(u.id)&&u.disconnectedAt!==null&&this.now()-u.disconnectedAt>=this.graceMs);
      if(expired.length){this.finish(r,1-expired[0].i,'断线重连超时');this.broadcast(r);changed=true;continue;}
      if(this.now()>=r.deadlineAt) {
        const c=r.state.phase==='start'||r.state.phase==='planning'?{type:'advance',actor:r.state.active,revision:r.state.revision}:chooseCommand(r.state);
        const event=this.step(r,c);this.broadcast(r,event);changed=true;
      }
    }
    for(const [key,u] of this.users) if(!this.connected(u.id)&&this.now()-u.lastSeen>86400000){this.leave(u);this.users.delete(key);changed=true;}
    if(changed)this.save();
  }
}
