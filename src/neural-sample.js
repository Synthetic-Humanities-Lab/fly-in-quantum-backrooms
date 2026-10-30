// Read-only spike telemetry; indices address the unchanged full neural model.
export class NeuralSample {
  constructor(spatial, neurons) {
    if (
      spatial.neurons !== neurons ||
      spatial.indices.length !== spatial.positions.length
    )
      throw Error("Neural display coordinates do not match the model.");
    this.lookup = new Int32Array(neurons).fill(-1);
    spatial.indices.forEach((id, i) => {
      if (
        !Number.isInteger(id) ||
        id < 0 ||
        id >= neurons ||
        this.lookup[id] !== -1 ||
        spatial.positions[i].length !== 3 ||
        !spatial.positions[i].every(Number.isFinite)
      )
        throw Error("Invalid neural display coordinate or index.");
      this.lookup[id] = i;
    });
    this.counts = new Uint8Array(spatial.indices.length);
  }
  add(spikes) {
    for (const id of spikes) {
      const sample = this.lookup[id];
      if (sample >= 0) this.counts[sample]++;
    }
  }
  take() {
    const counts = this.counts;
    this.counts = new Uint8Array(counts.length);
    return counts;
  }
}
