import { WORLD } from "./level.js";
// Pure spectator calculation. A camera can query collision but cannot mutate
// the observer, the world, the neural input or the simulation random stream.
export function cameraPose(
  body,
  world,
  {
    view = "chase",
    orbit = 0,
    headOffset = { x: 0, y: 0, z: WORLD.bodyLength * 0.45 },
  } = {},
) {
  const forward = { x: Math.sin(body.heading), z: Math.cos(body.heading) };
  const position = { x: body.x, y: body.y, z: body.z };
  const target = { x: body.x + forward.x, y: body.y, z: body.z + forward.z };
  if (view === "first") {
    position.x += forward.x * headOffset.z + forward.z * headOffset.x;
    position.z += forward.z * headOffset.z - forward.x * headOffset.x;
    position.y += headOffset.y;
    target.x = position.x + forward.x;
    target.z = position.z + forward.z;
    target.y = position.y;
  } else if (view !== "reference") {
    const angle =
        body.heading + Math.PI + orbit + (view === "shoulder" ? 0.48 : 0),
      distance = view === "shoulder" ? 0.62 : 0.8;
    const safe = Math.max(
      0.005,
      world.ray(body.x, body.z, angle, distance, { padding: 0.025 }).distance -
        0.025,
    );
    position.x += Math.sin(angle) * safe;
    position.z += Math.cos(angle) * safe;
    position.y = Math.max(
      0.035,
      Math.min(
        WORLD.wallHeight - 0.035,
        body.y + (view === "shoulder" ? 0.15 : 0.22),
      ),
    );
    target.x = body.x + forward.x * 0.35;
    target.z = body.z + forward.z * 0.35;
  }
  return { position, target };
}
