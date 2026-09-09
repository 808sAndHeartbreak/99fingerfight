import test from "node:test";
import assert from "node:assert/strict";
import {
  touchProgress,
  CONTACT_AT,
  RELEASE_AT,
  closeupProgress,
  touchResult,
} from "../src/motion.js";
import { createHand } from "../src/hand-model.js";
import { contactPosition, createInkStage } from "../src/ink-stage.js";
import { DuelStage } from "../src/stage.js";
import * as THREE from "three";
import { createGame } from "../src/engine.js";
import { describe } from "../src/info.js";
import { WEAPONS, PROPS } from "../src/catalog.js";

test("touch sequence approaches contact once and returns to rest", () => {
  assert.equal(touchProgress(0), 0);
  assert.ok(
    touchProgress(0.08) < 0,
    "short anticipation moves away before approach",
  );
  assert.equal(touchProgress(CONTACT_AT), 1);
  assert.equal(touchProgress(0.63), 1);
  assert.equal(touchProgress(RELEASE_AT), 1);
  assert.equal(closeupProgress(CONTACT_AT), 1);
  assert.equal(closeupProgress(0), 0);
  assert.equal(closeupProgress(1), 0);
  assert.equal(touchProgress(1), 0);
  let previous = 0;
  for (let t = 0.16; t < CONTACT_AT; t += 0.01) {
    assert.ok(touchProgress(t) >= previous);
    previous = touchProgress(t);
  }
});

test("all posed fingertips meet the same world point at both team orientations and responsive scales", () => {
  const target = new THREE.Vector3(0, 0.18, 0.8);
  for (const mirrored of [false, true]) {
    const hand = createHand(0x2156d9, mirrored);
    for (let number = 0; number < 10; number++) {
      hand.setNumber(number, true);
      for (const owner of [0, 1])
        for (const scale of [0.85, 1.1, 2.1]) {
          hand.root.scale.setScalar(scale);
          hand.root.rotation.set(
            0.1,
            owner ? -0.12 : 0.12,
            owner ? Math.PI / 2 : -Math.PI / 2,
          );
          const anchor = hand.contactPoint();
          hand.root.position.copy(
            contactPosition(anchor, scale, hand.root.quaternion, target),
          );
          hand.root.updateMatrixWorld(true);
          const actual = hand.root.localToWorld(hand.contactPoint());
          assert.ok(
            actual.distanceTo(target) < 1e-7,
            `${mirrored}/${number}/${owner}/${scale}`,
          );
        }
    }
    hand.root.traverse((o) => {
      o.geometry?.dispose();
    });
    hand.gradient.dispose();
  }
});
test("contact display uses initiating hand, including rollover, without touching rule state", () => {
  const s = createGame();
  s.players[0].hands = [7, 1];
  s.players[1].hands = [6, 2];
  assert.equal(touchResult(s, { actor: 0, hand: 0, targetHand: 0 }), 3);
  assert.equal(touchResult(s, { actor: 1, hand: 1, targetHand: 0 }), 9);
  assert.deepEqual(s.players[0].hands, [7, 1]);
  assert.deepEqual(s.players[1].hands, [6, 2]);
});

test("a stalled animation frame still presents contact once; completion and cancellation restore the arena", async () => {
  const stage = Object.create(DuelStage.prototype);
  stage.host = {
    dataset: {},
    style: { setProperty() {} },
    querySelector() {
      return { dataset: {} };
    },
  };
  stage.ink = createInkStage();
  stage.camera = new THREE.PerspectiveCamera(34, 2, 0.1, 80);
  stage.camera.position.z = 10.2;
  stage.width = 1000;
  stage.height = 500;
  stage.mobile = false;
  stage.reduced = { matches: false };
  stage.state = createGame();
  stage.hands = [0, 1, 2, 3].map((i) => ({
    ...createHand(0x2156d9, i % 2 === 1),
    owner: Math.floor(i / 2),
    hand: i % 2,
    restScale: 1.35,
    base: new THREE.Vector3(i < 2 ? -4 : 4, i % 2 ? -1.6 : 1.5, 0),
    halo: new THREE.Object3D(),
    shield: new THREE.Object3D(),
  }));
  let contacts = 0;
  const finished = stage.animate(
    { type: "add", actor: 0, hand: 0, targetHand: 1 },
    stage.state,
    stage.state,
    () => contacts++,
  );
  stage.updateAnimation(20);
  assert.equal(contacts, 1);
  assert.equal(stage.host.dataset.motion, "contact");
  assert.equal(stage.hands.filter((h) => h.root.visible).length, 2);
  stage.updateAnimation(20);
  assert.equal(await finished, true);
  assert.equal(contacts, 1);
  assert.equal(stage.camera.zoom, 1);
  assert.equal(stage.host.dataset.dueling, "false");
  assert.equal(stage.hands.filter((h) => h.root.visible).length, 4);
  const cancelled = stage.animate(
    { type: "add", actor: 1, hand: 1, targetHand: 0 },
    stage.state,
    stage.state,
    () => contacts++,
  );
  stage.updateAnimation(0.2);
  stage.cancel();
  assert.equal(await cancelled, false);
  assert.equal(contacts, 1);
  assert.equal(stage.ink.uniforms.uFocus.value, 0);
  for (const h of stage.hands) assert.ok(h.root.position.equals(h.base));
});
test("every weapon, item and game status has complete inspectable details", () => {
  const s = createGame();
  for (const key of [
    ...WEAPONS.map((w) => `weapon:${w.id}`),
    ...Object.keys(PROPS).map((p) => `prop:${p}`),
    "shield",
    "phase",
    "hand:0:0",
    "hand:1:1",
    "player:0",
    "player:1",
  ]) {
    const d = describe(key, s);
    assert.ok(d.title && d.body && d.note, key);
    assert.equal(d.stats.length, 2);
  }
  s.players[0].locks[0] = true;
  assert.equal(describe("hand:0:0", s).stats[1][1], "已封印");
  s.players[0].hands[0] = 5;
  s.players[0].locks[0] = false;
  assert.equal(describe("hand:0:0", s).stats[1][1], "护盾生效");
});
