import { WORLD } from "./level.js";
import { VISION, VISION_ANGLES } from "./vision.js";
export const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
export class Flight {
  constructor(spawn) {
    this.reset(spawn);
  }
  reset(spawn = { x: WORLD.cell * 1.5, z: WORLD.cell * 0.5, heading: 0 }) {
    this.x = spawn.x;
    this.z = spawn.z;
    this.y = 0.9;
    this.heading = spawn.heading;
    this.speed = 0;
    this.elapsed = 0;
    this.distance = 0;
    this.visited = new Set();
    this.turn = 0;
    this.neural = { left: 0, right: 0, escape: 0, forward: 0 };
    this.previousRanges = null;
    this.sampleTime = 0;
    this.stalled = 0;
  }
  sense(maze) {
    const distances = VISION_ANGLES.map((a) => {
      const heading = this.heading + a;
      const wall = maze.ray(this.x, this.z, heading, VISION.range).distance;
      return maze.entity.ray(this.x, this.y, this.z, heading, wall);
    });
    // Engineered feature adapter: local bright openings stimulate LC10a;
    // approaching geometry (walls or entity) stimulates LPLC2/LC4.
    // No entity identity, route, destination or global map is supplied.
    const middle = (distances.length - 1) / 2;
    const left = Math.max(...distances.slice(0, middle)),
      right = Math.max(...distances.slice(middle + 1));
    const contrast = (right - left) / Math.max(2, left + right);
    const drive = {
      LC10aL: 0,
      LC10aR: 0,
      LPLC2L: 0,
      LPLC2R: 0,
      LC4L: 0,
      LC4R: 0,
    };
    drive.LC10aL = Math.min(0.8, 0.12 + Math.max(0, -contrast) * 1.8);
    drive.LC10aR = Math.min(0.8, 0.12 + Math.max(0, contrast) * 1.8);
    // Symmetric blocked views require active scanning. An alternating attention
    // input is explicit here; it still has to propagate through the connectome.
    if (distances[middle] < 1.7 && Math.abs(contrast) < 0.08)
      drive[Math.floor(this.elapsed / 3) % 2 ? "LC10aL" : "LC10aR"] = 0.72;
    if (this.previousRanges)
      for (const [side, indices] of [
        ["L", Array.from({ length: middle }, (_, i) => i)],
        ["R", Array.from({ length: middle }, (_, i) => middle + 1 + i)],
      ]) {
        const growth = Math.max(
          ...indices.map((i) =>
            Math.max(
              0,
              1 / Math.max(0.25, distances[i]) -
                1 / Math.max(0.25, this.previousRanges[i]),
            ),
          ),
        );
        drive["LPLC2" + side] = Math.min(0.8, growth * 4);
        drive["LC4" + side] = Math.min(
          0.8,
          Math.max(0, 1.2 - Math.min(...indices.map((i) => distances[i]))) *
            0.45,
        );
      }
    this.previousRanges = distances;
    this.ranges = distances;
    this.drive = drive;
    return drive;
  }
  setNeural(rates) {
    this.neural = {
      left: rates.DNa02L || 0,
      right: rates.DNa02R || 0,
      escape: ((rates.DNp01L || 0) + (rates.DNp01R || 0)) / 2,
      forward: ((rates.DNg100L || 0) + (rates.DNg100R || 0)) / 2,
    };
  }
  step(dt, maze) {
    const n = this.neural;
    const targetTurn = Math.max(-1.8, Math.min(1.8, (n.right - n.left) * 0.32));
    this.turn += (targetTurn - this.turn) * (1 - Math.exp(-dt * 5));
    this.heading = wrap(this.heading + this.turn * dt);
    const clearance = maze.ray(this.x, this.z, this.heading, 3).distance;
    // A tonic forward flight drive + neural modulation, with a geometric safety
    // brake. Kinematic embodiment, not MuJoCo or a biological flight policy.
    const desired = 0.8 + Math.min(0.7, n.forward * 0.08);
    const brake = Math.max(0, Math.min(1, (clearance - 0.38) / 1.5));
    this.speed += (desired * brake - this.speed) * (1 - Math.exp(-dt * 4));
    const x = this.x,
      z = this.z;
    maze.move(
      this,
      Math.sin(this.heading) * this.speed * dt,
      Math.cos(this.heading) * this.speed * dt,
    );
    const moved = Math.hypot(this.x - x, this.z - z);
    this.distance += moved;
    this.elapsed += dt;
    this.stalled = moved < dt * 0.03 ? this.stalled + dt : 0;
    this.y =
      0.9 +
      Math.sin(this.elapsed * 0.8) * 0.1 +
      Math.min(0.15, n.escape * 0.008);
    this.visited.add(maze.room(this.x, this.z));
  }
}
