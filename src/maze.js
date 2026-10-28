import { LevelDefinition, WORLD, normalizeRecords } from "./level.js";
import { observationLevel } from "./vision.js";
import { WanderingEntity } from "./entity.js";
export const CELL = WORLD.cell;
// Conservative horizontal envelope for the head/thorax/abdomen body bounds.
export const RADIUS = WORLD.bodyLength / 2;
export const MAZE_TICK = WORLD.tickSeconds;
export function random(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function compatibleSubset(records, mask) {
  const matches = (m) =>
    records.filter((r) =>
      [...m].every((v, i) => v === "X" || v === r.bitstring[i]),
    );
  let subset = matches(mask);
  if (!subset.length) {
    // The reference retries ONE dropped constraint, in reverse bit order.
    // It does not cumulatively relax the mask or replace the stored mask.
    for (let i = mask.length - 1; i >= 0; i--)
      if (mask[i] !== "X") {
        subset = matches(mask.slice(0, i) + "X" + mask.slice(i + 1));
        if (subset.length) break;
      }
  }
  return subset.length ? normalizeRecords(subset) : records;
}
export function sampleRecord(records, rng) {
  const draw = rng();
  let cumulative = 0;
  for (const r of records) {
    cumulative += r.probability;
    if (draw <= cumulative) return r;
  }
  return records.at(-1);
}
export function targetState(record, a, b) {
  return record[a] === "1" && record[b] === "1" ? "wall" : "open";
}
export function observationMask(edges, pose, count = 36) {
  const walls = Array(count).fill(0),
    opens = Array(count).fill(0);
  for (const e of edges) {
    if (
      e.boundary ||
      e.state === "superposition" ||
      observationLevel(pose, e.x, e.z) === "none"
    )
      continue;
    const votes = e.state === "wall" ? walls : opens;
    votes[e.a]++;
    votes[e.b]++;
  }
  return walls
    .map((w, i) => (w > 0 && opens[i] === 0 ? "1" : opens[i] > w ? "0" : "X"))
    .join("");
}
// WorldState has no renderer, DOM, camera or map references. Maze sampling
// consumes its RNG here; ambient movement and rendering use separate seeds.
export class WorldState {
  constructor(data, seed = 2106) {
    this.level =
      data instanceof LevelDefinition ? data : new LevelDefinition(data);
    this.source = this.level.source;
    this.rng = random(seed);
    this.seed = seed;
    this.records = this.level.records;
    this.activeSubset = this.records;
    this.mask = "X".repeat(36);
    this.current = sampleRecord(this.records, this.rng).bitstring;
    this.elapsed = 0;
    this.revision = 0;
    this.sampleRevision = 0;
    this.changes = 0;
    this.tick = 0;
    this.edges = [];
    const coupled = new Set(this.level.couplings.map(([a, b]) => `${a}:${b}`));
    const add = (row, col, vertical) => {
      const boundary = vertical
        ? col === 0 || col === 6
        : row === 0 || row === 6;
      const b = row * 6 + col,
        a = vertical ? b - 1 : b - 6;
      const connected = !boundary && coupled.has(`${a}:${b}`);
      this.edges.push({
        id: `${vertical ? "v" : "h"}-${row}-${col}`,
        row,
        col,
        vertical,
        x: (col + (vertical ? 0 : 0.5)) * CELL,
        z: (row + (vertical ? 0.5 : 0)) * CELL,
        a: boundary ? null : a,
        b: boundary ? null : b,
        boundary,
        state: boundary ? "wall" : connected ? "superposition" : "open",
        probability: boundary ? 1 : connected ? 0.5 : 0,
        entropy: connected ? 1 : 0,
        changedAt: 0,
        collapsedAt: 0,
        lastSeen: 0,
        observed: false,
        held: false,
      });
    };
    // This order determines random draw consumption in the original Map.
    for (let r = 0; r <= 6; r++) for (let c = 0; c < 6; c++) add(r, c, false);
    for (let r = 0; r < 6; r++) for (let c = 0; c <= 6; c++) add(r, c, true);
    const placements = random(seed ^ 0xa741);
    const candidates = [1, 2, 3, 4].filter(
      (i) => !this.level.radiatingRooms.includes(i),
    );
    const col = candidates[Math.floor(placements() * candidates.length)];
    this.spawn = {
      x: (col + 0.5) * CELL,
      z: CELL / 2,
      y: WORLD.humanEyeHeight,
      heading: 0,
    };
    const target = [];
    for (let row = 1; row < 5; row++)
      for (let c = 1; c < 5; c++) target.push({ row, col: c });
    for (let i = target.length - 1; i > 0; i--) {
      const j = Math.floor(placements() * (i + 1));
      [target[i], target[j]] = [target[j], target[i]];
    }
    this.qps =
      target.find((p) => Math.max(p.row, Math.abs(p.col - col)) >= 3) ||
      target[0];
    this.entity = new WanderingEntity(this.spawn, random(seed ^ 0xe1717));
  }
  // The original keyboard's quarter-turn shortcut immediately collapses
  // visible superpositions using its neighbour-weighted helper. Continuous
  // fly headings are instead observed by the 200 ms QPU tick.
  referenceTurn(observer) {
    const edges = new Map(this.edges.map((e) => [e.id, e]));
    for (const e of this.edges) {
      const level = observationLevel(observer, e.x, e.z);
      if (
        e.boundary ||
        e.state !== "superposition" ||
        e.entropy === 0 ||
        level === "none"
      )
        continue;
      const r = e.row,
        c = e.col;
      const neighbours = e.vertical
        ? [
            `h-${r}-${c - 1}`,
            `h-${r + 1}-${c - 1}`,
            `h-${r}-${c}`,
            `h-${r + 1}-${c}`,
            `v-${r - 1}-${c}`,
            `v-${r + 1}-${c}`,
          ]
        : [
            `v-${r - 1}-${c}`,
            `v-${r - 1}-${c + 1}`,
            `v-${r}-${c}`,
            `v-${r}-${c + 1}`,
            `h-${r}-${c - 1}`,
            `h-${r}-${c + 1}`,
          ];
      const open = neighbours.filter(
        (id) => edges.get(id)?.state === "open",
      ).length;
      let p = Math.max(
        0.05,
        Math.min(0.95, 0.55 * Math.pow(0.72, open) + 0.15),
      );
      for (let i = 0; i < 8; i++) this.rng(); // helper's diagnostic bitstring weights
      if (level === "peripheral") p = 0.7 * e.probability + 0.3 * p;
      e.prevState = e.state;
      e.state = this.rng() < p ? "wall" : "open";
      e.probability = p;
      e.entropy = level === "full" ? 0 : 0.2;
      e.changedAt = e.collapsedAt = e.lastSeen = this.elapsed;
      this.revision++;
    }
  }
  room(x, z) {
    return (
      Math.min(5, Math.max(0, Math.floor(z / CELL))) * 6 +
      Math.min(5, Math.max(0, Math.floor(x / CELL)))
    );
  }
  open(edge) {
    return edge.state === "open";
  }
  walls() {
    return this.edges.filter((e) => !this.open(e));
  }
  resample(observer, { protectBody = false, radius = RADIUS } = {}) {
    this.elapsed = ++this.tick * MAZE_TICK;
    const next = sampleRecord(this.activeSubset, this.rng).bitstring;
    if (next !== this.current) this.sampleRevision++;
    this.current = next;
    this.changes = 0;
    for (const e of this.edges) {
      e.observed = observationLevel(observer, e.x, e.z) !== "none";
      e.held = false;
      if (e.boundary) continue;
      const before = e.state,
        target = targetState(next, e.a, e.b);
      if (e.observed) {
        if (e.entropy === 0 && e.state !== "superposition")
          e.lastSeen = this.elapsed;
        else if (e.state !== target) {
          e.prevState = e.state;
          e.state = target;
          e.probability = +(target === "wall");
          e.entropy = 0;
          e.changedAt = e.collapsedAt = e.lastSeen = this.elapsed;
        } else e.lastSeen = this.elapsed;
      } else if (e.state !== target) {
        if (this.rng() < 0.12) {
          e.state = target;
          e.changedAt = this.elapsed;
        } else if (this.rng() < 0.03) {
          e.prevState = e.state;
          e.state = "superposition";
          e.probability = 0.5;
          e.entropy = 1;
          e.changedAt = this.elapsed;
        }
      }
      // Continuous embodiment exception: only the occupied body volume is held.
      // Reference mode disables this exception entirely. It never changes a route.
      if (
        protectBody &&
        before === "open" &&
        e.state !== "open" &&
        this.intersects(e, observer.x, observer.z, radius)
      ) {
        e.state = "open";
        e.probability = 0;
        e.entropy = 0;
        e.held = true;
      }
      if (e.state !== before) this.changes++;
    }
    const mask = observationMask(this.edges, observer);
    if (mask !== this.mask)
      this.activeSubset = compatibleSubset(this.records, mask);
    this.mask = mask;
    if (this.changes) this.revision++;
  }
  intersects(e, x, z, r = RADIUS) {
    const normal = Math.max(
      0,
      Math.abs(e.vertical ? x - e.x : z - e.z) - WORLD.wallThickness / 2,
    );
    const along = Math.max(
      0,
      Math.abs(e.vertical ? z - e.z : x - e.x) - CELL / 2,
    );
    return normal * normal + along * along < r * r;
  }
  canStand(x, z, r = RADIUS) {
    return (
      x >= r &&
      z >= r &&
      x <= 6 * CELL - r &&
      z <= 6 * CELL - r &&
      !this.walls().some((e) => this.intersects(e, x, z, r))
    );
  }
  move(body, dx, dz, r = RADIUS) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / (r / 2)));
    for (let i = 0; i < steps; i++) {
      if (this.canStand(body.x + dx / steps, body.z, r)) body.x += dx / steps;
      if (this.canStand(body.x, body.z + dz / steps, r)) body.z += dz / steps;
    }
  }
  // Slab intersections include wall thickness and superpositions. Camera
  // padding changes only the query, never the world's collision state.
  ray(x, z, angle, limit = CELL * 2, { padding = 0 } = {}) {
    const dx = Math.sin(angle),
      dz = Math.cos(angle);
    let distance = limit,
      hit = null;
    for (const e of this.edges) {
      if (e.state === "open") continue;
      const hx = (e.vertical ? WORLD.wallThickness : CELL) / 2 + padding;
      const hz = (e.vertical ? CELL : WORLD.wallThickness) / 2 + padding;
      let lo = -Infinity,
        hi = Infinity;
      for (const [origin, dir, min, max] of [
        [x, dx, e.x - hx, e.x + hx],
        [z, dz, e.z - hz, e.z + hz],
      ]) {
        if (Math.abs(dir) < 1e-9) {
          if (origin < min || origin > max) {
            hi = -Infinity;
            break;
          }
        } else {
          const a = (min - origin) / dir,
            b = (max - origin) / dir;
          lo = Math.max(lo, Math.min(a, b));
          hi = Math.min(hi, Math.max(a, b));
        }
      }
      if (hi >= Math.max(0, lo) && Math.max(0, lo) < distance) {
        distance = Math.max(0, lo);
        hit = e;
      }
    }
    return { distance, edge: hit };
  }
  isRadiating(observer) {
    const row = Math.floor(observer.z / CELL),
      col = Math.floor(observer.x / CELL);
    return (
      row >= 0 &&
      row < this.level.rows &&
      col >= 0 &&
      col < this.level.cols &&
      this.level.radiatingRooms.includes(row * this.level.cols + col)
    );
  }
  wallCounts() {
    return this.edges.reduce(
      (n, e) => {
        n[e.state]++;
        n.observed += +e.observed;
        return n;
      },
      { open: 0, wall: 0, superposition: 0, observed: 0 },
    );
  }
  snapshot() {
    return {
      tick: this.tick,
      mask: this.mask,
      current: this.current,
      active: this.activeSubset.map((r) => r.bitstring),
      edges: this.edges.map((e) => [
        e.id,
        e.state,
        e.entropy,
        e.probability,
        e.observed,
        e.held,
      ]),
    };
  }
}
export { WorldState as Maze };
