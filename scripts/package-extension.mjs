import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const outputDir = new URL("../extension/", import.meta.url);
const outputDistDir = new URL("./dist/", outputDir);
const outputIconsDir = new URL("./icons/", outputDir);

await rm(outputDir, { force: true, recursive: true });
await mkdir(outputDistDir, { recursive: true });
await mkdir(outputIconsDir, { recursive: true });

const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url), "utf8"));
manifest.content_scripts = manifest.content_scripts.map((script) => ({
  ...script,
  css: ["content.css"]
}));

await writeFile(new URL("./manifest.json", outputDir), `${JSON.stringify(manifest, null, 2)}\n`);
await copyFile(new URL("../src/content.css", import.meta.url), new URL("./content.css", outputDir));
await copyFile(new URL("../popup.html", import.meta.url), new URL("./popup.html", outputDir));
await copyFile(new URL("../popup.css", import.meta.url), new URL("./popup.css", outputDir));

for (const file of ["icon-16.png", "icon-32.png", "icon-48.png", "icon-128.png"]) {
  await copyFile(new URL(`../assets/icons/${file}`, import.meta.url), new URL(`./icons/${file}`, outputDir));
}

for (const file of ["types.js", "core.js", "storage.js", "github.js", "content.js"]) {
  await copyFile(new URL(`../dist/${file}`, import.meta.url), new URL(`./dist/${file}`, outputDir));
}
