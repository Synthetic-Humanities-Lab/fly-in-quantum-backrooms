import * as T from "../vendor/three.module.js";
import { GLTFLoader } from "../vendor/GLTFLoader.js";

export async function loadEntity(scene) {
  const { scene: model } = await new GLTFLoader().loadAsync(
    new URL("../assets/cleanroom-reconstruction.glb", import.meta.url).href,
  );
  scene.add(model);
  const joints = Object.fromEntries(
    [
      "Torso",
      "Head",
      "ArmL",
      "ArmR",
      "ForearmL",
      "ForearmR",
      "LegL",
      "LegR",
      "ShinL",
      "ShinR",
    ].map((name) => {
      const joint = model.getObjectByName(name);
      if (!joint) throw Error(`Entity model is missing ${name}.`);
      return [name, joint];
    }),
  );
  const shadow = new T.Mesh(
    new T.CircleGeometry(0.22, 24),
    new T.MeshBasicMaterial({
      color: 0x15130b,
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);
  return {
    update(entity) {
      // Distance-driven authored gait freezes with the simulation clock.
      const phase = entity.distance * 9,
        swing = Math.sin(phase);
      model.position.set(entity.x, Math.abs(swing) * 0.009, entity.z);
      model.rotation.y = entity.heading;
      joints.Torso.rotation.x = 0.13;
      joints.Torso.rotation.z = swing * 0.025;
      joints.Head.rotation.y = Math.sin(entity.elapsed * 0.37) * 0.13;
      for (const [side, sign] of [
        ["L", 1],
        ["R", -1],
      ]) {
        joints["Leg" + side].rotation.x = swing * sign * 0.32;
        joints["Shin" + side].rotation.x = Math.max(0, -swing * sign) * 0.55;
        joints["Arm" + side].rotation.x = -0.3 - swing * sign * 0.25;
        joints["Forearm" + side].rotation.x =
          -0.4 - Math.max(0, swing * sign) * 0.25;
      }
      shadow.position.set(entity.x, 0.006, entity.z);
    },
  };
}
