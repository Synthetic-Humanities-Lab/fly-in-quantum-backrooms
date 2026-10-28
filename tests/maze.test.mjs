import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { LevelDefinition, WORLD, FLOOR1_PROVENANCE } from "../src/level.js";
import {
  WorldState,
  CELL,
  RADIUS,
  targetState,
  compatibleSubset,
  observationMask,
  sampleRecord,
} from "../src/maze.js";
import { observationLevel } from "../src/vision.js";
const bytes = await readFile(new URL("../public/floor1.json", import.meta.url));
const data = JSON.parse(bytes);
const pose = { x: 2.5 * CELL, z: 2.5 * CELL, heading: 0 };
test("smaller fly collision envelope follows its one-percent body length", () => {
  assert.equal(WORLD.bodyLength / CELL, 0.01);
  const world = new WorldState(data),
    wall = world.edges.find((e) => e.id === "h-3-2");
  for (const e of world.edges) if (!e.boundary) e.state = "open";
  wall.state = "wall";
  const gap = WORLD.wallThickness / 2 + WORLD.bodyLength * 0.75;
  assert.equal(world.canStand(wall.x, wall.z - gap), true);
  assert.equal(world.canStand(wall.x, wall.z - gap, WORLD.bodyLength), false);
});
test("original data bytes and retained-weight normalization", () => {
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    FLOOR1_PROVENANCE.sha256,
  );
  const level = new LevelDefinition(data);
  assert.equal(level.records.length, 16);
  assert.equal(
    level.records.reduce((s, r) => s + r.probability, 0),
    1,
  );
  assert.equal(data.results.measurements[0].probability, 1 / 4096);
  assert.equal(level.zExpectations.length, 36);
  assert.equal(level.couplings.length, 60);
});
test("Floor 1 uses AND, not either parity branch", () => {
  for (const [bits, result] of [
    ["00", "open"],
    ["01", "open"],
    ["10", "open"],
    ["11", "wall"],
  ])
    assert.equal(targetState(bits, 0, 1), result);
});
test("radiation follows the occupied room, including boundaries, without mutating the world", () => {
  const world = new WorldState(data),
    before = world.snapshot();
  assert.deepEqual(world.level.radiatingRooms, [2]);
  assert.equal(world.isRadiating({ x: 2.5 * CELL, z: 0.5 * CELL }), true);
  assert.equal(world.isRadiating({ x: 2 * CELL, z: 0 }), true);
  assert.equal(world.isRadiating({ x: 3 * CELL, z: 0.5 * CELL }), false);
  assert.equal(world.isRadiating({ x: 2.5 * CELL, z: CELL }), false);
  assert.equal(world.isRadiating({ x: -3.5 * CELL, z: 1.5 * CELL }), false);
  assert.equal(world.isRadiating({ x: 8.5 * CELL, z: -0.5 * CELL }), false);
  assert.deepEqual(world.snapshot(), before);
});
test("initial walls preserve superposition; boundaries solid; horizontal first", () => {
  const w = new WorldState(data);
  assert.equal(w.edges.length, 84);
  assert.equal(w.edges.filter((e) => e.boundary).length, 24);
  assert.equal(w.wallCounts().superposition, 60);
  assert.equal(w.edges[0].id, "h-0-0");
  assert.equal(w.edges[42].id, "v-0-0");
});
test("full, peripheral, range and behind-observer boundaries", () => {
  const point = (a, r) => [pose.x + Math.sin(a) * r, pose.z + Math.cos(a) * r];
  assert.equal(observationLevel(pose, ...point(0, CELL)), "full");
  assert.equal(
    observationLevel(pose, ...point(WORLD.observationHalfAngle + 0.1, CELL)),
    "peripheral",
  );
  assert.equal(
    observationLevel(pose, ...point(WORLD.observationHalfAngle + 0.36, CELL)),
    "none",
  );
  assert.equal(observationLevel(pose, ...point(0, 2 * CELL + 0.001)), "none");
  assert.equal(observationLevel(pose, ...point(Math.PI, CELL)), "none");
});
test("occlusion is absent from original measurement, distinct from geometry sensing", () => {
  const w = new WorldState(data);
  const near = w.edges.find((e) => e.id === "h-3-2"),
    far = w.edges.find((e) => e.id === "h-4-2");
  near.state = "wall";
  far.state = "superposition";
  w.activeSubset = [{ bitstring: "1".repeat(36), probability: 1 }];
  w.resample(pose);
  assert.equal(far.observed, true);
  assert.equal(far.state, "wall");
  assert.ok(w.ray(pose.x, pose.z, 0).distance < CELL);
});
test("stationary settled walls persist across contrary sampled records", () => {
  const w = new WorldState(data);
  w.activeSubset = [{ bitstring: "1".repeat(36), probability: 1 }];
  w.resample(pose);
  const held = w.edges.filter(
    (e) => e.observed && !e.boundary && e.entropy === 0,
  );
  assert.ok(held.length);
  w.activeSubset = [{ bitstring: "0".repeat(36), probability: 1 }];
  w.resample(pose);
  assert.ok(held.every((e) => e.state === "wall"));
  assert.equal(w.current, "0".repeat(36));
});
test("turning away permits mutation; returning preserves the displayed settled state", () => {
  const w = new WorldState(data);
  const e = w.edges.find((e) => e.id === "h-3-2");
  e.state = "wall";
  e.entropy = 0;
  w.activeSubset = [{ bitstring: "0".repeat(36), probability: 1 }];
  w.rng = () => 0;
  w.resample({ ...pose, heading: Math.PI });
  assert.equal(e.state, "open");
  w.activeSubset = [{ bitstring: "1".repeat(36), probability: 1 }];
  w.resample(pose);
  assert.equal(e.state, "open");
});
test("mask wall/open votes preserve ties as X", () => {
  const base = { x: pose.x, z: pose.z + CELL / 2, state: "wall", a: 0, b: 1 };
  assert.equal(observationMask([base], pose, 3), "11X");
  assert.equal(
    observationMask([base, { ...base, state: "open", a: 1, b: 2 }], pose, 3),
    "1X0",
  );
});
test("filter normalization, single compatible state, one-constraint recovery, full fallback", () => {
  const records = [
    { bitstring: "00", probability: 0.25 },
    { bitstring: "11", probability: 0.75 },
  ];
  assert.deepEqual(compatibleSubset(records, "00"), [
    { bitstring: "00", probability: 1 },
  ]);
  assert.equal(compatibleSubset(records, "01")[0].bitstring, "00");
  const r = [
    { bitstring: "000", probability: 0.5 },
    { bitstring: "001", probability: 0.5 },
  ];
  assert.equal(compatibleSubset(r, "110"), r); // dropping two would match: forbidden
  assert.equal(sampleRecord(records, () => 0.25).bitstring, "00");
});
test("sampling uses the previous subset; updated mask governs next tick", () => {
  const w = new WorldState(data);
  w.activeSubset = [{ bitstring: "1".repeat(36), probability: 1 }];
  w.resample(pose);
  assert.equal(w.current, "1".repeat(36));
  assert.notEqual(w.mask, "X".repeat(36));
  assert.ok(
    w.activeSubset.every((r) =>
      data.results.measurements.some((s) => s.bitstring === r.bitstring),
    ),
  );
});
test("solid and superposition block movement, fading open walls do not", () => {
  const w = new WorldState(data);
  const e = w.edges.find((e) => e.id === "h-3-2");
  for (const state of ["wall", "superposition"]) {
    e.state = state;
    assert.equal(w.canStand(e.x, e.z), false);
  }
  e.state = "open";
  e.changedAt = 0;
  assert.equal(w.canStand(e.x, e.z), true);
  assert.equal(
    w.canStand(e.x, e.z + WORLD.wallThickness / 2 + RADIUS + 0.001),
    true,
  );
});
test("continuous body hold is opt-in and confined to occupied wall/body volume", () => {
  const w = new WorldState(data);
  for (const e of w.edges) {
    if (!e.boundary) {
      e.state = "open";
      e.entropy = 0;
    }
  }
  const e = w.edges.find((e) => e.id === "h-3-2");
  const body = { x: e.x, z: e.z, heading: Math.PI };
  w.activeSubset = [{ bitstring: "1".repeat(36), probability: 1 }];
  w.rng = () => 0;
  w.resample(body, { protectBody: true });
  assert.equal(e.state, "open");
  assert.equal(e.held, true);
  const other = w.edges.find((q) => q.id === "h-4-2");
  assert.equal(other.state, "wall");
  assert.equal(other.held, false);
  const original = new WorldState(data);
  original.edges.find((q) => q.id === e.id).state = "superposition";
  original.activeSubset = [{ bitstring: "1".repeat(36), probability: 1 }];
  original.rng = () => 0;
  original.resample(body);
  assert.equal(original.edges.find((q) => q.id === e.id).state, "wall");
});
test("fixed replay unaffected by unrelated viewer state or map reads", () => {
  const a = new WorldState(data, 42),
    b = new WorldState(data, 42);
  for (let i = 0; i < 200; i++) {
    const p = {
      x: (2.5 + Math.sin(i / 40)) * CELL,
      z: 2.5 * CELL,
      heading: i * 0.07,
    };
    const spectator = {
      mode: ["first", "chase", "shoulder"][i % 3],
      angle: i,
      mapExpanded: !!(i % 2),
    };
    assert.ok(spectator);
    b.snapshot();
    b.wallCounts();
    b.ray(p.x, p.z, i);
    a.resample(p);
    b.resample(p);
    assert.deepEqual(a.snapshot(), b.snapshot());
  }
});

