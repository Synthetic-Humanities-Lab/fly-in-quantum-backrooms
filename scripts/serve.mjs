import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
const root = resolve(process.argv.includes("--dist") ? "dist" : ".");
const port = Number(process.env.PORT || 4457);
const types = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".css": "text/css",
  ".glb": "model/gltf-binary",
  ".bin": "application/octet-stream",
  ".txt": "text/plain",
};
http
  .createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
    } catch {
      res.writeHead(400).end();
      return;
    }
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    let file = resolve(root, relative);
    if (!file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!existsSync(file) && !process.argv.includes("--dist"))
      file = resolve(root, "public", relative);
    if (!existsSync(file) || !statSync(file).isFile()) {
      res.writeHead(404).end("Not found");
      return;
    }
    const stats = statSync(file);
    const etag = `W/"${stats.size}-${stats.mtimeMs}"`;
    if (req.headers["if-none-match"] === etag) {
      res.writeHead(304, { ETag: etag, "Cache-Control": "no-cache" }).end();
      return;
    }
    res.writeHead(200, {
      "Content-Type": types[extname(file)] || "application/octet-stream",
      "Content-Length": stats.size,
      ETag: etag,
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    createReadStream(file).pipe(res);
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`Fly Backrooms: http://127.0.0.1:${port}`),
  );
