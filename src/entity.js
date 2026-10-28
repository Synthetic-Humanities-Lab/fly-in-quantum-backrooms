import { WORLD } from "./level.js";

export const ENTITY = Object.freeze({
  height: 1.25,
  radius: 0.18,
  speed: 0.48,
});

// Authored inhabitant behavior. The original hunts a player; this walker has
// no player/camera input and never consumes the maze's random sequence.
export class WanderingEntity {
  constructor(spawn, rng) {
    this.rng = rng;
    // Start across the floor, outside the opening spectator views. This is
    // placement only: neither the walk nor visibility is camera-triggered.
    const spawnCol = Math.floor(spawn.x / WORLD.cell);
    this.x = (spawnCol < 3 ? 5.5 : 0.5) * WORLD.cell;
    this.z = WORLD.cell / 2;
    this.heading = Math.PI / 2;
    this.distance = 0;
    this.elapsed = 0;
    this.previousRoom = -1;
    this.destination = null;
    this.wait = 1;
  }
  chooseDestination(world) {
    const room = world.room(this.x, this.z);
    const adjacent = world.edges.filter(
      (e) => !e.boundary && (e.a === room || e.b === room),
    );
    const open = adjacent.filter((e) => e.state === "open");
    // Like the original apparition's blocked-route fallback, it can pass
    // through walls. It never holds a wall open or changes an observation.
    let choices = open.length ? open : adjacent;
    const onward = choices.filter(
      (e) => (e.a === room ? e.b : e.a) !== this.previousRoom,
    );
    if (onward.length) choices = onward;
    const edge = choices[Math.floor(this.rng() * choices.length)];
    const next = edge.a === room ? edge.b : edge.a;
    this.previousRoom = room;
    this.destination = {
      x: ((next % 6) + 0.5) * WORLD.cell,
      z: (Math.floor(next / 6) + 0.5) * WORLD.cell,
    };
  }
  step(dt, world) {
    this.elapsed += dt;
    if (this.wait > 0) {
      this.wait -= dt;
      return;
    }
    if (!this.destination) this.chooseDestination(world);
    const dx = this.destination.x - this.x,
      dz = this.destination.z - this.z,
      remaining = Math.hypot(dx, dz);
    const travel = Math.min(remaining, dt * ENTITY.speed);
    if (remaining > 0) {
      const targetHeading = Math.atan2(dx, dz);
      const difference = Math.atan2(
        Math.sin(targetHeading - this.heading),
        Math.cos(targetHeading - this.heading),
      );
      this.heading += difference * (1 - Math.exp(-dt * 5));
      this.x += (dx / remaining) * travel;
      this.z += (dz / remaining) * travel;
      this.distance += travel;
    }
    if (remaining <= travel) {
      this.destination = null;
      this.wait = 0.4 + this.rng() * 1.6;
    }
  }
  // A local, height-bounded visual proxy, clipped by the nearer maze ray.
  // This apparition is not a physical collider and cannot hurt the fly.
  ray(x, y, z, heading, limit) {
    if (y < 0 || y > ENTITY.height) return limit;
    const dx = this.x - x,
      dz = this.z - z;
    const along = dx * Math.sin(heading) + dz * Math.cos(heading);
    const across = dx * Math.cos(heading) - dz * Math.sin(heading);
    if (Math.abs(across) > ENTITY.radius) return limit;
    const half = Math.sqrt(ENTITY.radius ** 2 - across ** 2);
    if (along + half < 0) return limit;
    return Math.min(limit, Math.max(0, along - half));
  }
  snapshot() {
    return {
      x: this.x,
      z: this.z,
      heading: this.heading,
      elapsed: this.elapsed,
      distance: this.distance,
      destination: this.destination && { ...this.destination },
      wait: this.wait,
    };
  }
}
