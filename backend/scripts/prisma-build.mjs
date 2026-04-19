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

// Only generate the client at build time. Never touch the database from the build:
// - No real Prisma migration folders exist (schema was applied via `db push` + hand-written SQL).
// - `prisma migrate deploy` against Supabase takes an advisory lock and hangs the Vercel build.
// Schema changes must be applied manually (and deliberately) out-of-band.
run(prismaCmd, ["generate"]);
