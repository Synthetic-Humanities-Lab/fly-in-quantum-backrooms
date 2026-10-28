import { WORLD } from "./level.js";
export const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
// Maze measurement, feature detectors and the 2D map have separate contracts.
// Original observation checks wall centres without an occlusion test.
export function observationLevel(pose, x, z) {
  const dx = x - pose.x,
    dz = z - pose.z;
  if (Math.hypot(dx, dz) > WORLD.cell * WORLD.observationRange) return "none";
  const angle = Math.abs(wrap(Math.atan2(dx, dz) - pose.heading));
  if (angle < WORLD.observationHalfAngle) return "full";
  return angle < WORLD.observationHalfAngle + WORLD.peripheralAngle
    ? "peripheral"
    : "none";
}
export const VISION = Object.freeze({
  halfAngle: Math.PI / 3,
  range: WORLD.cell * 2,
  rays: 33,
});
export const VISION_ANGLES = Object.freeze(
  Array.from(
    { length: VISION.rays },
    (_, i) => ((2 * i) / (VISION.rays - 1) - 1) * VISION.halfAngle,
  ),
);
export const MAP_VIEW = Object.freeze({
  halfAngle: Math.PI / 2.4,
  depth: WORLD.cell,
  radius: WORLD.cell * 3,
});
