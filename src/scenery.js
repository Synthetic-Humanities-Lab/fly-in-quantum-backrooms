import * as T from "../vendor/three.module.js";
import { CELL } from "./maze.js";
// Reconstructed geometry of the Floor 1 QPS. Floor 1 has no bottles or visor.
export function createScenery(scene, world) {
  const qps = new T.Group(),
    p = 0.00675 * CELL * 2.67,
    w = 7 * p,
    h = 9.5 * p,
    d = 1.2 * p;
  const add = (geometry, material, z = 0) => {
    const m = new T.Mesh(geometry, material);
    m.position.z = z;
    qps.add(m);
    return m;
  };
  const standard = (color, metalness, roughness) =>
    new T.MeshStandardMaterial({ color, metalness, roughness });
  add(new T.BoxGeometry(w, h, d), standard(1711892, 0.6, 0.4));
  add(
    new T.BoxGeometry(0.88 * w, 0.9 * h, 0.3 * d),
    standard(856585, 0.3, 0.6),
  );
  add(
    new T.PlaneGeometry(0.82 * w, 0.84 * h),
    new T.MeshBasicMaterial({ color: 265476 }),
    0.65 * d,
  );
  const frame = new T.LineSegments(
    new T.EdgesGeometry(new T.BoxGeometry(0.83 * w, 0.85 * h, 0.001)),
    new T.LineBasicMaterial({
      color: 2096973,
      transparent: true,
      opacity: 0.65,
    }),
  );
  frame.position.z = 0.66 * d;
  qps.add(frame);
  const z = 0.7 * d;
  add(
    new T.SphereGeometry(2.4 * p, 24, 16),
    new T.MeshBasicMaterial({
      color: 2096973,
      transparent: true,
      opacity: 0.06,
      side: T.BackSide,
      depthWrite: false,
    }),
    z,
  );
  add(
    new T.SphereGeometry(1.5 * p, 24, 16),
    new T.MeshBasicMaterial({
      color: 887856,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
    }),
    z,
  );
  add(
    new T.SphereGeometry(p, 24, 16),
    new T.MeshStandardMaterial({
      color: 678942,
      emissive: 887856,
      emissiveIntensity: 0.8,
      metalness: 0.3,
      roughness: 0.4,
    }),
    z,
  );
  for (const [a, color] of [
    [0, 2096973],
    [Math.PI, 678942],
    [Math.PI / 2, 0xaaff44],
    [-Math.PI / 2, 0xaaff44],
  ]) {
    const m = add(
      new T.ConeGeometry(0.16 * p, 1.5 * p, 6),
      new T.MeshBasicMaterial({ color }),
      z,
    );
    m.rotation.z = a - Math.PI / 2;
    m.position.x = Math.cos(a) * p * 1.1;
    m.position.y = Math.sin(a) * p * 1.1;
  }
  const rings = [];
  for (const [x, rz, color, opacity] of [
    [0, 0, 2096973, 0.7],
    [Math.PI / 3, 0, 4513160, 0.5],
    [-Math.PI / 3, Math.PI / 4, 0xaaff44, 0.42],
    [Math.PI / 2, Math.PI / 6, 52326, 0.38],
  ]) {
    const m = add(
      new T.TorusGeometry(2 * p, 0.08 * p, 8, 48),
      new T.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
      }),
      z,
    );
    m.rotation.set(x, 0, rz);
    rings.push(m);
  }
  for (const side of [-1, 1])
    add(
      new T.CircleGeometry(0.3 * p, 12),
      new T.MeshBasicMaterial({ color: 2096973, side: T.DoubleSide }),
      z,
    ).position.y = side * p * 1.05;
  qps.add(new T.PointLight(2096973, 0.025, 2 * CELL, 2));
  qps.add(new T.PointLight(4513160, 0.012, 1.5 * CELL, 2));
  scene.add(qps);
  return {
    qps,
    reset(nextWorld) {
      world = nextWorld;
    },
    update(time, observer) {
      qps.position.set(
        (world.qps.col + 0.5) * CELL,
        0.11 * CELL + 0.02 * CELL * Math.sin(1.5 * time),
        (world.qps.row + 0.5) * CELL,
      );
      qps.lookAt(observer.x, qps.position.y, observer.z);
      qps.rotateY((Math.PI / 3) * Math.sin(0.35 * time));
      rings.forEach((m, i) => {
        m.rotation.y =
          time * (0.5 + 0.18 * (i + 9)) * ((i + 9) % 2 === 0 ? 1 : -1);
      });
    },
  };
}
