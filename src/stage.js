import { calculationOutcome } from "./engine.js";
import { propContactNumber } from "./guidance.js";
import * as THREE from "three";
import { createHand } from "./hand-model.js";
import {
  TOUCH_DURATION_MS,
  CONTACT_AT,
  RELEASE_AT,
  closeupProgress,
  touchProgress,
} from "./motion.js";

import { createInkStage, contactPosition } from "./ink-stage.js";

const COLORS = [0x2156d9, 0xe33b2e];
export class DuelStage {
  constructor(host, onProject) {
    this.host = host;
    this.onProject = onProject;
    this.hands = [];
    this.time = 0;
    this.paused = false;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)");
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80);
    this.camera.position.set(0, 0, 15);
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.canvas = this.renderer.domElement;
    this.canvas.setAttribute("aria-hidden", "true");
    host.prepend(this.canvas);
    this.contextLost = (e) => {
      e.preventDefault();
      this.failed = true;
      if (this.animation) {
        if (!this.animation.contact) this.animation.onContact();
        this.animation.resolve(true);
        this.animation = null;
      }
      this.cancel();
      host.classList.add("webgl-fallback");
      host.dataset.renderer = "fallback";
      host.querySelectorAll(".hand-hotspot").forEach((el) => {
        el.style.removeProperty("left");
        el.style.removeProperty("top");
        el.style.removeProperty("--hand-scale");
      });
      document.querySelector("#render-status").textContent = "兼容模式";
    };
    this.canvas.addEventListener("webglcontextlost", this.contextLost);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.85));
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(-3, 5, 8);
    this.scene.add(key);
    this.makeEnvironment();
    for (let owner = 0; owner < 2; owner++)
      for (let hand = 0; hand < 2; hand++) {
        const model = createHand(COLORS[owner], hand === 1);
        const base = new THREE.Vector3(
          owner ? 3.0 : -3.0,
          (owner === 0 ? hand : 1-hand) ? -1.65 : 1.5,
          0,
        );
        model.root.position.copy(base);
        model.root.rotation.set(
          0.1,
          owner ? -0.28 : 0.28,
          owner ? 1.17 : -1.17,
        );
        const shieldShape = new THREE.Shape();
        shieldShape.moveTo(0, 1.3);
        shieldShape.quadraticCurveTo(.7, 1.1, 1.1, .9);
        shieldShape.lineTo(1, -.3);
        shieldShape.quadraticCurveTo(.7, -1, 0, -1.35);
        shieldShape.quadraticCurveTo(-.7, -1, -1, -.3);
        shieldShape.lineTo(-1.1, .9);
        shieldShape.quadraticCurveTo(-.7, 1.1, 0, 1.3);
        const shield = new THREE.Mesh(
          new THREE.ShapeGeometry(shieldShape),
          new THREE.MeshBasicMaterial({color:COLORS[owner], transparent:true, opacity:.12, depthWrite:false, side:THREE.DoubleSide}),
        );
        const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(shieldShape.getPoints(32)),
          new THREE.LineBasicMaterial({color:COLORS[owner], transparent:true, opacity:.45, depthWrite:false}));
        shield.add(outline);
        shield.position.copy(base);
        this.scene.add(shield);
        shield.visible = false;
        this.scene.add(model.root);
        this.hands.push({ ...model, owner, hand, base, shield });
      }
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.resize();
    this.last = performance.now();
    this.frame = this.frame.bind(this);
    this.raf = requestAnimationFrame(this.frame);
    host.dataset.renderer = "webgl";
  }
  makeEnvironment() {
    this.ink = createInkStage();
    this.scene.add(this.ink.mesh);
  }
  resize() {
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    this.mobile = width < 850;
    this.renderer.setSize(width, height);
    this.ink.uniforms.uAspect.value = width / height;
    this.camera.aspect = width / height;
    this.camera.position.z = this.mobile ? 9.2 : 10.2;
    this.camera.fov = this.mobile ? 42 : 34;
    this.camera.updateProjectionMatrix();
    const viewHeight = 2 * this.camera.position.z * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const viewWidth = viewHeight * this.camera.aspect;
    this.hands.forEach((h) => {
      h.base.set(
        (h.owner ? 1 : -1) * viewWidth * .21,
        ((h.owner === 0 ? h.hand : 1-h.hand) ? -1 : 1) * viewHeight * (width<650?.32:.24),
        0,
      );
      h.restScale = Math.min(1.15, viewWidth / 13.5, viewHeight / 5.5);
      if (!this.animation) h.root.scale.setScalar(h.restScale);
      if (!this.animation) h.root.position.copy(h.base);
    });
  }
  sync(state, selected, enabled = true, presenting = false) {
    this.state = state;this.presenting=presenting;
    this.selection = selected;
    this.hands.forEach((h) => {
      const p = state.players[h.owner];
      h.setNumber(p.hands[h.hand]);
      const chosen=selected?.kind==='hand' && selected.hand===h.hand && state.active===h.owner;
      h.setSelected(chosen);
      h.trim.emissiveIntensity=p.locks[h.hand]?0:chosen?.2:0;
      h.shield.visible = p.hands[h.hand] === 5;
    });
  }
  setPaused(value) {
    this.paused = value;
  }
  animate(command, old, next, onContact) {
    this.cancel();
    if (!["add", "attack", "prop"].includes(command.type))
      return Promise.resolve(true);
    if (this.failed) {
      onContact();
      return Promise.resolve(true);
    }
    const dueling = command.type === "add";
    this.host.dataset.dueling = String(dueling);
    this.host.dataset.actor = String(command.actor);
    this.ink.uniforms.uTeam.value = command.actor;
    this.hands.forEach((h) => {
      const role =
        dueling && h.owner === command.actor && h.hand === command.hand
          ? "source"
          : dueling &&
              h.owner !== command.actor &&
              h.hand === command.targetHand
            ? "target"
            : "idle";
      h.role = role;
      this.host.querySelector(`#hand-${h.owner}-${h.hand}`).dataset.duelRole =
        role;
    });
    return new Promise((resolve) => {
      this.animation = {
        command,
        old,
        next,
        onContact,
        resolve,
        elapsed: 0,
        contact: false,
        anchors: this.hands.map((h) => h.contactPoint()),
        duration: this.reduced.matches
          ? 0.25
          : command.type === "add"
            ? TOUCH_DURATION_MS / 1000
            : 1.25,
      };
      this.host.dataset.motion = "approach";
    });
  }
  cancel() {
    this.skillFx=null;this.hits=[0,0];
    if(this.ink?.uniforms.uPulse)this.ink.uniforms.uPulse.value=0;
    if (this.animation) {
      this.animation.resolve(false);
      this.animation = null;
    }
    this.hands.forEach((h) => {
      h.root.position.copy(h.base);
      h.root.rotation.set(0.1, h.owner ? -0.28 : 0.28, h.owner ? 1.17 : -1.17);
      h.root.scale.setScalar(h.restScale || 1);
      h.root.visible = true;
    });
    this.camera.position.x = 0;
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.ink.uniforms.uFocus.value = 0;
    this.ink.uniforms.uImpact.value = 0;
    this.host.dataset.dueling = "false";
    this.host.dataset.motion = "idle";
  }
  updateAnimation(dt) {
    const a = this.animation;
    if (!a) return;
    a.elapsed += dt;
    // Even on a slow frame, present the actual contact before recovering.
    if (!a.contact && a.elapsed > a.duration * CONTACT_AT)
      a.elapsed = a.duration * CONTACT_AT;
    const t = Math.min(1, a.elapsed / a.duration),
      c = a.command;
    let contact = new THREE.Vector3(0, 0, 1);
    if (c.type === "add") {
      const from = this.hands[c.actor * 2 + c.hand],
        to = this.hands[(1 - c.actor) * 2 + c.targetHand];
      // A dedicated two-hand close-up: the contact is always central.
      contact.set(0, 0.18, 0.8);
      const progress = touchProgress(t),
        focus = closeupProgress(t);
      this.camera.zoom = 1 + (this.reduced.matches ? 0 : 0.12 * focus);
      this.camera.updateProjectionMatrix();
      const viewWidth =
        (2 *
          (this.camera.position.z - 0.8) *
          Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) *
          this.camera.aspect) /
        this.camera.zoom;
      const heroScale = Math.min(this.mobile ? 1.5 : 2.1, viewWidth / 7.2);
      this.hands.forEach((h) => {
        h.root.visible = h.role !== "idle" || focus < 0.1;

        h.shield.visible =
          focus < 0.1 && this.state.players[h.owner].hands[h.hand] === 5;
      });
      for (const h of [from, to]) {
        const index = h.owner * 2 + h.hand;
        const scale = THREE.MathUtils.lerp(h.restScale, heroScale, focus);
        h.root.scale.setScalar(scale);
        const finalRotation = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            0.1,
            h.owner ? -0.12 : 0.12,
            h.owner ? Math.PI / 2 : -Math.PI / 2,
          ),
        );
        const end = contactPosition(
          a.anchors[index],
          scale,
          finalRotation,
          contact,
        );
        h.root.position.lerpVectors(
          h.base,
          end,
          h === from ? progress : Math.max(0, progress),
        );
        h.root.rotation.set(
          0.1,
          THREE.MathUtils.lerp(
            h.owner ? -0.28 : 0.28,
            h.owner ? -0.12 : 0.12,
            Math.max(0, progress),
          ),
          THREE.MathUtils.lerp(
            h.owner ? 1.17 : -1.17,
            h.owner ? Math.PI / 2 : -Math.PI / 2,
            Math.max(0, progress),
          ),
        );
        // Only the initiating hand has an overhand arc and anticipation.
        if (h === from)
          h.root.position.z += Math.sin(Math.PI * Math.max(0, progress)) * 0.85;
      }
      this.ink.uniforms.uFocus.value = this.reduced.matches ? 0 : focus;
    } else if (c.type === "attack") {
      const from = this.hands[c.actor * 2];
      const amount = touchProgress(t);
      from.root.position.x = from.base.x + (c.actor ? -1 : 1) * amount * 1.5;
      contact.set(c.actor ? -1.5 : 1.5, 0, 1);
    } else {
      const target = this.hands[c.target * 2 + (c.targetHand ?? 0)];
      contact.copy(target.base);
      contact.z = 1;
    }
    if (t >= CONTACT_AT && !a.contact) {
      a.contact = true;
      this.host.dataset.motion = "contact";
      if (c.type === "add")
        for(const write of (c.visualWrites || calculationOutcome(a.old,c).writes))this.hands[write.owner*2+write.hand].setNumber(write.value);
      if (c.type === "prop" && c.targetHand !== undefined)
        this.hands[c.target * 2 + c.targetHand].setNumber(
          propContactNumber(a.old, c),
        );

      const projected = contact.clone().project(this.camera);
      this.host.style.setProperty(
        "--impact-x",
        `${(projected.x * 0.5 + 0.5) * this.width}px`,
      );
      this.host.style.setProperty(
        "--impact-y",
        `${(-projected.y * 0.5 + 0.5) * this.height}px`,
      );
      a.onContact();
    }
    const shock = a.contact
      ? Math.min(1, (t - CONTACT_AT) / (1 - CONTACT_AT))
      : 0;
    const impact = a.contact ? Math.pow(1 - shock, 3) : 0;
    const projected = contact.clone().project(this.camera);
    this.ink.uniforms.uCenter.value.set(
      projected.x * 0.5 + 0.5,
      projected.y * 0.5 + 0.5,
    );
    this.ink.uniforms.uImpact.value = this.reduced.matches ? 0 : impact;
    if (c.type !== "add")
      this.ink.uniforms.uFocus.value = this.reduced.matches
        ? 0
        : closeupProgress(t) * 0.72;
    if (!this.reduced.matches && a.contact)
      this.camera.position.x = Math.sin(shock * 55) * 0.08 * impact;
    if (t > RELEASE_AT) this.host.dataset.motion = "recover";
    if (t === 1) {
      this.animation = null;
      this.cancel();
      a.resolve(true);
    }
  }
  hit(owner,amount) {
    this.hits??=[0,0];this.hits[owner]=amount>0?.85:.4;
  }
  skillImpact(kind,owner) {
    if(this.failed||this.reduced.matches)return;
    this.skillFx={left:.65};
    this.ink.uniforms.uSkill.value=['slash','snipe'].includes(kind)?2:kind==='bolt'?3:['curse','dragon','burst'].includes(kind)?4:1;
    this.ink.uniforms.uTeam.value=owner;
    this.ink.uniforms.uCenter.value.set(owner ? .72 : .28,.48);
    this.ink.uniforms.uPulse.value=1;
  }
  frame(now) {
    this.raf = requestAnimationFrame(this.frame);
    const elapsed = Math.max(0, (now - this.last) / 1000);
    const dt = Math.min(0.05, elapsed);
    this.last = now;
    if (this.failed || document.hidden) return;
    if (!this.paused) {
      this.time += dt;
      this.updateAnimation(elapsed);
      if(this.skillFx && !this.reduced.matches) {
        this.skillFx.left=Math.max(0,this.skillFx.left-dt);
        this.ink.uniforms.uPulse.value=this.skillFx.left/.65;
        if(!this.skillFx.left)this.skillFx=null;
      }
      if(this.hits)this.hits=this.hits.map(t=>Math.max(0,t-dt));
      this.hands.forEach((h, i) => {
        h.update(dt);
        if (!this.animation) {
          h.root.position.copy(h.base);
          if (!this.reduced.matches) {
            const active=!this.presenting && this.state?.active===h.owner && this.state?.phase==='action' && !this.state?.players[h.owner].weapon;
            h.root.position.y += active?Math.sin(this.time * .95 + i*.3)*.075:0;
            const hit=this.hits?.[h.owner]||0;
            h.root.position.x+=(h.owner?1:-1)*Math.sin(Math.min(1,hit/.85)*Math.PI)*.65;
            h.root.position.y+=Math.sin(hit*55)*hit*.1;
            h.root.rotation.y =
              (h.owner ? -0.28 : 0.28) + Math.sin(this.time * .35 + i) * .025;
          }
        }
        h.shield.position.copy(h.root.position);
        h.shield.position.z = -.45;
        h.shield.scale.setScalar(h.restScale * (this.reduced.matches ? 1 : 1 + Math.sin(this.time * 1.5) * .015));
      });
      if (!this.reduced.matches) {
        this.ink.uniforms.uTime.value = this.time;
      }
    }
    this.hands.forEach((h) => {
      const p = h.root.position
        .clone()
        .project(this.camera);
      this.onProject(
        h.owner,
        h.hand,
        (p.x * 0.5 + 0.5) * this.width,
        (-p.y * 0.5 + 0.5) * this.height,
        this.mobile ? 0.83 : 1,
      );
    });
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.cancel();
    cancelAnimationFrame(this.raf);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("webglcontextlost", this.contextLost);
    const geometries = new Set(),
      materials = new Set();
    this.scene.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material)
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
          materials.add(m),
        );
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    this.hands.forEach((h) => h.gradient.dispose());
    this.renderer.dispose();
    this.canvas.remove();
  }
}
