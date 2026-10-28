import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WorldState, CELL } from "../src/maze.js";
import { Flight } from "../src/flight.js";
import { Simulation } from "../src/simulation.js";
import { ENTITY } from "../src/entity.js";
const data = JSON.parse(readFileSync("public/floor1.json"));
function openWorld(seed = 2106) {
  const w = new WorldState(data, seed);
  for (const e of w.edges) if (!e.boundary) e.state = "open";
  return w;
}

test("entity exists from startup, follows its own seeded walk and stays in the floor", () => {
  const a = openWorld(),
    b = openWorld(),
    rooms = new Set();
  assert.equal(a.level.entities.ghost, "wandering-from-start");
  assert.equal(a.level.entities.targeting, false);
  assert.equal(a.level.entities.attacks, false);
  for (let i = 0; i < 15000; i++) {
    a.entity.step(0.02, a);
    b.entity.step(0.02, b);
    rooms.add(a.room(a.entity.x, a.entity.z));
    assert.deepEqual(a.entity.snapshot(), b.entity.snapshot());
    assert.ok(
      a.entity.x > 0 &&
        a.entity.x < CELL * 6 &&
        a.entity.z > 0 &&
        a.entity.z < CELL * 6,
    );
  }
  assert.ok(rooms.size > 5);
  assert.ok(a.entity.distance > 100);
});
test("wandering never observes, consumes maze RNG, opens walls or needs a QPS trigger", () => {
  const a = new WorldState(data, 71),
    b = new WorldState(data, 71);
  for (let i = 0; i < 500; i++) {
    const observer = { ...a.spawn, heading: i * 0.13 };
    for (let s = 0; s < 10; s++) a.entity.step(0.02, a);
    a.resample(observer);
    b.resample(observer);
    assert.deepEqual(a.snapshot(), b.snapshot());
  }
  assert.ok(a.entity.distance > 40);
  assert.equal(a.rng(), b.rng());
});
test("sealed rooms and newly materialized walls cannot stall the apparition", () => {
  const world = openWorld(),
    entity = world.entity;
  entity.wait = 0;
  entity.chooseDestination(world);
  for (const e of world.edges) if (!e.boundary) e.state = "wall";
  const before = JSON.stringify(world.snapshot());
  const rooms = new Set();
  for (let i = 0; i < 5000; i++) {
    entity.step(0.02, world);
    rooms.add(world.room(entity.x, entity.z));
  }
  assert.ok(rooms.size > 3);
  assert.ok(entity.distance > 40);
  assert.equal(JSON.stringify(world.snapshot()), before);
});
test("fly senses the entity through local rays; walls, height and heading occlude it", () => {
  const world = openWorld(),
    fly = new Flight({ x: 2.5 * CELL, z: 2.5 * CELL, heading: 0 });
  world.entity.x = fly.x;
  world.entity.z = fly.z + 1;
  fly.sense(world);
  const visible = [...fly.ranges];
  assert.ok(Math.abs(visible[16] - (1 - ENTITY.radius)) < 1e-9);
  const wall = world.edges.find((e) => e.id === "h-3-2");
  wall.state = "wall";
  world.entity.z = fly.z + CELL;
  fly.sense(world);
  assert.equal(fly.ranges[16], world.ray(fly.x, fly.z, 0, 2 * CELL).distance);
  wall.state = "open";
  world.entity.z = fly.z - 1;
  fly.sense(world);
  const behind = [...fly.ranges];
  world.entity.z = fly.z + 1;
  fly.y = ENTITY.height + 0.01;
  fly.sense(world);
  assert.deepEqual(fly.ranges, behind);
});
test("visible approaching entity changes looming inputs; an occluded one does not", () => {
  const world = openWorld(),
    fly = new Flight({ x: 2.5 * CELL, z: 2.5 * CELL, heading: 0 });
  world.entity.x = fly.x - 0.15;
  world.entity.z = fly.z + 2;
  fly.sense(world);
  world.entity.z = fly.z + 0.6;
  const close = fly.sense(world);
  assert.ok(close.LPLC2L > 0);
  assert.ok(close.LC4L > 0);
  const wall = world.edges.find((e) => e.id === "h-3-2");
  wall.state = "wall";
  world.entity.z = fly.z + CELL;
  fly.sense(world);
  const before = [...fly.ranges];
  world.entity.x += 0.5;
  fly.sense(world);
  assert.deepEqual(fly.ranges, before);
});
test("entity clock advances only with committed simulation, and restart reproduces startup", () => {
  const a = new Simulation(data),
    initial = a.snapshot();
  for (let i = 0; i < 100; i++) {
    a.sense();
    a.world.wallCounts();
    a.snapshot();
  }
  assert.deepEqual(a.world.entity.snapshot(), initial.entity);
  a.commitNeural({});
  assert.ok(Math.abs(a.world.entity.elapsed - 0.08) < 1e-12);
  assert.deepEqual(new Simulation(data).snapshot(), initial);
});

test("authored entity GLB embeds its texture and stable joints without source-model dependencies", () => {
  const bytes = readFileSync("public/assets/cleanroom-reconstruction.glb");
  assert.equal(bytes.toString("ascii", 0, 4), "glTF");
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(
    bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString(),
  );
  assert.ok(gltf.asset.generator.startsWith("Independent"));
  assert.ok(
    gltf.images.every(
      (image) => Number.isInteger(image.bufferView) && !image.uri,
    ),
  );
  assert.ok(gltf.buffers.every((buffer) => !buffer.uri));
  assert.equal(gltf.extensionsRequired, undefined);
  for (const name of [
    "Torso",
    "Head",
    "ArmL",
    "ArmR",
    "ForearmL",
    "ForearmR",
    "LegL",
    "LegR",
    "ShinL",
    "ShinR",
  ])
    assert.ok(
      gltf.nodes.some((node) => node.name === name),
      name,
    );
  assert.ok(bytes.length < 2_000_000);
});

test("entity is already present but outside all three opening camera frusta", async () => {
  const T = await import("../public/vendor/three.module.js");
  const { cameraPose } = await import("../src/cameras.js");
  const { WORLD } = await import("../src/level.js");
  for (let seed = 0; seed < 64; seed++) {
    const simulation = new Simulation(data, seed),
      world = simulation.world;
    const entity = world.entity;
    assert.ok(
      Math.hypot(entity.x - world.spawn.x, entity.z - world.spawn.z) + 1e-9 >=
        3 * CELL,
    );
    const bounds = new T.Box3(
      new T.Vector3(entity.x - 0.45, 0, entity.z - 0.45),
      new T.Vector3(entity.x + 0.45, ENTITY.height, entity.z + 0.45),
    );
    for (const view of ["chase", "shoulder", "first"])
      for (const aspect of [390 / 844, 1280 / 720, 2560 / 720]) {
        const pose = cameraPose(simulation.fly, world, { view });
        const camera = new T.PerspectiveCamera(
          WORLD.cameraFov,
          aspect,
          0.005,
          150,
        );
        camera.position.copy(pose.position);
        camera.lookAt(new T.Vector3().copy(pose.target));
        camera.updateMatrixWorld();
        const frustum = new T.Frustum().setFromProjectionMatrix(
          new T.Matrix4().multiplyMatrices(
            camera.projectionMatrix,
            camera.matrixWorldInverse,
          ),
        );
        assert.equal(
          frustum.intersectsBox(bounds),
          false,
          `seed ${seed}, ${view}, aspect ${aspect}`,
        );
      }
  }
});