test("spectator modes and orbit preserve sensory features and complete fly trajectories", async () => {
  const { Simulation } = await import("../src/simulation.js");
  const { cameraPose } = await import("../src/cameras.js");
  const a = new Simulation(data, 301),
    b = new Simulation(data, 301);
  for (let i = 0; i < 500; i++) {
    for (const view of ["first", "chase", "shoulder"])
      cameraPose(b.fly, b.world, { view, orbit: i * 0.13 });
    assert.deepEqual(a.sense(), b.sense());
    const rates = {
      DNa02L: Math.sin(i / 25) + 1,
      DNa02R: Math.cos(i / 21) + 1,
      DNg100L: 1,
      DNg100R: 1,
    };
    a.commitNeural(rates);
    b.commitNeural(rates);
    assert.deepEqual(a.snapshot(), b.snapshot());
  }
});
test("follow/shoulder cameras stop before solid and transitional walls", async () => {
  const { cameraPose } = await import("../src/cameras.js");
  const w = new WorldState(data);
  const edge = w.edges.find((e) => e.id === "h-1-2");
  for (const state of ["wall", "superposition"]) {
    edge.state = state;
    const body = { x: edge.x, z: edge.z + 0.25, y: 1.6, heading: 0 };
    for (const view of ["chase", "shoulder"]) {
      const camera = cameraPose(body, w, { view });
      assert.ok(camera.position.z > edge.z + WORLD.wallThickness / 2);
      assert.ok(camera.position.y < WORLD.wallHeight);
    }
  }
});

