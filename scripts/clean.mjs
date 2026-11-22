import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);

for (const path of [".next", "node_modules/.cache", "tsconfig.tsbuildinfo"]) {
  rmSync(new URL(path, root), { recursive: true, force: true });
  console.log(`Removed ${fileURLToPath(new URL(path, root))}`);
}
