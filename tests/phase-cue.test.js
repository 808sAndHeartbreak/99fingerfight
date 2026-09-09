import test from "node:test";
import assert from "node:assert/strict";
import { LocalSession } from "../src/session.js";
import { createGame, applyCommand } from "../src/engine.js";
import { phaseCue, turnSteps, phaseSeconds } from "../src/phase-cue.js";
import { normalizeParticipants, escapeHtml } from "../src/identity.js";

test("four-stage cues, optional synthesis and terminal cues match authoritative state", () => {
  const run=(s,c)=>applyCommand(s,{actor:s.active,revision:s.revision,...c});
  let s=createGame(); assert.equal(phaseCue(null,s).kind,"start");
  let next=run(s,{type:"advance"}); assert.equal(phaseCue(s,next).kind,"planning");
  s=next; next=run(s,{type:"advance"}); assert.equal(phaseCue(s,next).kind,"action");
  assert.equal(turnSteps(next)[2].note,"无组合 · 略过");
  assert.equal(phaseCue(next,next),null);
  s=run(createGame(),{type:"advance"}); s.players[0].hands=[9,9];
  next=run(s,{type:"advance"}); assert.equal(phaseCue(s,next).kind,"synthesis");
  s=next; next=run(s,{type:"forge",weapon:"unify"}); assert.equal(phaseCue(s,next).kind,"action");
  assert.equal(phaseSeconds(next),10); assert.equal(turnSteps(next)[3].note,"攻击");
  for(const actor of [0,1]) {
    s=createGame(); s.active=actor; next=run(s,{type:"surrender"});
    assert.equal(phaseCue(s,next).owner,1-actor); assert.equal(phaseCue(next,next),null);
  }
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
  assert.equal(Array.from(normalizeParticipants([{displayName:"😀".repeat(50)}])[0].displayName).length,24);
  assert.match(phaseCue(null,session.getSnapshot(),session.getParticipants()).detail,/雪/);
});
