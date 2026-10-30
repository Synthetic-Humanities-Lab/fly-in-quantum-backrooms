import test from "node:test";
import assert from "node:assert/strict";
import { AudioController } from "../src/audio-controller.js";
function fixture(blocked = false) {
  let permitted = !blocked,
    listener = () => {},
    changes = [];
  const audio = {
    context: {
      state: "suspended",
      addEventListener: (_, fn) => {
        listener = fn;
      },
    },
    async setRunning(active) {
      this.active = active;
      this.context.state = active && permitted ? "running" : "suspended";
      listener();
    },
    update() {},
  };
  const controller = new AudioController(
    (s) => changes.push(s),
    () => audio,
  );
  return {
    controller,
    audio,
    changes,
    allow: () => {
      permitted = true;
    },
  };
}
test("sound defaults on, follows pause and does not require the sound toggle", () => {
  const { controller: c, audio } = fixture();
  c.setRunning(true);
  assert.equal(audio.context.state, "running");
  c.setRunning(false);
  assert.equal(audio.context.state, "suspended");
  assert.equal(c.enabled, true);
  c.setRunning(true);
  assert.equal(audio.context.state, "running");
});
test("blocked autoplay is honestly labelled and the next gesture unlocks it", () => {
  const { controller: c, audio, allow } = fixture(true);
  c.setRunning(true);
  assert.equal(c.snapshot().label, "Enable sound");
  allow();
  c.unlock();
  assert.equal(audio.context.state, "running");
  assert.equal(c.snapshot().label, "Sound on");
  audio.context.state = "interrupted";
  c.toggle();
  assert.equal(c.enabled, true);
  assert.equal(audio.context.state, "running");
});
test("explicit mute survives gestures, pause and restart", () => {
  const { controller: c, audio } = fixture();
  c.setRunning(true);
  c.toggle();
  c.unlock();
  c.setRunning(false);
  c.setRunning(true);
  assert.equal(c.enabled, false);
  assert.equal(audio.active, false);
  assert.equal(c.snapshot().label, "Sound off");
});
