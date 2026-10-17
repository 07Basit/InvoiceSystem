import { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// Additive sample data for the dashboard charts. Safe to re-run: it only
// replaces its own rows (invoice numbers SMP-*, importers with @sample.test emails).
const prisma = new PrismaClient();

const IMPORTERS = [
  { name: 'North Maple Foods (Sample)', buyer: 'North Maple Procurement', weight: 5, currency: 'CAD', unit: 1.4 },
  { name: 'Gulf Fresh Trading (Sample)', buyer: 'Gulf Fresh Buying Desk', weight: 4, currency: 'EUR', unit: 0.9 },
  { name: 'Baltic Greens GmbH (Sample)', buyer: 'Baltic Greens Purchasing', weight: 3, currency: 'USD', unit: 1 },
  { name: 'Pacific Produce Co (Sample)', buyer: 'Pacific Produce Imports', weight: 2, currency: 'INR', unit: 83 },
  { name: 'Alpine Organics (Sample)', buyer: 'Alpine Organics Sourcing', weight: 1, currency: 'USD', unit: 1 },
];

async function main() {
  await prisma.invoice.deleteMany({ where: { invoiceNumber: { startsWith: 'SMP-' } } });
  await prisma.importer.deleteMany({ where: { email: { endsWith: '@sample.test' } } });

  const exporter = await prisma.exporterProfile.findFirst();
  const importers = [];
  for (const [idx, imp] of IMPORTERS.entries()) {
    importers.push({
      weight: imp.weight,
      currency: imp.currency,
      unit: imp.unit,
      row: await prisma.importer.create({
        data: {
          name: imp.name, address: `${100 + idx} Harbour Road`, contact: `+1 555-010${idx}`,
          email: `ops${idx}@sample.test`, buyerName: imp.buyer, currency: imp.currency,
        },
      }),
    });
  }

  const now = new Date();
  let n = 1;
  // 12 months, with a gently rising trend and some seasonality
  for (let m = 11; m >= 0; m--) {
    const count = 2 + ((11 - m) % 4) + Math.floor((11 - m) / 4);
    for (let k = 0; k < count; k++) {
      const importerRow = importers[(n + k) % 3 === 0 ? 0 : (n + k) % importers.length]!;
      const kgsPerBox = 8 + (n % 5);
      const boxes = 20 + ((n * 13) % 60) * importerRow.weight;
      const rate = Math.round((2.5 + (n % 7) * 0.3) * importerRow.unit * 100) / 100;
      const net = kgsPerBox * boxes;
      const amount = Math.round(net * rate * 100) / 100;
      const date = new Date(now.getFullYear(), now.getMonth() - m, 3 + ((k * 7 + n) % 22));
      if (date > now) date.setTime(now.getTime() - 86400000);

      await prisma.invoice.create({
        data: {
          invoiceNumber: `SMP-${String(n).padStart(3, '0')}`,
          invoiceDate: date,
          createdAt: date,
          importerId: importerRow.row.id,
          currency: importerRow.currency,
          descriptionOfGoods: 'FRUITS & VEGETABLES',
          buyerName: importerRow.row.buyerName,
          exporterName: exporter?.name ?? null,
          totalBoxes: boxes,
          totalNetWeight: new Decimal(net),
          subTotal: new Decimal(amount),
          total: new Decimal(amount),
          notes: 'Sample invoice for dashboard charts',
          lineItems: {
            create: [{
              descriptionOfGoods: 'Mixed produce',
              netWeightPerPackage: new Decimal(kgsPerBox),
              numberOfBoxes: boxes,
              totalNetWeight: new Decimal(net),
              ratePerKg: new Decimal(rate),
              totalPerBox: new Decimal(kgsPerBox * rate),
              amount: new Decimal(amount),
            }],
          },
        },
      });
      n++;
    }
  }
  if (!(await prisma.currencySettings.findFirst())) await prisma.currencySettings.create({ data: { baseCurrency: 'USD' } });

  console.log(`Created ${n - 1} sample invoices across ${importers.length} importers `);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
