import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
const rounded = (x, y, z, r = 0.12) => new RoundedBoxGeometry(x, y, z, 3, r);
/** Articulated cel-shaded manga hand with independent finger joints. */
export function createHand(color, mirrored = false) {
  const root = new THREE.Group(),
    model = new THREE.Group();
  root.add(model);
  model.scale.x = mirrored ? -1 : 1;
  const gradient = new THREE.DataTexture(
    new Uint8Array([80, 80, 80, 255, 175, 175, 175, 255, 255, 255, 255, 255]),
    3,
    1,
    THREE.RGBAFormat,
  );
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  const skin = new THREE.MeshToonMaterial({
    color: 0xf1dfbe,
    gradientMap: gradient,
  });
  const shade = new THREE.MeshToonMaterial({
    color: 0xe7b284,
    gradientMap: gradient,
  });
  const cloth = new THREE.MeshToonMaterial({
    color: 0xf4edda,
    gradientMap: gradient,
  });
  const trim = new THREE.MeshToonMaterial({
    color,
    gradientMap: gradient,
    emissive: color,
    emissiveIntensity: 0,
  });
  const ink = new THREE.MeshBasicMaterial({
    color: 0x111827,
    side: THREE.BackSide,
  });
  function piece(geometry, material, position, parent = model, outline = true) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    parent.add(mesh);
    if (outline) {
      const edge = new THREE.Mesh(geometry, ink);
      edge.scale.setScalar(1.055);
      mesh.add(edge);
    }
    return mesh;
  }
  piece(rounded(1.08, 1.15, 0.53, 0.22), skin, [0, 0, 0]);
  piece(rounded(0.74, 0.58, 0.5, 0.15), skin, [0, -0.74, 0]);
  piece(rounded(0.95, 0.44, 0.66, 0.08), trim, [0, -1.13, 0]);
  piece(rounded(0.98, 0.075, 0.69, 0.025), cloth, [0, -1, 0]);
  piece(rounded(0.77, 0.53, 0.53, 0.1), cloth, [0, -1.53, 0]);
  const seam = new THREE.MeshBasicMaterial({ color: 0x182034 });
  for (let i = 0; i < 3; i++)
    piece(
      rounded(0.11, 0.025, 0.025, 0.005),
      seam,
      [-0.21 + i * 0.21, -0.32, 0.283],
      model,
      false,
    );
  const fingers = [],
    lengths = [0.71, 0.83, 0.77, 0.59];
  for (let i = 0; i < 4; i++) {
    const pivot = new THREE.Group();
    pivot.position.set(-0.405 + i * 0.27, 0.43, 0.015);
    model.add(pivot);
    const length = lengths[i];
    piece(
      new THREE.SphereGeometry(0.138, 12, 8),
      shade,
      [0, 0.045, 0],
      pivot,
      false,
    );
    piece(
      rounded(0.244, length * 0.62, 0.29, 0.105),
      skin,
      [0, length * 0.31 + 0.055, 0.025],
      pivot,
    );
    const joint = new THREE.Group();
    joint.position.y = length * 0.62 + 0.025;
    pivot.add(joint);
    piece(
      new THREE.SphereGeometry(0.12, 12, 8),
      skin,
      [0, 0, 0.02],
      joint,
      false,
    );
    piece(
      rounded(0.229, length * 0.62, 0.28, 0.11),
      skin,
      [0, length * 0.31 + 0.01, 0.015],
      joint,
    );
    piece(
      rounded(0.12, 0.14, 0.016, 0.035),
      cloth,
      [0, length * 0.48, 0.159],
      joint,
      false,
    );
    piece(
      rounded(0.13, 0.016, 0.014, 0.005),
      seam,
      [0, 0.065, 0.163],
      joint,
      false,
    );
    fingers.push({ pivot, joint });
  }
  const thumb = new THREE.Group();
  thumb.position.set(-0.52, -0.28, 0.01);
  thumb.rotation.z = 0.7;
  model.add(thumb);
  piece(rounded(0.38, 0.56, 0.39, 0.15), skin, [0, 0.22, 0.05], thumb);
  const tip = new THREE.Group();
  tip.position.y = 0.46;
  thumb.add(tip);
  piece(rounded(0.32, 0.46, 0.34, 0.135), skin, [0, 0.2, 0.06], tip);
  piece(rounded(0.17, 0.16, 0.018, 0.045), cloth, [0, 0.28, 0.24], tip, false);
  const poses = [
    [],
    [0],
    [0, 1],
    [0, 1, 2],
    [0, 1, 2, 3],
    [0, 1, 2, 3],
    [3],
    [0, 1],
    [0],
    [0],
  ];
  let number = 1,
    thumbTarget = 1;
  const targets = fingers.map(() => 0);
  function setNumber(n, immediate = false) {
    number = n;
    fingers.forEach((f, i) => {
      targets[i] = poses[n].includes(i) ? 0 : 1.65;
      if (immediate) {
        f.pivot.rotation.x = targets[i];
        f.joint.rotation.x = targets[i] ? 1.35 : n === 9 && i === 0 ? 1.55 : 0.07;
      }
    });
    thumbTarget = [5, 6, 7, 8].includes(n) ? 0.12 : 1.12;
    if (immediate) {
      thumb.rotation.x = thumbTarget;
      thumb.rotation.z = thumbTarget > 1 ? -0.8 : 0.7;
    }
  }
  setNumber(1, true);
  return {
    root,
    model,
    trim,
    setNumber,
    gradient,
    contactPoint() {
      root.updateMatrixWorld(true);
      const i = poses[number][0];
      const point =
        i === undefined
          ? model.localToWorld(new THREE.Vector3(0, 0.6, 0.18))
          : fingers[i].joint.localToWorld(
              new THREE.Vector3(0, lengths[i] * 0.62 + 0.01, 0.015),
            );
      return root.worldToLocal(point);
    },
    update(dt) {
      const alpha = 1 - Math.exp(-16 * dt);
      fingers.forEach((f, i) => {
        f.pivot.rotation.x = THREE.MathUtils.lerp(
          f.pivot.rotation.x,
          targets[i],
          alpha,
        );
        f.joint.rotation.x = THREE.MathUtils.lerp(
          f.joint.rotation.x,
          targets[i] ? 1.35 : number === 9 && i === 0 ? 1.55 : 0.07,
          alpha,
        );
      });
      thumb.rotation.x = THREE.MathUtils.lerp(
        thumb.rotation.x,
        thumbTarget,
        alpha,
      );
      thumb.rotation.z = THREE.MathUtils.lerp(
        thumb.rotation.z,
        thumbTarget > 1 ? -0.8 : 0.7,
        alpha,
      );
    },
  };
}
