import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { drawMap } from "../src/minimap.js";
import { WorldState, CELL } from "../src/maze.js";

const data = JSON.parse(
  readFileSync(new URL("../public/floor1.json", import.meta.url)),
);
function capture(world, pose, time) {
  const commands = [],
    stack = [];
  const ctx = {
    globalAlpha: 1,
    lineDashOffset: 0,
    dash: [],
    path: [],
    save() {
      stack.push({
        globalAlpha: this.globalAlpha,
        lineDashOffset: this.lineDashOffset,
        dash: this.dash,
        strokeStyle: this.strokeStyle,
        lineWidth: this.lineWidth,
      });
    },
    restore() {
      Object.assign(this, stack.pop());
    },
    clearRect() {},
    fillRect() {},
    translate() {},
    fill() {
      commands.push({
        fill: typeof this.fillStyle === "string" ? this.fillStyle : "gradient",
        path: this.path,
      });
    },
    fillText() {},
    closePath() {},
    beginPath() {
      this.path = [];
    },
    moveTo(...p) {
      this.path.push(["move", ...p]);
    },
    lineTo(...p) {
      this.path.push(["line", ...p]);
    },
    arc(...p) {
      this.path.push(["arc", ...p]);
    },
    roundRect() {},
    strokeRect(...p) {
      commands.push({ rectangle: p, color: this.strokeStyle });
    },
    createRadialGradient() {
      return { addColorStop() {} };
    },
    setLineDash(dash) {
      this.dash = dash;
    },
    stroke() {
      commands.push({
        color: this.strokeStyle,
        width: this.lineWidth,
        alpha: this.globalAlpha,
        dash: this.dash,
        offset: this.lineDashOffset,
        path: this.path,
      });
    },
  };
  drawMap({ width: 252, getContext: () => ctx }, world, pose, time);
  assert.equal(stack.length, 0);
  return commands;
}
const pose = { x: 2.5 * CELL, z: 2.5 * CELL, heading: 0 };
test("map retains room grid/boundary context without revealing settled walls behind the fly", () => {
  const world = new WorldState(data);
  for (const e of world.edges) {
    e.state = "open";
    e.entropy = 0;
  }
  const behind = world.edges.find((e) => e.id === "h-2-2");
  behind.state = "wall";
  const commands = capture(world, pose, 1);
  assert.equal(
    commands.filter((c) => c.color === "rgba(223,215,138,0.09)").length,
    14,
  );
  assert.equal(
    commands.filter((c) => c.rectangle && c.color === "rgba(255,238,100,0.35)")
      .length,
    1,
  );
  assert.equal(commands.filter((c) => c.color === "#fff8b4").length, 0);
  behind.state = "open";
  world.edges.find((e) => e.id === "h-3-2").state = "wall";
  assert.equal(
    capture(world, pose, 1).filter(
      (c) => c.color === "#fff8b4" && c.width === 4,
    ).length,
    1,
  );
});
test("map animation is deterministic at paused time and consumes no world state or RNG", () => {
  const world = new WorldState(data, 82),
    control = new WorldState(data, 82);
  const before = world.snapshot();
  const a = capture(world, pose, 1),
    b = capture(world, pose, 1);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, capture(world, pose, 1.17));
  assert.deepEqual(world.snapshot(), before);
  world.resample(pose);
  control.resample(pose);
  assert.deepEqual(world.snapshot(), control.snapshot());
});
test("active entity marker follows its world position even behind the fly or a wall", () => {
  const world = new WorldState(data, 82);
  world.entity.x = pose.x - CELL / 2;
  world.entity.z = pose.z - CELL / 2;
  const marker = (heading, time = 1) =>
    capture(world, { ...pose, heading }, time).find((c) =>
      c.fill?.startsWith("rgba(255,68,102,"),
    );
  const a = marker(0);
  assert.ok(a);
  assert.deepEqual(a, marker(Math.PI));
  assert.deepEqual(a.path[0].slice(1, 3), [118, 118]);
  world.entity.x += CELL;
  const b = marker(0);
  assert.ok(Math.abs(b.path[0][1] - a.path[0][1] - 59) < 1e-9);
  assert.notDeepEqual(b, marker(0, 1.1));
});
