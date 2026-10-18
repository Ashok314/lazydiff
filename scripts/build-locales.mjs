import { readFile, writeFile } from "node:fs/promises";

const locales = {};
for (const language of ["en", "ja"]) {
  locales[language] = JSON.parse(
    await readFile(new URL(`../_locales/${language}/messages.json`, import.meta.url), "utf8")
  );
}

await writeFile(
  new URL("../dist/locales.js", import.meta.url),
  `const LAZYDIFF_LOCALES = ${JSON.stringify(locales)};\n`
);
