import { CELL } from "./maze.js";
import { MAP_VIEW, wrap } from "./vision.js";
export function drawMap(canvas, world, observer, time) {
  const c = canvas.getContext("2d"),
    n = canvas.width;
  // Match the reference's 354px drawing surface clipped by its 252px wrapper.
  const unit = (n / 252) * 59,
    center = 3 * unit,
    scale = unit / CELL;
  const x = center,
    z = center,
    angle = Math.PI / 2 - observer.heading;
  c.clearRect(0, 0, n, n);
  c.fillStyle = "#17160e";
  c.fillRect(0, 0, n, n);
  c.save();
  c.translate(x - observer.x * scale, z - observer.z * scale);
  const ox = observer.x * scale,
    oz = observer.z * scale;
  c.beginPath();
  c.moveTo(ox, oz);
  c.arc(
    ox,
    oz,
    unit,
    angle - MAP_VIEW.halfAngle - 0.35,
    angle + MAP_VIEW.halfAngle + 0.35,
  );
  c.closePath();
  const light = c.createRadialGradient(ox, oz, 0, ox, oz, unit);
  light.addColorStop(0, "#66623955");
  light.addColorStop(1, "#77723a22");
  c.fillStyle = light;
  c.fill();
  // The reference keeps a faint room grid and the fixed outer boundary visible,
  // even when no settled internal wall lies inside the observer's map cone.
  c.strokeStyle = "rgba(223,215,138,0.09)";
  c.lineWidth = (0.5 * n) / 252;
  for (let row = 0; row <= world.level.rows; row++) {
    c.beginPath();
    c.moveTo(0, row * unit);
    c.lineTo(world.level.cols * unit, row * unit);
    c.stroke();
  }
  for (let col = 0; col <= world.level.cols; col++) {
    c.beginPath();
    c.moveTo(col * unit, 0);
    c.lineTo(col * unit, world.level.rows * unit);
    c.stroke();
  }
  c.save();
  c.strokeStyle = "rgba(255,238,100,0.35)";
  c.lineWidth = (2.5 * n) / 252;
  c.shadowColor = "#ffee66";
  c.shadowBlur = (8 * n) / 252;
  c.strokeRect(0, 0, world.level.cols * unit, world.level.rows * unit);
  c.restore();
  const qx = (world.qps.col + 0.5) * unit,
    qz = (world.qps.row + 0.5) * unit;
  const pulse = 0.5 + 0.5 * Math.sin(time / 0.3);
  c.fillStyle = `rgba(40,255,120,${0.08 + 0.07 * pulse})`;
  c.fillRect(qx - unit / 2, qz - unit / 2, unit, unit);
  c.save();
  c.shadowColor = "#28ff78";
  c.shadowBlur = ((10 + 10 * pulse) * n) / 252;
  const h = 0.55 * unit,
    w = 0.48 * h;
  c.fillStyle = "#0a1f0e";
  c.strokeStyle = `rgba(40,255,120,${0.7 + 0.3 * pulse})`;
  c.lineWidth = (1.5 * n) / 252;
  c.beginPath();
  c.roundRect(qx - w / 2, qz - h / 2, w, h, 0.18 * w);
  c.fill();
  c.stroke();
  c.strokeRect(qx - w * 0.34, qz - h * 0.37, w * 0.68, h * 0.62);
  c.beginPath();
  c.arc(qx, qz + h * 0.35, w * 0.07, 0, Math.PI * 2);
  c.stroke();
  c.restore();
  for (const e of world.edges) {
    const dx = e.x - observer.x,
      dz = e.z - observer.z;
    const a = Math.abs(wrap(Math.atan2(dx, dz) - observer.heading));
    const inRange = Math.hypot(dx, dz) <= MAP_VIEW.depth,
      full = inRange && a < MAP_VIEW.halfAngle,
      observed = inRange && a < MAP_VIEW.halfAngle + 0.35;
    const age =
        e.changedAt > 0
          ? Math.max(0, Math.min(1, (time - e.changedAt) / 0.5))
          : 1,
      eased = age < 0.5 ? 4 * age ** 3 : 1 - (-2 * age + 2) ** 3 / 2,
      fade = full ? 1 : eased;
    const startX = (e.x - (e.vertical ? 0 : CELL / 2)) * scale,
      startZ = (e.z - (e.vertical ? CELL / 2 : 0)) * scale,
      endX = (e.x + (e.vertical ? 0 : CELL / 2)) * scale,
      endZ = (e.z + (e.vertical ? CELL / 2 : 0)) * scale,
      pixel = n / 252;
    c.save();
    const stroke = (width, color, dash = [], offsetX = 0, offsetZ = 0) => {
      c.strokeStyle = color;
      c.lineWidth = width * pixel;
      c.setLineDash(dash.map((v) => v * pixel));
      c.beginPath();
      c.moveTo(startX + offsetX * pixel, startZ + offsetZ * pixel);
      c.lineTo(endX + offsetX * pixel, endZ + offsetZ * pixel);
      c.stroke();
    };
    if (e.state === "wall" && observed) {
      c.globalAlpha = (1 - 0.7 * e.entropy) * fade;
      c.lineCap = "square";
      c.shadowColor = "#fff7b0";
      c.shadowBlur = full ? 8 * pixel : 0;
      stroke(full ? 4 : 3, full ? "#fff8b4" : "#dfd78a");
    } else if (e.state === "superposition") {
      // Source-style two-pass flicker, on simulation time only. This phase is
      // presentation state: it consumes no maze RNG and never collapses a wall.
      const phase =
        (0.8 * time + 0.037 * (e.row * 10 + e.col) + (e.vertical ? 0.5 : 0)) %
        1;
      c.globalAlpha = observed ? 1 : 0.5;
      if (phase > 0.4 && phase < 0.55) {
        stroke(3, `rgba(255,248,180,${0.85 * fade})`);
      } else if (phase % 0.2 < 0.14) {
        const jitterX = 3 * Math.sin(phase * Math.PI * 7),
          jitterZ = 2.5 * Math.cos(phase * Math.PI * 5),
          strength =
            (0.3 + 0.5 * Math.abs(Math.sin(phase * Math.PI * 3))) * fade;
        c.lineCap = "round";
        c.lineDashOffset = 20 * phase * pixel;
        stroke(
          8,
          `rgba(223,215,138,${0.25 * strength})`,
          [2, 4],
          jitterX,
          jitterZ,
        );
        c.lineDashOffset = 12 * phase * pixel;
        stroke(
          1.5,
          `rgba(255,248,180,${strength})`,
          [1, 3],
          0.4 * jitterX,
          0.4 * jitterZ,
        );
      }
    } else if (e.state === "open" && e.prevState === "wall" && fade < 1) {
      stroke(2, `rgba(223,215,138,${0.55 * (1 - (1 - fade) ** 4)})`, [3, 5]);
    }
    c.restore();
  }
  // The source renders active ghosts independently of the observation cone.
  // Canvas clipping alone determines whether this local map includes the entity.
  if (world.entity) {
    const pulse = 0.5 + 0.5 * Math.sin(time / 0.15),
      pixel = n / 252;
    c.save();
    c.shadowColor = "#ff0033";
    c.shadowBlur = (20 + 15 * pulse) * pixel;
    c.fillStyle = `rgba(255,68,102,${0.6 + 0.3 * pulse})`;
    c.beginPath();
    c.arc(
      world.entity.x * scale,
      world.entity.z * scale,
      (10 + 3 * pulse) * pixel,
      0,
      2 * Math.PI,
    );
    c.fill();
    c.fillStyle = "#ff4466";
    c.font = `bold ${12 * pixel}px monospace`;
    c.textAlign = "center";
    c.fillText("Ψ", world.entity.x * scale, world.entity.z * scale + 4 * pixel);
    c.restore();
  }
  c.shadowBlur = 0;
  c.setLineDash([(3 * n) / 252, (5 * n) / 252]);
  c.strokeStyle = "rgba(223,215,138,.15)";
  c.lineWidth = n / 252;
  for (const side of [-1, 1]) {
    c.beginPath();
    c.moveTo(ox, oz);
    c.lineTo(
      ox + Math.cos(angle + side * MAP_VIEW.halfAngle) * unit,
      oz + Math.sin(angle + side * MAP_VIEW.halfAngle) * unit,
    );
    c.stroke();
  }
  c.setLineDash([]);
  c.shadowColor = "#dfd78a";
  c.shadowBlur = (12 * n) / 252;
  c.fillStyle = "#d8dc8f";
  c.beginPath();
  c.arc(ox, oz, (8 * n) / 252, 0, 2 * Math.PI);
  c.fill();
  c.lineWidth = (2 * n) / 252;
  c.strokeStyle = "#f5f0bd";
  c.beginPath();
  c.moveTo(ox, oz);
  c.lineTo(
    ox + (Math.cos(angle) * 14 * n) / 252,
    oz + (Math.sin(angle) * 14 * n) / 252,
  );
  c.stroke();
  const row = Math.floor(observer.z / CELL),
    col = Math.floor(observer.x / CELL);
  if (world.isRadiating(observer)) {
    const pulse = 0.5 + 0.5 * Math.sin((time * Math.PI) / 0.4),
      intensity = pulse * pulse,
      alpha = 0.18 + 0.52 * intensity;
    c.save();
    c.globalCompositeOperation = "screen";
    c.shadowColor = `rgba(163,117,191,${0.9 * alpha})`;
    c.shadowBlur = ((22 + 28 * intensity) * n) / 252;
    c.fillStyle = `rgba(163,117,191,${alpha})`;
    c.fillRect(col * unit, row * unit, unit, unit);
    if (intensity > 0.7) {
      c.fillStyle = `rgba(220,180,255,${((intensity - 0.7) / 0.3) * 0.35})`;
      c.fillRect(col * unit, row * unit, unit, unit);
    }
    c.restore();
  }
  c.restore();
}
