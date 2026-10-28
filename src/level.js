// Public main First Person / Floor 1 / Hard configuration, inspected 2026-10-23.
// World units are the reference renderer's units divided by ten.
export const WORLD = Object.freeze({
  cell: 5.31,
  wallHeight: 1.7,
  wallThickness: 0.3,
  humanEyeHeight: 0.9,
  cameraFov: 70,
  tickSeconds: 0.2,
  observationRange: 2,
  observationHalfAngle: Math.PI / 4.4,
  peripheralAngle: 0.35,
  wallRelaxation: 0,
  fogDensity: 3.9 / (5.31 * 3),
  bodyLength: 5.31 * 0.01,
});
export const FLOOR1_PROVENANCE = Object.freeze({
  url: "https://backrooms.mothquantum.com/levels/iqm-level-1.json",
  sha256: "9a67b83caea132e74dad104ac5f84c11b2d5e79d8284b41d7ed9a5d47d89f2d6",
  client: "dpl_9ZncUQFsQuGY4Zu6KuFQXBE2NJBL",
  mode: "First Person (fpnew), Floor 1, Hard",
  accessed: "2026-10-23",
});
export function normalizeRecords(records) {
  const total = records.reduce((s, r) => s + r.probability, 0);
  if (!(total > 0) || !Number.isFinite(total))
    throw Error("Invalid measurement weights.");
  return records.map((r) => ({ ...r, probability: r.probability / total }));
}
export class LevelDefinition {
  constructor(data) {
    if (
      data.name !== "level_1_final_iqm" ||
      data.grid_size?.rows !== 6 ||
      data.grid_size?.cols !== 6 ||
      data.num_qubits !== 36
    )
      throw Error("Expected the original 6 × 6 Floor 1 dataset.");
    const records = data.results?.measurements;
    if (
      !Array.isArray(records) ||
      records.length !== 16 ||
      records.some(
        (r) =>
          !/^[01]{36}$/.test(r.bitstring) ||
          !(r.probability > 0) ||
          !Number.isFinite(r.probability),
      )
    )
      throw Error("Invalid Floor 1 measurement records.");
    if (
      !Array.isArray(data.coupling_map) ||
      data.coupling_map.length !== 60 ||
      data.coupling_map.some(
        ([a, b]) =>
          !Number.isInteger(a) ||
          !Number.isInteger(b) ||
          a < 0 ||
          b >= 36 ||
          !(
            b === a + 6 ||
            (b === a + 1 && Math.floor(a / 6) === Math.floor(b / 6))
          ),
      )
    )
      throw Error("Invalid Floor 1 coupling map.");
    this.source = data;
    this.rows = 6;
    this.cols = 6;
    this.settings = WORLD;
    this.provenance = FLOOR1_PROVENANCE;
    this.records = normalizeRecords(records);
    this.couplings = data.coupling_map.map((pair) => [...pair]);
    this.zExpectations = data.results.z_expectations;
    this.zzCouplings = data.results.zz_couplings;
    this.radiatingRooms = Object.entries(data.initial_states)
      .filter(([, v]) => v.radiating)
      .map(([i]) => +i);
    // Explicit inhabitant adaptation requested 2026-10-27; no QPS trigger.
    this.entities = Object.freeze({
      ghost: "wandering-from-start",
      targeting: false,
      attacks: false,
    });
    this.objects = Object.freeze({
      qps: true,
      almondWaterCount: 0,
      visor: false,
      stairsVisible: false,
    });
  }
}
