import test from "node:test";
import assert from "node:assert/strict";
import { createGame, applyCommand, legalCommands, synthesisOptions } from "../src/engine.js";
import { chooseCommand } from "../src/ai.js";
import { LocalSession } from "../src/session.js";
const run = (s, c) =>
  applyCommand(s, { actor: s.active, revision: s.revision, ...c });
const planning = () => run(createGame(), { type: "advance" });
const action = () => run(planning(), { type: "advance" });

test("initial data and modulo addition modify own hand only, immutably", () => {
  const s = action();
  s.players[0].hands = [7, 1];
  s.players[1].hands = [6, 1];
  const copy = structuredClone(s),
    next = run(s, { type: "add", hand: 0, targetHand: 0 });
  assert.deepEqual(s, copy);
  assert.deepEqual(next.players[0].hands, [3, 1]);
  assert.deepEqual(next.players[1].hands, [6, 1]);
  assert.equal(next.active, 1);
});
test("eight recipes require explicit synthesis and never form during calculation or props", () => {
  for(const [n,weapon] of [[0,"serious"],[2,"scissors"],[4,"fan"],[5,"buddha"],[6,"frag"],[7,"steal"],[8,"dual"],[9,"unify"]]) {
    let s=planning(); s.players[0].hands=[(n+9)%10,n]; s.players[0].props=["add"];
    s=run(s,{type:"prop",slot:0,target:0,targetHand:0});
    assert.equal(s.players[0].weapon,null); assert.deepEqual(s.players[0].hands,[n,n]);
    assert.throws(()=>run(s,{type:"forge",weapon}),/技能选择/);
    s=run(s,{type:"advance"}); assert.equal(s.phase,"synthesis");
    assert.equal(synthesisOptions(s)[0].id,weapon);
    s=run(s,{type:"forge",weapon}); assert.equal(s.phase,"action");
    assert.equal(s.players[0].weapon,weapon); assert.deepEqual(s.players[0].hands,[1,1]);
    assert.throws(()=>run(s,{type:"add",hand:0,targetHand:0}),/不能计算/);
    assert.throws(()=>run(s,{type:"pass"}));
    const a=action(); a.players[0].hands=[(n+9)%10,n];
    const next=run(a,{type:"add",hand:0,targetHand:0});
    assert.equal(next.players[0].weapon,null); assert.deepEqual(next.players[0].hands,[n,n]);
  }
});
test("synthesis checks only the actor, can be declined, and no recipe skips directly to action",()=>{
  let s=planning(); s.players[1].hands=[9,9];
  s=run(s,{type:"advance"}); assert.equal(s.phase,"action"); assert.equal(s.synthesis,"skipped");
  assert.equal(s.players[1].weapon,null);
  s=planning(); s.players[0].hands=[9,9]; s=run(s,{type:"advance"});
  assert.throws(()=>run(s,{type:"forge",weapon:"serious"}));
  s=run(s,{type:"decline"}); assert.equal(s.phase,"start"); assert.equal(s.active,1);
  assert.deepEqual(s.players[0].hands,[9,9]); assert.equal(s.players[0].weapon,null);
});
test("no legal touch automatically ends turn, while locked hands may still synthesize",()=>{
  for(const owner of [0,1]) {
    let s=planning(); s.players[owner].locks=[true,true];
    s=run(s,{type:"advance"}); assert.equal(s.active,1); assert.equal(s.phase,"start");
    assert.ok(s.log.some(x=>x.includes("无合法计算")));
  }
  let s=planning(); s.players[0].hands=[9,9]; s.players[0].locks=[true,true];
  s=run(s,{type:"advance"}); s=run(s,{type:"forge",weapon:"unify"});
  assert.equal(s.phase,"action"); assert.deepEqual(legalCommands(s).map(c=>c.type),["attack"]);
});
test("healing capped, negative wrap, ruin ends match immediately", () => {
  let s = planning();
  s.players[0].props = ["grace", "sub", "ruin"];
  s = run(s, { type: "prop", slot: 0, target: 0 });
  assert.equal(s.players[0].hp, 99);
  s.players[0].hands = [0, 1];
  s = run(s, { type: "prop", slot: 0, target: 0, targetHand: 0 });
  assert.equal(s.players[0].hands[0], 9);
  s.players[1].hp = 2;
  s = run(s, { type: "prop", slot: 0, target: 1 });
  assert.equal(s.winner, 0);
  assert.equal(s.phase, "over");
  assert.throws(() => run(s, { type: "advance" }), /结束/);
});
test("locks block source and target and clear only at owner turn end", () => {
  let s = planning();
  s.players[0].props = ["lock"];
  s = run(s, { type: "prop", slot: 0, target: 1, targetHand: 0 });
  s = run(s, { type: "advance" });
  assert.throws(() => run(s, { type: "add", hand: 0, targetHand: 0 }), /封印/);
  s = run(s, { type: "add", hand: 0, targetHand: 1 });
  assert.equal(s.players[1].locks[0], true);
  s = run(run(s, { type: "advance" }), { type: "advance" });
  assert.throws(() => run(s, { type: "add", hand: 0, targetHand: 0 }), /封印/);
  s = run(s, { type: "add", hand:1, targetHand:0 });
  assert.deepEqual(s.players[1].locks, [false, false]);
});
test("commands reject wrong actor, stale revision, malformed indices, phase and missing items", () => {
  const s = createGame();
  for (const c of [
    { type: "advance", actor: 1 },
    { type: "advance", revision: -1 },
    { type: "attack" },
    { type: "add", hand: 0, targetHand: 0 },
    { type: "prop", slot: -1, target: 0 },
    { type: "prop", slot: 0, target: 2 },
    { type: "bogus" },
  ]) {
    assert.throws(() => run(s, c));
  }
  assert.throws(() => run(action(), { type: "add", hand: 2, targetHand: 0 }));
});
test("draw cadence and inventory capacity survive mandatory action and start phase", () => {
  let s=createGame(10);
  assert.equal(s.phase,"start"); assert.equal(s.players[0].props.length,1);
  while(s.turn<7) {
    const commands=legalCommands(s);
    s=run(s,commands.find(c=>c.type==="advance") || commands.find(c=>c.type==="decline") || commands[0]);
  }
  assert.equal(s.players[0].props.length,2);
});
test("session snapshots isolated, stale duplicate rejected, replay reproduces state, disposal blocks sends", async () => {
  const session = new LocalSession(83);
  const first = session.getSnapshot();
  first.players[0].hp = 0;
  assert.equal(session.getSnapshot().players[0].hp, 99);
  const c = { type: "advance", actor: 0, revision: 0 };
  await session.send(c);
  await assert.rejects(session.send(c));
  for (let i = 0; i < 50 && session.getSnapshot().winner === null; i++)
    await session.send(chooseCommand(session.getSnapshot()));
  const replay = session.exportReplay();
  const restored = replay.commands.reduce(
    applyCommand,
    createGame(replay.seed),
  );
  assert.deepEqual(restored, session.getSnapshot());
  session.dispose();
  await assert.rejects(session.send(c));
});
test("100 complete deterministic AI matches preserve invariants without stalemates", () => {
  let maxTurns = 0;
  for (let seed = 1; seed <= 100; seed++) {
    let s = createGame(seed),
      steps = 0;
    while (s.winner === null && steps++ < 2500) {
      const c = chooseCommand(s);
      assert.ok(
        legalCommands(s).some((x) => JSON.stringify(x) === JSON.stringify(c)),
      );
      s = applyCommand(s, c);
      for (const p of s.players) {
        assert.ok(p.hp >= 0 && p.hp <= 99);
        assert.ok(p.props.length <= 3);
        assert.ok(
          p.hands.every((n) => Number.isInteger(n) && n >= 0 && n <= 9),
        );
      }
    }
    assert.notEqual(
      s.winner,
      null,
      `seed ${seed} stalled after ${s.turn} turns`,
    );
    maxTurns = Math.max(maxTurns, s.turn);
  }
  console.log(`100 AI games completed; longest: ${maxTurns} turns`);
});

import { matchingWeapons } from "../src/catalog.js";
test("recipe matching supports unequal unordered digits and multiple future weapon choices",()=>{
  const catalog=[{id:"a",recipe:[2,7]},{id:"b",recipe:[7,2]},{id:"c",recipe:[2,2]}];
  assert.deepEqual(matchingWeapons([7,2],catalog).map(w=>w.id),["a","b"]);
  assert.deepEqual(matchingWeapons([2,7],catalog).map(w=>w.id),["a","b"]);
  assert.equal(matchingWeapons([7,7],catalog).length,0);
});
test("v1 states cannot silently replay under the new synthesis timing",()=>{
  const s=createGame(); s.rulesVersion=1;
  assert.throws(()=>run(s,{type:"advance"}),/版本/);
});