test("crossing a cell boundary changes room identity without snapping the continuous observer", () => {
  const world = new WorldState(data),
    edge = world.edges.find((e) => e.id === "h-3-2");
  for (const e of world.edges)
    if (!e.boundary) {
      e.state = "open";
      e.entropy = 0;
    }
  const body = { x: edge.x, z: edge.z - 0.01, heading: 0 };
  assert.equal(world.room(body.x, body.z), 14);
  world.move(body, 0, 0.02);
  assert.equal(world.room(body.x, body.z), 20);
  assert.ok(Math.abs(body.z - edge.z - 0.01) < 1e-9);
  assert.equal(observationLevel(body, edge.x, edge.z), "none");
  body.heading = Math.PI;
  assert.equal(observationLevel(body, edge.x, edge.z), "full");
});
test("swept body movement cannot tunnel through a wall over a long frame", () => {
  const world = new WorldState(data),
    edge = world.edges.find((e) => e.id === "h-3-2");
  const body = { x: edge.x, z: edge.z - CELL / 2 };
  for (const state of ["wall", "superposition"]) {
    edge.state = state;
    body.z = edge.z - CELL / 2;
    world.move(body, 0, CELL * 2);
    assert.ok(body.z < edge.z - WORLD.wallThickness / 2 - RADIUS + 0.001);
    assert.ok(world.canStand(body.x, body.z));
  }
});
test("manual reference quarter-turn collapse preserves the original helper draw order", () => {
  const world = new WorldState(data),
    edge = world.edges.find((e) => e.id === "h-3-2");
  for (const e of world.edges) if (e !== edge) e.state = "wall";
  let draws = 0;
  world.rng = () => {
    draws++;
    return 0.6;
  };
  world.referenceTurn(pose);
  assert.equal(draws, 9);
  assert.equal(edge.state, "wall");
  assert.ok(Math.abs(edge.probability - 0.7) < 1e-12);
  assert.equal(edge.entropy, 0);
});

test("neural flight brakes before a front wall without a manual control path", async () => {
  const { Flight } = await import("../src/flight.js");
  const world = new WorldState(data);
  for (const e of world.edges) if (!e.boundary) e.state = "open";
  const wall = world.edges.find((e) => e.id === "h-3-2");
  wall.state = "wall";
  const fly = new Flight({ x: wall.x, z: wall.z - 0.25, heading: 0 }),
    start = fly.z;
  fly.setNeural({ DNg100L: 100, DNg100R: 100 });
  for (let i = 0; i < 30; i++) fly.step(0.02, world);
  assert.equal(fly.z, start);
  assert.ok(world.canStand(fly.x, fly.z));
});
