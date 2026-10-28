import { BrowserBrain } from "./browser-brain.js";
import { loadModel } from "./model-loader.js";
let brain,
  groups,
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
      const loaded = await loadModel(
        new URL("../model/", self.location),
        (fraction) => postMessage({ type: "progress", fraction }),
      );
      groups = loaded.groups;
      brain = new BrowserBrain(loaded.manifest, loaded.arrays);
      for (const name of Object.keys(groups).filter(
        (k) => k.startsWith("DN") || k.startsWith("MDN"),
      ))
        rate[name] = 0;
      postMessage({
        type: "ready",
        neurons: brain.n,
        connections: brain.weights.length,
      });
    } else if (data.type === "reset") {
      if (!brain) throw Error("The neural model is not loaded.");
      brain.reset(1101);
      for (const name in rate) rate[name] = 0;
      ticks = 0;
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
