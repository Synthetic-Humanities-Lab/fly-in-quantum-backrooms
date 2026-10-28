import * as T from "../vendor/three.module.js";
import { CELL, random } from "./maze.js";
// Authored canvas replacements for the public reference's sign motifs. The
// original SVGs are reference material only and are excluded from the release.
export const SIGN_NAMES = [
  "logo",
  "arrows-ahead",
  "confused",
  "safety-starts-here",
  "3d-infinity-way",
  "this-way",
  "no-clip",
  "infinity-way",
  "cctv",
  "question-poster",
  "poster",
  "no-exit-poster",
  "sign4",
  "question-mark",
  "brain-eye",
  "no-exit",
  "no-exit-lightbox",
  "logo-v2",
];
function hash(s) {
  let n = 0;
  for (const c of s) n = ((n << 5) - n + c.charCodeAt(0)) | 0;
  return Math.abs(n);
}
function signTexture(name) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const c = canvas.getContext("2d");
  const rng = random(hash(name));
  c.lineJoin = "round";
  c.lineCap = "round";
  const path = (points) => {
    c.beginPath();
    points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
  };
  const panel = (x, y, w, h, color, r = 8) => {
    c.fillStyle = color;
    c.strokeStyle = "#252521";
    c.lineWidth = 9;
    c.beginPath();
    c.roundRect(x, y, w, h, r);
    c.fill();
    c.stroke();
    c.strokeStyle = "#b9b9a5";
    c.lineWidth = 3;
    c.stroke();
  };
  const text = (label, x, y, size = 50, color = "#e4e4d4") => {
    c.font = `bold ${size}px Arial,sans-serif`;
    c.fillStyle = color;
    c.textAlign = "center";
    c.fillText(label, x, y);
  };
  const arrow = (x, y, angle, length = 90) => {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.fillStyle = "#e9e8da";
    path([
      [0, -9],
      [length - 25, -9],
      [length - 25, -22],
      [length, 0],
      [length - 25, 22],
      [length - 25, 9],
      [0, 9],
    ]);
    c.fill();
    c.restore();
  };
  const infinity = () => {
    c.strokeStyle = "#ececdd";
    c.lineWidth = 27;
    c.beginPath();
    c.moveTo(256, 250);
    c.bezierCurveTo(170, 120, 90, 212, 125, 274);
    c.bezierCurveTo(160, 338, 210, 282, 256, 250);
    c.bezierCurveTo(340, 120, 422, 212, 386, 274);
    c.bezierCurveTo(351, 338, 301, 282, 256, 250);
    c.stroke();
    arrow(248, 226, -2.1, 55);
  };
  if (
    name === "confused" ||
    name === "cctv" ||
    name === "question-mark" ||
    name === "question-poster"
  ) {
    if (name === "question-poster") panel(108, 72, 296, 370, "#506b7d", 0);
    path([
      [256, 82],
      [438, 412],
      [74, 412],
    ]);
    c.fillStyle =
      name === "cctv"
        ? "#c6a64e"
        : name.startsWith("question")
          ? "#4d6e8c"
          : "#dddcd3";
    c.fill();
    c.strokeStyle = "#191b19";
    c.lineWidth = 15;
    c.stroke();
    c.strokeStyle = name === "confused" ? "#9c2729" : "#b1a078";
    c.lineWidth = 10;
    c.stroke();
    if (name === "confused") {
      for (let i = 0; i < 7; i++) {
        c.save();
        c.translate(256, 290);
        c.rotate((i * Math.PI * 2) / 7);
        c.strokeStyle = "#191d1c";
        c.lineWidth = 12;
        c.beginPath();
        c.moveTo(0, 0);
        c.lineTo(0, -95);
        c.stroke();
        path([
          [-18, -68],
          [0, -100],
          [18, -68],
        ]);
        c.fillStyle = "#191d1c";
        c.fill();
        c.restore();
      }
    } else if (name === "cctv") {
      c.save();
      c.translate(255, 280);
      c.rotate(-0.2);
      panel(-65, -30, 126, 60, "#30302a");
      c.fillStyle = "#141713";
      c.beginPath();
      c.ellipse(-60, 0, 12, 23, 0, 0, 7);
      c.fill();
      c.strokeStyle = "#2a2a23";
      c.lineWidth = 15;
      c.beginPath();
      c.moveTo(10, 30);
      c.lineTo(25, 70);
      c.lineTo(65, 70);
      c.stroke();
      c.restore();
    } else text("?", 256, 359, 150);
  } else if (name === "infinity-way" || name === "3d-infinity-way") {
    if (name === "infinity-way") panel(60, 150, 392, 225, "#276442");
    infinity();
  } else if (name === "safety-starts-here" || name === "brain-eye") {
    c.beginPath();
    c.arc(256, 256, 193, 0, Math.PI * 2);
    c.fillStyle = name === "brain-eye" ? "#191e21" : "#e3e4d8";
    c.fill();
    c.strokeStyle = "#182c22";
    c.lineWidth = 12;
    c.stroke();
    c.strokeStyle = "#c8c9ba";
    c.lineWidth = 5;
    c.stroke();
    if (name === "safety-starts-here") {
      c.fillStyle = "#2d6148";
      c.fillRect(201, 110, 110, 90);
      text("✓", 256, 184, 83);
      c.fillRect(105, 220, 302, 145);
      text("Safety", 256, 262, 47);
      text("starts", 256, 310, 47);
      text("here", 256, 358, 47);
    } else {
      c.strokeStyle = "#ccceca";
      c.lineWidth = 9;
      c.beginPath();
      c.ellipse(255, 255, 110, 82, 0, 0, 7);
      c.stroke();
      for (let i = 0; i < 15; i++) {
        c.beginPath();
        const x = 190 + rng() * 130,
          y = 195 + rng() * 120;
        c.moveTo(x, y);
        c.bezierCurveTo(x - 40, y - 20, x + 25, y - 50, x + 28, y + 10);
        c.stroke();
      }
      c.fillStyle = "#141819";
      c.beginPath();
      c.ellipse(256, 232, 42, 25, -0.2, 0, 7);
      c.fill();
      c.stroke();
      c.beginPath();
      c.arc(256, 232, 12, 0, 7);
      c.stroke();
    }
  } else if (name.startsWith("no-exit")) {
    const poster = name === "no-exit-poster";
    panel(
      poster ? 120 : 45,
      poster ? 66 : 172,
      poster ? 272 : 422,
      poster ? 380 : 215,
      "#8c2e27",
      poster ? 0 : 28,
    );
    if (poster) {
      for (let y = 145; y < 420; y += 61) text("NO EXIT", 256, y, 48);
      text("?", 256, 160, 102, "#272721");
      text("?", 256, 465, 102, "#272721");
    } else {
      if (name === "no-exit-lightbox") {
        c.strokeStyle = "#e5cd9c";
        c.lineWidth = 10;
        c.strokeRect(70, 196, 372, 164);
      }
      text("NO EXIT", 256, 315, 80);
    }
  } else if (name === "this-way") {
    panel(120, 75, 272, 360, "#24292b", 7);
    arrow(183, 151, 0, 145);
    c.strokeStyle = "#dcded3";
    c.lineWidth = 15;
    c.strokeRect(194, 194, 116, 167);
    c.fillStyle = "#e2e4da";
    c.beginPath();
    c.arc(260, 220, 18, 0, 7);
    c.fill();
    c.strokeStyle = "#e2e4da";
    c.lineWidth = 17;
    c.beginPath();
    c.moveTo(253, 250);
    c.lineTo(234, 292);
    c.lineTo(278, 352);
    c.moveTo(242, 278);
    c.lineTo(222, 328);
    c.lineTo(192, 328);
    c.moveTo(251, 254);
    c.lineTo(279, 283);
    c.lineTo(307, 283);
    c.moveTo(247, 249);
    c.lineTo(216, 260);
    c.lineTo(201, 290);
    c.stroke();
  } else if (name === "arrows-ahead") {
    panel(93, 116, 326, 277, "#24578a");
    c.strokeStyle = "#ccd4d3";
    c.lineWidth = 2;
    for (const x of [118, 170, 206, 234, 278, 306, 342, 394]) {
      c.beginPath();
      c.moveTo(x, 140);
      c.lineTo(256 + (x - 256) * 0.14, 244);
      c.lineTo(x, 365);
      c.stroke();
    }
    for (let y = 150; y < 245; y += 20) {
      const width = (245 - y) * 0.95;
      c.fillStyle = "#cbdad5";
      c.fillRect(256 - width / 2, y, width, 7);
    }
    arrow(256, 352, -Math.PI / 2, 111);
  } else if (name === "no-clip") {
    panel(86, 77, 340, 370, "#d9bd4f");
    c.fillStyle = "#252728";
    c.fillRect(90, 82, 332, 64);
    text("CAUTION", 256, 130, 43);
    text("ACTIVE NO CLIP AREA", 256, 175, 19, "#181e18");
    for (let i = 4; i >= 0; i--) {
      path([
        [150, 225 + i * 27],
        [232, 190 + i * 27],
        [315, 226 + i * 27],
        [232, 265 + i * 27],
      ]);
      c.fillStyle = "#d3d5c8";
      c.fill();
      c.strokeStyle = "#242923";
      c.lineWidth = 4;
      c.stroke();
      text(`LEVEL ${i + 1}`, 360, 245 + i * 27, 14, "#28291e");
    }
    text("∞", 353, 420, 60, "#20251c");
  } else if (name === "sign4") {
    panel(120, 75, 272, 370, "#484a39", 0);
    c.strokeStyle = "#242a22";
    c.lineWidth = 17;
    c.beginPath();
    c.arc(256, 255, 72, 0, 7);
    c.stroke();
    for (let i = 0; i < 8; i++) {
      c.save();
      c.translate(256, 255);
      c.rotate((i * Math.PI) / 4);
      path([
        [45, 0],
        [104, -28],
        [78, 35],
      ]);
      c.fillStyle = "#272d24";
      c.fill();
      c.restore();
    }
    text("✚", 256, 278, 70, "#a0a18a");
  } else {
    if (name === "poster") panel(100, 60, 312, 392, "#c7c7b9", 0);
    path([
      [256, 88],
      [415, 180],
      [415, 355],
      [256, 446],
      [97, 355],
      [97, 180],
    ]);
    c.fillStyle = "#303537";
    c.fill();
    c.strokeStyle = "#171d1c";
    c.lineWidth = 13;
    c.stroke();
    c.save();
    c.translate(256, 266);
    c.scale(1, 0.62);
    c.rotate(Math.PI / 4);
    c.strokeStyle = "#aaa99a";
    c.lineWidth = 6;
    for (let i = 1; i < 7; i++) {
      let d = i * 23;
      c.beginPath();
      c.moveTo(-d, -d);
      c.lineTo(d, -d);
      c.lineTo(d, d);
      c.lineTo(-d, d);
      c.lineTo(-d, -d + 25);
      c.stroke();
    }
    c.restore();
    if (name === "poster") text("?", 343, 410, 110, "#272d29");
  }
  // Wear is restricted to the printed surface, with scuffs and thin scratches.
  c.save();
  c.globalCompositeOperation = "source-atop";
  for (let i = 0; i < 1800; i++) {
    const x = rng() * 512,
      y = rng() * 512;
    c.fillStyle = rng() < 0.5 ? "#dedccd55" : "#28271f44";
    c.fillRect(x, y, 1 + rng() * 7, 1 + rng() * 9);
  }
  c.lineWidth = 0.8;
  c.strokeStyle = "#c8c3a455";
  for (let i = 0; i < 25; i++) {
    const x = rng() * 512,
      y = rng() * 512;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + (rng() - 0.5) * 120, y + rng() * 90);
    c.stroke();
  }
  c.restore();
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return tex;
}
export function createWallSigns(scene, edges) {
  const textures = SIGN_NAMES.map(signTexture),
    entries = new Map();
  return {
    reset() {
      for (const { mesh } of entries.values())
        if (mesh) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          mesh.material.dispose();
        }
      entries.clear();
    },
    update(world, time, wallMeshes) {
      world.edges.forEach((e, i) => {
        const id = e.id.replaceAll("-", "_");
        let entry = entries.get(e.id);
        if (!entry) {
          entry = { cycle: 0, state: null, mesh: null, start: time };
          entries.set(e.id, entry);
        }
        if (entry.state !== e.state) {
          if (entry.state === "wall" && entry.mesh) {
            scene.remove(entry.mesh);
            entry.mesh.geometry.dispose();
            entry.mesh.material.dispose();
            entry.mesh = null;
          }
          if (e.state === "wall") entry.cycle++;
          entry.state = e.state;
          entry.start = time;
        }
        const eligible =
          e.state === "wall" && wallMeshes[i].material.opacity > 0.9;
        if (
          eligible &&
          !entry.mesh &&
          (hash(id + "_sign_" + entry.cycle) % 1000) / 1000 < 0.45
        ) {
          const index = hash(id + "_sign_idx_" + entry.cycle) % textures.length;
          const mesh = new T.Mesh(
            new T.PlaneGeometry(0.15 * CELL, 0.15 * CELL),
            new T.MeshBasicMaterial({
              map: textures[index],
              transparent: true,
              side: T.DoubleSide,
              depthWrite: false,
              opacity: 0,
            }),
          );
          mesh.position.set(e.x, 1.02, e.z);
          if ((hash(id + "_offset_" + entry.cycle) % 1000) / 1000 < 0.7) {
            const offset =
              ((hash(id + "_offX_" + entry.cycle) % 1000) / 500 - 1) *
              CELL *
              0.3;
            if (e.vertical) mesh.position.z += offset;
            else mesh.position.x += offset;
            mesh.position.y +=
              ((hash(id + "_offY_" + entry.cycle) % 1000) / 500 - 1) *
              1.7 *
              0.3 *
              0.5;
          }
          if (e.vertical) {
            mesh.position.x += 0.165;
            mesh.rotation.y = Math.PI / 2;
          } else mesh.position.z += 0.165;
          scene.add(mesh);
          entry.mesh = mesh;
          entry.start = time;
        }
        if (entry.mesh) {
          entry.mesh.visible = eligible;
          entry.mesh.material.opacity = Math.max(
            0,
            Math.min(1, (time - entry.start - 0.5) / 0.7),
          );
        }
      });
    },
  };
}
