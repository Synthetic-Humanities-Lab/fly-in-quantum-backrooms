import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { NeuralSample } from "../src/neural-sample.js";
import { BrowserBrain } from "../src/browser-brain.js";
const spatial = {
  neurons: 4,
  indices: [0, 2],
  positions: [
    [1, 2, 3],
    [4, 5, 6],
  ],
};

test("display counts only actual spikes of selected neurons and resets per committed block", () => {
  const sample = new NeuralSample(spatial, 4);
  sample.add(Uint32Array.of(0, 1, 2));
  sample.add(Uint32Array.of(2, 3));
  const first = sample.take();
  assert.deepEqual([...first], [1, 2]);
  sample.add(Uint32Array.of(0));
  assert.deepEqual([...sample.take()], [1, 0]);
  assert.deepEqual([...first], [1, 2]);
});
test("display sampling does not change membrane state, spikes or subsequent neural steps", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../public/model/manifest.json", import.meta.url)),
  );
  const config = { ...manifest, neurons: 4, ear: [] };
  const arrays = {
    indptr: Uint32Array.of(0, 1, 2, 3, 4),
    indices: Uint32Array.of(1, 2, 3, 0),
    weights: Float32Array.of(0.4, 0.3, 0.2, 0.1),
  };
  const plain = new BrowserBrain(config, arrays),
    observed = new BrowserBrain(config, arrays);
  const sample = new NeuralSample(spatial, 4);
  for (let i = 0; i < 100; i++) {
    plain.step(0, null, [[[0], 0.3]]);
    const spikes = observed.step(0, null, [[[0], 0.3]]);
    sample.add(spikes);
    if (i % 4 === 3) sample.take();
    assert.deepEqual(observed.v, plain.v);
    assert.deepEqual(observed.fired, plain.fired);
  }
});
test("spatial export is a bounded unique coordinate sample from the pinned model", () => {
  const bytes = readFileSync(
    new URL("../public/model/spatial.json", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "b68540c73501d975dc72bee03869527157d26f12bf9330be7b14ffe1b778c8d1",
  );
  const actual = JSON.parse(bytes);
  assert.equal(actual.indices.length, 12000);
  assert.equal(
    actual.sourceArchiveSha256,
    "cc9bd1ecd00bd703a6fa648bc6ad145c93c7c1ee53debdcc9ce0d1f4305e6aca",
  );
  assert.doesNotThrow(() => new NeuralSample(actual, 166700));
  assert.throws(() => new NeuralSample({ ...spatial, indices: [0, 0] }, 4));
  assert.throws(
    () =>
      new NeuralSample(
        {
          ...spatial,
          positions: [
            [NaN, 0, 0],
            [0, 0, 0],
          ],
        },
        4,
      ),
  );
});
