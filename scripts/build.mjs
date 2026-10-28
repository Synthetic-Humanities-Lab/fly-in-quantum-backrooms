import { cp, mkdir, rm, writeFile } from "node:fs/promises";
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const file of ["index.html", "style.css", "src"])
  await cp(file, `dist/${file}`, {
    recursive: true,
    filter: (path) => !path.endsWith("reference.js"),
  });
await cp("public", "dist", {
  recursive: true,
  filter: (path) => path !== "public/maze.json",
});
await writeFile("dist/.nojekyll", "");
console.log("Built self-contained static site in dist/.");
