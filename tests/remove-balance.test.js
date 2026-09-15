import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {PROPS,PROP_IDS} from '../src/catalog.js';
import {LocalSession} from '../src/session.js';
import {MatchHub} from '../server/hub.js';
import {describe} from '../src/info.js';

test('retired balance has no catalog, detail or resource, and version 15 cannot resume',()=>{
 const session=new LocalSession();
 assert.equal(PROP_IDS.length,12);assert.equal(PROPS.balance,undefined);
 assert.equal(describe('prop:balance:0',session.getSnapshot()),null);
 assert.equal(existsSync(new URL('../public/assets/ink-mono/balance.webp',import.meta.url)),false);
 assert.throws(()=>LocalSession.restore({...session.exportSave(),rulesVersion:15}),/不兼容/);
 const hub=new MatchHub({file:null}),ws={send(){},close(){}};
 assert.throws(()=>hub.hello(ws,{protocolVersion:2,rulesVersion:15}),/规则已更新/);
});
