import "dotenv/config";
import bcrypt from "bcryptjs";
import readline from "readline";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function ask(q: string, silent = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    if (silent) {
      const stdout = process.stdout as any;
      const orig = stdout.write.bind(stdout);
      stdout.write = (chunk: any, ...rest: any[]) => {
        if (typeof chunk === "string" && chunk.includes(q)) return orig(chunk, ...rest);
        return orig("", ...rest);
      };
    }
    rl.question(q, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

async function main() {
  const email = (await ask("Admin email: ")).toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Invalid email");

  const password = await ask("Admin password (min 10 chars): ");
  if (password.length < 10) throw new Error("Password too short");

  const fullName = await ask("Full name (optional): ");
  const roleInput = (await ask("Role [OWNER|ADMIN|STAFF] (default ADMIN): ")).toUpperCase() || "ADMIN";
  if (!["OWNER", "ADMIN", "STAFF"].includes(roleInput)) throw new Error("Invalid role");

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, fullName: fullName || null, role: roleInput as any, isActive: true },
    create: { email, passwordHash, fullName: fullName || null, role: roleInput as any },
  });

  console.log(`\n✓ Admin user ready: ${user.email} (${user.role})`);
}

main()
  .catch((err) => {
    console.error("Failed:", err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
