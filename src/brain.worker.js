import { BrowserBrain } from "./browser-brain.js";
import { loadModel } from "./model-loader.js";
import { NeuralSample } from "./neural-sample.js";
let brain,
  groups,
  sample,
  busy = false,
  rate = {},
  ticks = 0;
self.onmessage = async ({ data }) => {
  if (busy) {
    postMessage({
      type: "error",
      message: "Neural worker received overlapping commands.",
    });
    return;
  }
  busy = true;
  try {
    if (data.type === "load") {
      const [loaded, spatial] = await Promise.all([
        loadModel(new URL("../model/", self.location), (fraction) =>
          postMessage({ type: "progress", fraction }),
        ),
        fetch(new URL("../model/spatial.json", self.location)).then(
          (response) => {
            if (!response.ok)
              throw Error("Neural display coordinates unavailable.");
            return response.json();
          },
        ),
      ]);
      groups = loaded.groups;
      brain = new BrowserBrain(loaded.manifest, loaded.arrays);
      sample = new NeuralSample(spatial, brain.n);
      for (const name of Object.keys(groups).filter(
        (k) => k.startsWith("DN") || k.startsWith("MDN"),
      ))
        rate[name] = 0;
      postMessage({
        type: "ready",
        neurons: brain.n,
        connections: brain.weights.length,
        spatial,
      });
    } else if (data.type === "reset") {
      if (!brain) throw Error("The neural model is not loaded.");
      brain.reset(1101);
      for (const name in rate) rate[name] = 0;
      ticks = 0;
      sample.take();
      postMessage({ type: "reset" });
    } else if (data.type === "step") {
      if (!brain) throw Error("The neural model is not loaded.");
      const injections = Object.entries(data.drive).map(([name, amount]) => {
        if (
          !groups[name] ||
          !Number.isFinite(amount) ||
          amount < 0 ||
          amount > 0.8
        )
          throw Error("Invalid sensory input.");
        return [groups[name], amount];
      });
      const start = performance.now();
      let activity = 0;
      for (let step = 0; step < 4; step++) {
        const spikes = brain.step(0, null, injections);
        activity += spikes.length;
        sample.add(spikes);
        const fired = new Set(spikes);
        for (const name in rate) {
          const instantaneous =
            groups[name].reduce((sum, id) => sum + Number(fired.has(id)), 0) /
            groups[name].length /
            0.02;
          rate[name] +=
            (instantaneous - rate[name]) * (1 - Math.exp(-0.02 / 0.35));
        }
        ticks++;
      }
      postMessage({
        type: "motor",
        rates: { ...rate },
        spikes: sample.take(),
        activity: activity / 4,
        milliseconds: performance.now() - start,
        neuralSeconds: ticks * 0.02,
      });
    }
  } catch (error) {
    postMessage({ type: "error", message: error.message });
  } finally {
    busy = false;
  }
};
