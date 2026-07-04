import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const releaseDir = new URL("../release/", import.meta.url);
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const zipFileName = `${packageJson.name}-extension-v${packageJson.version}.zip`;
const zipFile = new URL(`./${zipFileName}`, releaseDir);

await mkdir(releaseDir, { recursive: true });
for (const file of await readdir(releaseDir)) {
  if (/^lazydiff-extension.*\.zip$/.test(file)) {
    await rm(new URL(`./${file}`, releaseDir), { force: true });
  }
}
await rm(zipFile, { force: true });

const result = spawnSync("zip", ["-r", zipFile.pathname, "."], {
  cwd: new URL("../extension/", import.meta.url),
  encoding: "utf8"
});

if (result.status !== 0) {
  process.stderr.write(result.stderr);
  process.stdout.write(result.stdout);
  process.exit(result.status || 1);
}

process.stdout.write(`Created ${zipFile.pathname}\n`);
