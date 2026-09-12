import test from 'node:test';
import assert from 'node:assert/strict';
import { onlineMarkup } from '../src/online.js';
import { menuMarkup } from '../src/menu.js';
globalThis.location={href:'https://example.test/'};
const net=()=>({status:'connected',packet:{profile:{displayName:'玩家一'},queued:false}});
test('online lobby escapes untrusted names, room input and server messages',()=>{
 const n=net();n.packet.profile.displayName='<img src=x onerror=alert(1)>';n.error='<script>alert(1)</script>';n.view='join';n.joinCode='\" autofocus onfocus=alert(1)';
 const html=onlineMarkup(n);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<img src=x'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&quot; autofocus'));
});
test('departed opponents cannot be invited into a rematch; pending lobby actions lock controls',()=>{
 const n=net();n.packet.room={code:'ABCDEF',status:'finished',seat:0,participants:[{seat:0,displayName:'一',connected:true},{seat:1,displayName:'二',connected:false,departed:true}],ready:[false,false],rematch:[false,false]};
 assert.match(onlineMarkup(n),/id="online-rematch"[^>]*disabled/);
 n.packet.room=null;n.busy=true;assert.match(onlineMarkup(n),/id="online-queue"[^>]*disabled/);
 n.packet.queued=true;assert.ok(!onlineMarkup(n).includes('data-close'));
});
test('initial menus do not expose a resume action before the player starts',()=>{
 for(const page of ['home','play','local'])assert.ok(!menuMarkup(page).includes('data-close'));
 assert.ok(!menuMarkup('home',{started:true}).includes('data-close'));assert.ok(menuMarkup('local',{resumable:true}).includes('data-resume-pve'));
});

test('nickname draft survives server profile refresh including an intentionally empty field',()=>{
 const n=net();n.nameDraft='未保存的名字';assert.match(onlineMarkup(n),/value="未保存的名字"/);
 n.packet.profile.displayName='服务器旧名字';assert.match(onlineMarkup(n),/value="未保存的名字"/);
 n.nameDraft='';assert.match(onlineMarkup(n),/name="name" maxlength="200" value=""/);
});
import {OnlineClient} from '../src/online.js';

test('nickname persistence follows successful acknowledgement, preserves newer drafts, and normalizes accepted input',async()=>{
 const saved=globalThis.window,stored=new Map();globalThis.window={localStorage:{setItem:(k,v)=>stored.set(k,v)}};
 try {
  const client=new OnlineClient();client.nameDraft='失败草稿';client.request=async()=>{throw Error('offline');};
  await assert.rejects(client.rename('失败草稿'));assert.equal(stored.has('ff-name'),false);assert.equal(client.nameDraft,'失败草稿');
  client.request=async()=>{};client.nameDraft='  星火⚡  ';await client.rename('  星火⚡  ');assert.equal(stored.get('ff-name'),'星火⚡');assert.equal(client.nameDraft,null);
  client.nameDraft='更新的草稿';await client.rename('先前已提交');assert.equal(client.nameDraft,'更新的草稿');
 } finally {globalThis.window=saved;}
});


test('entry saves a pending name before matchmaking and leaves newer edits intact',async()=>{
 const {OnlineClient}=await import('../src/online.js');
 const c=new OnlineClient();const calls=[];c.nameDraft='阿青';c.request=async(op,fields)=>calls.push([op,fields]);
 await c.saveDraft();await c.request('queue');
 assert.equal(calls[0][0],'name');assert.equal(calls[0][1].name,'阿青');assert.equal(calls[1][0],'queue');assert.equal(c.nameDraft,null);
});

test('closing a client cancels pending work and ignores callbacks from the old socket',async()=>{
 const previous={window:globalThis.window,location:globalThis.location,WebSocket:globalThis.WebSocket};
 class FakeSocket{static OPEN=1;readyState=1;send(){}close(){this.readyState=3;}}
 globalThis.window={sessionStorage:{getItem:()=>null}};globalThis.location={href:'http://localhost/',protocol:'http:'};globalThis.WebSocket=FakeSocket;
 try{const client=new OnlineClient(()=>{},()=>{});client.connect();const old=client.socket;client.status='connected';
 const pending=client.request('create');const rejected=assert.rejects(pending,/已关闭/);client.close();await rejected;
 assert.equal(client.pending.size,0);assert.equal(client.status,'offline');old.onclose({code:1000});old.onmessage({data:JSON.stringify({type:'welcome',token:'late'})});
 assert.equal(client.status,'offline');assert.equal(client.socket,null);assert.equal(client.timer,undefined);
 }finally{Object.assign(globalThis,previous);}
});
