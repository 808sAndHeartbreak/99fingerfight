import test from "node:test";
import assert from "node:assert/strict";
import { LocalSession } from "../src/session.js";
import { createGame, applyCommand } from "../src/engine.js";
import { phaseCue, turnSeconds } from "../src/phase-cue.js";
import { normalizeParticipants, escapeHtml } from "../src/identity.js";

test("only turn changes and the final result generate cues",()=>{
 const run=(s,c)=>applyCommand(s,{actor:s.active,revision:s.revision,...c});
 let s=createGame(),n=run(s,{type:'advance'});assert.equal(phaseCue(null,s).kind,'start');assert.equal(phaseCue(s,n),null);
 s=n;s.players[0].hands=[9,9];n=run(s,{type:'forge',weapon:'unify'});assert.equal(phaseCue(s,n),null);assert.equal(turnSeconds(n),30);
 for(const actor of [0,1]){s=createGame();s.active=actor;n=run(s,{type:'surrender'});assert.equal(phaseCue(s,n).owner,1-actor);assert.equal(phaseCue(n,n),null);}
});

test("session identity accepts safe bounded Unicode names without changing rules or replay", () => {
  const source=[{displayName:'  雪⚡<img src=x onerror="x">  '},{displayName:'\u202e'}];
  const session=new LocalSession(42,{participants:source});
  source[0].displayName="changed";
  const participants=session.getParticipants();
  assert.equal(participants[1].displayName,"玩家二");
  assert.ok(participants[0].displayName.startsWith("雪⚡<"));
  assert.ok(!escapeHtml(participants[0].displayName).includes("<"));
  participants[0].displayName="mutated";
  assert.notEqual(session.getParticipants()[0].displayName,"mutated");
  assert.deepEqual(session.getSnapshot(),new LocalSession(42).getSnapshot());
  assert.deepEqual(session.exportReplay(),new LocalSession(42).exportReplay());
  assert.equal(Array.from(normalizeParticipants([{displayName:"😀".repeat(50)}])[0].displayName).length,10);
  assert.match(phaseCue(null,session.getSnapshot(),session.getParticipants()).detail,/雪/);
});
