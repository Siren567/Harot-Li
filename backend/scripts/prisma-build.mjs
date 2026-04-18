import { spawnSync } from "node:child_process";

function bin(name) {
  if (process.platform === "win32") return `${name}.cmd`;
  return name;
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  if (typeof result.status === "number" && result.status !== 0) process.exit(result.status);
  if (result.error) {
    // eslint-disable-next-line no-console
    console.error(result.error);
    process.exit(1);
  }
}

const prismaCmd = bin("prisma");

run(prismaCmd, ["generate"]);

if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim()) {
  run(prismaCmd, ["migrate", "deploy"]);
} else {
  // eslint-disable-next-line no-console
  console.warn("[backend build] DATABASE_URL not set; skipping `prisma migrate deploy`.");
}

