import { PrismaClient } from '@prisma/client';
import { DEFAULT_DECLARATION } from 'shared';

// Adds the standard declaration as the first saved declaration, if none exists yet. Safe to re-run.
const prisma = new PrismaClient();

async function main() {
  if ((await prisma.declarationProfile.count()) > 0) { console.log('Declarations already exist, nothing added'); return; }
  await prisma.declarationProfile.create({ data: { name: 'Standard declaration', text: DEFAULT_DECLARATION, isDefault: true } });
  console.log('Added the standard declaration as the default');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
