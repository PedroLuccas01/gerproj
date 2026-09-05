import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const [major, minor] = pkg.version.split(".");

let commits = "0";
try {
  commits = execSync("git rev-list --count HEAD", { encoding: "utf8" }).trim();
} catch {
  // ignore when git is unavailable
}

const deployToken = process.env.VERCEL_DEPLOYMENT_ID
  ? process.env.VERCEL_DEPLOYMENT_ID.slice(-6)
  : Date.now().toString(36).slice(-5);

const version = `${major}.${minor}.${commits}.${deployToken}`;
const outPath = path.join(root, "src/lib/build-version.ts");

fs.writeFileSync(
  outPath,
  `// Generated at build time — do not edit manually.\nexport const APP_BUILD_VERSION = "${version}";\n`,
);

console.log(`App version set to ${version}`);
