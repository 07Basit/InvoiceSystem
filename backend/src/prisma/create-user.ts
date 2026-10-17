import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

// Usage: pnpm db:create-user -- <username> <password> ["Display Name"]
// Creates the user, or resets the password if the username already exists (signing out all sessions).
const prisma = new PrismaClient();

async function main() {
  const [usernameArg, password, displayNameArg] = process.argv.slice(2);
  if (!usernameArg || !password) {
    console.error('Usage: pnpm db:create-user -- <username> <password> ["Display Name"]');
    process.exit(1);
  }
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    console.error('Password must be at least 8 characters and contain a letter and a number.');
    process.exit(1);
  }

  const username = usernameArg.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await prisma.user.upsert({
    where: { username },
    create: { username, passwordHash, displayName: displayNameArg?.trim() || username },
    update: { passwordHash, tokenVersion: { increment: 1 } },
  });
  console.log(`✅ User "${user.username}" is ready.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
