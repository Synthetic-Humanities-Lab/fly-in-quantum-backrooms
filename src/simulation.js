import { WorldState, MAZE_TICK } from "./maze.js";
import { Flight } from "./flight.js";
export const STEP = 0.02,
  NEURAL_BLOCK_STEPS = 4;
export class Simulation {
  constructor(data, seed = 2106) {
    this.world = new WorldState(data, seed);
    this.fly = new Flight(this.world.spawn);
    this.steps = 0;
    this.neuralBlocks = 0;
  }
  sense() {
    return this.fly.sense(this.world);
  }
  advance() {
    this.fly.step(STEP, this.world);
    this.steps++;
    // Integer step count prevents drift between 20ms body and 200ms maze clocks.
    if (this.steps % Math.round(MAZE_TICK / STEP) === 0)
      this.world.resample(this.fly, { protectBody: true });
    this.world.entity.step(STEP, this.world);
  }
  commitNeural(rates) {
    this.fly.setNeural(rates);
    for (let i = 0; i < NEURAL_BLOCK_STEPS; i++) this.advance();
    this.neuralBlocks++;
  }
  snapshot() {
    return {
      world: this.world.snapshot(),
      entity: this.world.entity.snapshot(),
      body: {
        x: this.fly.x,
        z: this.fly.z,
        y: this.fly.y,
        heading: this.fly.heading,
        elapsed: this.steps * STEP,
      },
      sensory: this.fly.drive,
    };
  }
}
