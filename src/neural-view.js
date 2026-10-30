import * as T from "../vendor/three.module.js";

// The only animation is measured firing in the last committed 80 ms block.
export class NeuralView {
  constructor(container, spatial) {
    this.container = container;
    this.spatial = spatial;
    this.renderer = new T.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.domElement.setAttribute("role", "img");
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Fly neural model: live spikes at sampled MaleCNS neuron coordinates",
    );
    container.append(this.renderer.domElement);
    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(38, 1, 0.01, 20);
    this.camera.position.set(0, 0, 3.3);
    this.camera.lookAt(0, 0, 0);
    const bounds = [0, 1, 2].map((axis) => {
      const values = spatial.positions.map((p) => p[axis]);
      return [Math.min(...values), Math.max(...values)];
    });
    const span = Math.max(...bounds.map(([a, b]) => b - a));
    const positions = new Float32Array(spatial.indices.length * 3);
    spatial.positions.forEach((p, i) => {
      positions[3 * i] =
        (2 * (p[0] - (bounds[0][0] + bounds[0][1]) / 2)) / span;
      positions[3 * i + 1] =
        (-2 * (p[2] - (bounds[2][0] + bounds[2][1]) / 2)) / span;
      positions[3 * i + 2] =
        (2 * (p[1] - (bounds[1][0] + bounds[1][1]) / 2)) / span;
    });
    this.colors = new Float32Array(positions.length);
    this.geometry = new T.BufferGeometry();
    this.geometry.setAttribute("position", new T.BufferAttribute(positions, 3));
    this.geometry.setAttribute("color", new T.BufferAttribute(this.colors, 3));
    this.material = new T.PointsMaterial({
      size: 0.013,
      vertexColors: true,
      sizeAttenuation: true,
    });
    this.scene.add(new T.Points(this.geometry, this.material));
    this.renderer.domElement.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      container.dataset.unavailable = "true";
    });
    this.renderer.domElement.addEventListener("webglcontextrestored", () => {
      delete container.dataset.unavailable;
      this.resize();
    });
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.update(new Uint8Array(spatial.indices.length), 0);
  }
  update(counts, neuralSeconds) {
    if (counts.length !== this.spatial.indices.length)
      throw Error("Neural display sample length changed.");
    let firingNeurons = 0,
      spikes = 0;
    for (let i = 0; i < counts.length; i++) {
      const active = counts[i] > 0;
      firingNeurons += Number(active);
      spikes += counts[i];
      this.colors[i * 3] = active ? 1 : 0.18;
      this.colors[i * 3 + 1] = active ? 0.57 + 0.08 * counts[i] : 0.23;
      this.colors[i * 3 + 2] = active ? 0.18 : 0.19;
    }
    this.geometry.attributes.color.needsUpdate = true;
    this.container.dataset.state = JSON.stringify({
      neuralSeconds,
      sampledNeurons: counts.length,
      firingNeurons,
      spikes,
    });
    this.resize();
  }
  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (!width || !height) return;
    if (this.width !== width || this.height !== height) {
      this.width = width;
      this.height = height;
      this.renderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.observer.disconnect();
    this.geometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
