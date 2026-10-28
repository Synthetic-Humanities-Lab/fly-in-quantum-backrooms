import * as T from "../vendor/three.module.js";
import { random } from "./maze.js";
// Independently drawn replacements; no Moth texture files are redistributed.
export function surfaceTexture(kind) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height =
    kind === "wall" ? 512 : kind === "carpet" ? 200 : 128;
  const n = canvas.width,
    c = canvas.getContext("2d"),
    rng = random(713);
  c.fillStyle =
    kind === "wall" ? "#99976b" : kind === "carpet" ? "#5a3d15" : "#d4aa40";
  c.fillRect(0, 0, n, n);
  if (kind === "ceiling") {
    c.strokeStyle = "rgba(0,0,0,.15)";
    c.lineWidth = 2;
    c.strokeRect(2, 2, 124, 124);
  } else {
    const pixels = c.getImageData(0, 0, n, n);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const noise = (rng() - 0.5) * (kind === "carpet" ? 35 : 16);
      const fiber = kind === "carpet" && rng() < 0.2 ? -(15 + 20 * rng()) : 0;
      pixels.data[i] += noise + fiber + (rng() - 0.5) * 8;
      pixels.data[i + 1] += noise + fiber;
      pixels.data[i + 2] += noise + fiber - (kind === "carpet" ? 8 : 0);
    }
    c.putImageData(pixels, 0, 0);
    if (kind === "wall") {
      c.lineWidth = 0.7;
      c.strokeStyle = "rgba(65,75,37,.3)";
      for (let x = -16; x < n + 16; x += 32) {
        for (const offset of [-8, -6, 6, 8]) {
          c.beginPath();
          c.moveTo(x + offset, 0);
          c.lineTo(x + offset, n);
          c.stroke();
        }
        for (let y = -12; y < n + 32; y += 32) {
          for (const offset of [0, 8]) {
            c.fillStyle = "rgba(65,75,37,.42)";
            c.beginPath();
            c.moveTo(x - 6, y + 15 + offset);
            c.lineTo(x, y + offset);
            c.lineTo(x + 6, y + 15 + offset);
            c.lineTo(x, y + 7 + offset);
            c.closePath();
            c.fill();
          }
          c.fillStyle = "rgba(65,75,37,.3)";
          c.fillRect(x - 0.6, y + 24, 1.2, 7);
        }
      }
    }
  }
  const tex = new T.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.anisotropy = 8;
  if (kind === "wall") {
    tex.colorSpace = T.SRGBColorSpace;
    tex.repeat.set(3, 1.5);
  } else
    tex.repeat.set(kind === "carpet" ? 36 : 120, kind === "carpet" ? 36 : 120);
  return tex;
}
