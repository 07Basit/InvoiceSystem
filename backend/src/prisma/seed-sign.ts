import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// One-time, safe to re-run: imports the seal & sign that used to be bundled in the frontend as the first
// (default) saved profile, and gives existing invoices a copy of it. Does nothing once a profile exists.
const prisma = new PrismaClient();

async function main() {
  if ((await prisma.signProfile.count()) > 0) {
    console.log('Seal & sign profiles already exist; nothing to do.');
    return;
  }
  const file = resolve(__dirname, '../../../frontend/src/assets/invoice/InvoiceSign.png');
  const image = `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  const profile = await prisma.signProfile.create({ data: { name: 'Proprietor sign', image, isDefault: true } });
  const { count } = await prisma.invoice.updateMany({
    where: { signImage: null },
    data: { signName: profile.name, signImage: profile.image },
  });
  console.log(`Created "${profile.name}" as the default and copied it onto ${count} invoices.`);
}

main().finally(() => prisma.$disconnect());
