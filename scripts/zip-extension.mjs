import { mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const releaseDir = new URL("../release/", import.meta.url);
const zipFile = new URL("./lazydiff-extension.zip", releaseDir);

await mkdir(releaseDir, { recursive: true });
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
