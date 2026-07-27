const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "assets", "pets", "radiance-butterfly");
const petsRoot = process.env.CODEX_HOME
  ? path.join(process.env.CODEX_HOME, "pets")
  : path.join(os.homedir(), ".codex", "pets");
const destination = path.join(petsRoot, "radiance-butterfly");

fs.mkdirSync(destination, { recursive: true });
for (const name of ["pet.json", "spritesheet.png"]) {
  fs.copyFileSync(path.join(source, name), path.join(destination, name));
}

console.log(`Installed Radiance Butterfly to ${destination}`);
