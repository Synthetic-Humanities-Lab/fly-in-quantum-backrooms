import { Simulation, STEP } from "./simulation.js";
import { BackroomsScene } from "./scene.js";
import { AudioController } from "./audio-controller.js";
import { NeuralView } from "./neural-view.js";
import { drawMap } from "./minimap.js";
const $ = (id) => document.getElementById(id);
let source,
  simulation,
  scene,
  worker,
  ready = false,
  pending = false,
  running = false,
  started = false;
let queuedMotor = null,
  nextBlock = 0,
  loadGeneration = 0,
  neuralSeconds = 0,
  modelMs = 0,
  lastStats = 0;
let neuralView;
const sound = new AudioController(({ enabled, state, label }) => {
  $("sound").textContent = label;
  $("sound").setAttribute("aria-pressed", String(enabled));
  $("sound").dataset.audioState = state;
});
const seed = 2106;
function updateControls() {
  $("pause").textContent = running ? "Pause" : "Resume";
  $("pause").setAttribute("aria-label", running ? "Pause" : "Resume");
  sound.setRunning(running);
}
function enter() {
  started = true;
  running = true;
  $("welcome").hidden = true;
  $("error").hidden = true;
  $("controls").hidden = false;
  $("neural-panel").hidden = false;
  nextBlock = performance.now();
  updateControls();
}
function neuralError(message) {
  running = false;
  ready = false;
  pending = false;
  queuedMotor = null;
  worker?.terminate();
  worker = null;
  $("welcome").hidden = true;
  $("error-message").textContent = message;
  $("error").hidden = false;
  updateControls();
  $("controls").hidden = true;
}
function graphicsError(message) {
  running = false;
  updateControls();
  $("error-title").textContent = "The world could not render";
  $("error-message").textContent = message;
  $("error").hidden = false;
  $("retry").textContent = "Reload";
  $("retry").onclick = () => location.reload();
}
function loadBrain() {
  if (worker) return;
  running = false;
  updateControls();
  $("controls").hidden = true;
  $("error").hidden = true;
  $("welcome").hidden = false;
  $("load-status").textContent = "Loading…";
  $("load-status").dataset.progress = "0";
  $("neural-panel").hidden = true;
  const generation = ++loadGeneration;
  worker = new Worker(new URL("./brain.worker.js", import.meta.url), {
    type: "module",
  });
  worker.onerror = (e) => {
    if (generation === loadGeneration)
      neuralError(`Neural worker: ${e.message || "could not start"}`);
  };
  worker.onmessage = ({ data }) => {
    if (generation !== loadGeneration) return;
    if (data.type === "progress") {
      $("load-status").dataset.progress = String(data.fraction);
    } else if (data.type === "ready") {
      try {
        neuralView?.dispose();
        neuralView = new NeuralView($("neural-panel"), data.spatial);
      } catch (error) {
        neuralError(error.message);
        return;
      }
      ready = true;
      pending = false;
      enter();
    } else if (data.type === "error") neuralError(data.message);
    else if (data.type === "motor") {
      pending = false;
      queuedMotor = data;
    }
  };
  worker.postMessage({ type: "load" });
}
function setView(view) {
  scene?.setView(view);
  for (const b of document.querySelectorAll("[data-view]"))
    b.setAttribute("aria-pressed", String(b.dataset.view === view));
}
function frame(now) {
  if (scene) {
    if (running && !document.hidden) {
      if (ready) {
        if (queuedMotor) {
          simulation.commitNeural(queuedMotor.rates);
          neuralSeconds = queuedMotor.neuralSeconds;
          neuralView.update(queuedMotor.spikes, neuralSeconds);
          modelMs = queuedMotor.milliseconds;
          queuedMotor = null;
          nextBlock = Math.max(nextBlock + 80, now);
        }
        if (!pending && now >= nextBlock) {
          pending = true;
          worker.postMessage({ type: "step", drive: simulation.sense() });
        }
      }
    }
    const time = simulation.steps * STEP;
    sound?.update(time);
    const visualDt = time - (scene.lastTime ?? time);
    scene.lastTime = time;
    scene.render(simulation.fly, visualDt, time);
    drawMap($("map"), simulation.world, simulation.fly, time);
    if (now - lastStats > 200) {
      lastStats = now;
      const f = simulation.fly,
        w = simulation.world;
      const state = {
        running,
        ready,
        pending,
        view: scene.view,
        elapsed: time,
        neuralSeconds,
        modelMs,
        x: f.x,
        z: f.z,
        heading: f.heading,
        rooms: f.visited.size,
        distance: f.distance,
        stalled: f.stalled,
        tick: w.tick,
        mask: w.mask,
        current: w.current,
        active: w.activeSubset.length,
        walls: w.wallCounts(),
        collisionFree: w.canStand(f.x, f.z),
        bodyBounds: scene.flyBounds,
        entity: w.entity.snapshot(),
      };
      $("world").dataset.state = JSON.stringify(state);
    }
  }
  requestAnimationFrame(frame);
}
$("retry").onclick = () => loadBrain();
$("pause").onclick = () => {
  running = !running;
  updateControls();
};
$("reset").onclick = () => {
  loadGeneration++;
  worker?.terminate();
  worker = null;
  ready = pending = false;
  queuedMotor = null;
  neuralSeconds = 0;
  simulation = new Simulation(source, seed);
  scene.resetWorld(simulation.world);
  loadBrain();
};
$("map-button").onclick = () => {
  const expanded = $("map-button").classList.toggle("expanded");
  $("map-button").setAttribute("aria-expanded", String(expanded));
  $("map-button").setAttribute(
    "aria-label",
    expanded ? "Collapse minimap" : "Expand minimap",
  );
};
for (const b of document.querySelectorAll("[data-view]"))
  b.onclick = () => setView(b.dataset.view);
addEventListener("keydown", (e) => {
  if (!started) return;
  const key = e.key.startsWith("Arrow") ? e.key : e.key.toLowerCase();
  if (key === " ") e.preventDefault();
  if (e.repeat) return;
  if (key === " ") $("pause").click();
  if (key === "m") $("map-button").click();
  if (key === "h") document.body.classList.toggle("hide-ui");
  if (["1", "2", "3"].includes(key))
    setView(["chase", "shoulder", "first"][+key - 1]);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && running) {
    running = false;
    updateControls();
  }
});
let drag = null;
$("world").addEventListener("pointerdown", (e) => {
  if (!scene || scene.view === "first") return;
  drag = { x: e.clientX, orbit: scene.orbit };
  $("world").setPointerCapture(e.pointerId);
});
$("world").addEventListener("pointermove", (e) => {
  if (drag) scene.orbit = drag.orbit + (e.clientX - drag.x) * 0.007;
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  $("world").addEventListener(event, () => {
    drag = null;
  });
$("sound").onclick = () => sound.toggle();
for (const event of ["pointerdown", "keydown"])
  document.addEventListener(
    event,
    (e) => {
      if (!e.target.closest?.("#sound")) sound.unlock();
    },
    { capture: true },
  );

try {
  const response = await fetch(new URL("../floor1.json", import.meta.url));
  if (!response.ok)
    throw Error("The original Floor 1 measurement data could not load.");
  source = await response.json();
  simulation = new Simulation(source, seed);
  scene = new BackroomsScene($("world"), simulation.world, graphicsError);
  requestAnimationFrame(frame);
  await Promise.all([scene.loadFly(), scene.loadEntity()]);
  loadBrain();
} catch (error) {
  graphicsError(error.message);
}
