import { readdir, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
for (const dir of ["src", "scripts", "tests"])
  for (const file of await readdir(dir))
    if (/\.(m?js)$/.test(file))
      execFileSync(process.execPath, ["--check", `${dir}/${file}`]);
const manifest = JSON.parse(
  await readFile("public/model/manifest.json", "utf8"),
);
for (const [name, spec] of Object.entries(manifest.arrays)) {
  const hash = createHash("sha256");
  let length = 0;
  for (const p of spec.parts) {
    const b = await readFile(`public/model/${p.file}`);
    if (createHash("sha256").update(b).digest("hex") !== p.sha256)
      throw Error(`Checksum mismatch: ${p.file}`);
    const raw = gunzipSync(b);
    hash.update(raw);
    length += raw.length;
  }
  if (hash.digest("hex") !== spec.sha256 || length !== spec.length * 4)
    throw Error(`Lossless array mismatch: ${name}`);
}
for (const path of [
  "index.html",
  "style.css",
  ...(await readdir("src"))
    .filter((p) => p.endsWith(".js"))
    .map((p) => "src/" + p),
  "public/floor1.json",
]) {
  const text = await readFile(path, "utf8");
  if (/\/Users\/|sk-proj-|Bearer\s+[A-Za-z0-9]|crn:v1:/.test(text))
    throw Error(`Private release content in ${path}`);
}
console.log("JavaScript syntax, model hashes and public-source scan passed.");
