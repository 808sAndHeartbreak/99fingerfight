import test from "node:test";
import assert from "node:assert/strict";
import { createGame, applyCommand } from "../src/engine.js";
import { guidance, handPreview } from "../src/guidance.js";

test("hand target previews agree with the authoritative reducer, including rollover and forging", () => {
  for (const actor of [0, 1])
    for (let a = 0; a < 10; a++)
      for (let b = 0; b < 10; b++) {
        const s = createGame();
        s.phase = "action";
        s.active = actor;
        s.players[actor].hands = [a, 5];
        s.players[1 - actor].hands = [b, 2];
        const preview = handPreview(s, { kind: "hand", hand: 0 }, 1 - actor, 0);
        const next = applyCommand(s, {
          type: "add",
          actor,
          revision: s.revision,
          hand: 0,
          targetHand: 0,
        });
        assert.equal(next.players[actor].weapon,null);
        assert.equal(next.players[actor].hands[0], preview.number);
        if(preview.weapon) assert.match(preview.note,/下回合/);
        assert.equal(next.players[1 - actor].hands[0], b);
        assert.equal(handPreview(s, { kind: "hand", hand: 0 }, actor, 0), null);
      }
});
test("item previews respect modulo, shield, locked targets and weapon priority", () => {
  const s = createGame();
  s.players[0].props = ["add", "sub", "lock"];
  s.players[1].hands = [9, 0];
  assert.equal(handPreview(s, { kind: "prop", slot: 0 }, 1, 0).weapon, "serious");
  s.players[1].hands = [0, 2];
  assert.equal(handPreview(s, { kind: "prop", slot: 1 }, 1, 0).number, 9);
  s.players[1].hands = [4, 1];
  s.players[1].locks[0] = true;
  assert.equal(
    handPreview(s, { kind: "prop", slot: 0 }, 1, 0).note,
    "获得护盾",
  );
  assert.equal(
    handPreview(s, { kind: "prop", slot: 2 }, 1, 0).text,
    "已被封印",
  );
  assert.equal(handPreview(s, { kind: "hand", hand: 0 }, 1, 0), null);
});
test("guidance distinguishes optional preparation, legal targets, blocked turns and waiting", () => {
  const s = createGame();
  assert.equal(guidance(s, null, true, false).step, "start");
  s.phase = "action";
  assert.equal(guidance(s, null, true, false).step, "source");
  assert.equal(
    guidance(s, { kind: "hand", hand: 0 }, true, false).step,
    "target",
  );
  s.players[1].locks = [true, true];
  assert.equal(guidance(s, null, true, false).step, "blocked");
  assert.equal(guidance(s, null, false, false).step, "waiting");
  assert.equal(guidance(s, null, true, true).step, "resolving");
  s.players[0].props = ["grace"];
  s.phase = "planning";
  assert.equal(
    guidance(s, { kind: "prop", slot: 0 }, true, false).title,
    "确认使用「恩惠」",
  );
});

import { comboRoutes, forgeEvents } from "../src/guidance.js";
test("combination routes expose only legal immediate touch targets", () => {
  const s = createGame(); s.phase = "action";
  s.players[0].hands = [4,5]; s.players[1].hands = [1,1];
  assert.equal(comboRoutes(s,0,0).find(r=>r.weapon.id === "buddha").ready,true);
  s.players[1].locks = [true,true];
  assert.equal(comboRoutes(s,0,0).some(r=>r.ready),false);
  s.players[1].locks = [false,false]; s.phase = "planning";
  assert.equal(comboRoutes(s,0,0).some(r=>r.ready),false);
});
test("forge visual events occur only on explicit synthesis command", () => {
  let s=createGame(); s.phase="planning"; s.players[0].hands=[4,5]; s.players[0].props=["add"];
  const c={type:"prop",actor:0,revision:s.revision,slot:0,target:0,targetHand:0};
  let next=applyCommand(s,c); assert.deepEqual(forgeEvents(s,next,c),[]);
  s=applyCommand(next,{type:"advance",actor:0,revision:next.revision});
  const f={type:"forge",actor:0,revision:s.revision,weapon:"buddha"};
  next=applyCommand(s,f); assert.equal(forgeEvents(s,next,f)[0].weapon.id,"buddha");
});

import { propContactNumber } from "../src/guidance.js";
test("item contact shows pre-forge pair before hands reset", () => {
  const s=createGame(); s.phase="planning"; s.players[0].props=["add"]; s.players[0].hands=[4,5];
  const c={type:"prop",actor:0,revision:s.revision,slot:0,target:0,targetHand:0};
  const next=applyCommand(s,c);
  assert.equal(propContactNumber(s,c),5);
  assert.deepEqual(next.players[0].hands,[5,5]);
});

test('planning guidance follows actual synthesis eligibility and respects silence and opponent turns',()=>{
 const s=createGame();s.phase='planning';s.players[0].props=['add'];
 s.players[0].hands=[1,2];assert.match(guidance(s,null,true,false).detail,/触碰计算/);
 s.players[0].hands=[2,2];assert.match(guidance(s,null,true,false).detail,/选择合成技能/);
 s.players[0].silenced=true;assert.match(guidance(s,null,true,false).title,/沉默/);
 assert.equal(guidance(s,null,false,false).title,'对手正在规划');
 assert.equal(guidance(s,null,false,false).detail,'');
});
