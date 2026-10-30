import { AmbientAudio } from "./ambient-audio.js";

export class AudioController {
  constructor(onChange, create = () => new AmbientAudio()) {
    this.onChange = onChange;
    this.create = create;
    this.enabled = true;
    this.running = false;
    this.audio = null;
    this.failed = false;
  }
  snapshot() {
    const state = this.audio?.context.state ?? "suspended";
    return {
      enabled: this.enabled,
      state,
      label: this.failed
        ? "Audio unavailable"
        : !this.enabled
          ? "Sound off"
          : this.running && state !== "running"
            ? "Enable sound"
            : "Sound on",
    };
  }
  sync() {
    try {
      if (!this.audio && this.enabled && this.running) {
        this.audio = this.create();
        this.audio.context.addEventListener("statechange", () =>
          this.onChange(this.snapshot()),
        );
      }
      this.audio?.setRunning(this.enabled && this.running).catch(() => {
        this.failed = true;
        this.onChange(this.snapshot());
      });
    } catch {
      this.failed = true;
    }
    this.onChange(this.snapshot());
  }
  setRunning(running) {
    this.running = running;
    this.sync();
  }
  unlock() {
    if (this.enabled && this.running) this.sync();
  }
  toggle() {
    // A blocked autoplay attempt needs a gesture, not an accidental mute.
    if (
      this.enabled &&
      this.running &&
      this.audio?.context.state !== "running"
    )
      this.unlock();
    else {
      this.enabled = !this.enabled;
      this.sync();
    }
  }
  update(time) {
    this.audio?.update(time);
  }
}
