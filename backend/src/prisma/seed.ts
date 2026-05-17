import { InvoiceStatus, PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.lineItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.document.deleteMany();
  await prisma.loadingLocation.deleteMany();
  await prisma.landingLocation.deleteMany();
  await prisma.importer.deleteMany();
  await prisma.exporterProfile.deleteMany();

  const exporter = await prisma.exporterProfile.create({
    data: {
      name: 'Green Harvest Exports Pvt Ltd',
      address: 'Plot 19, Navi Mumbai, Maharashtra, India',
      contact: '+91 90000 10000',
      email: 'exports@greenharvest.co.in',
      isLocked: true,
    },
  });

  const importer = await prisma.importer.create({
    data: {
      name: 'North Maple Foods',
      address: '215 Rue Saint-Paul, Montreal, QC, Canada',
      contact: '+1 514-555-1200',
      email: 'ops@northmaplefoods.ca',
      buyerName: 'North Maple Procurement',
      currency: 'CAD',
      landingLocations: {
        create: [
          {
            name: 'Montreal',
            portOfDischarge: 'YUL',
            finalDestination: 'YUL',
            countryOfDestination: 'YUL - Montreal',
          },
        ],
      },
      loadingLocations: {
        create: [
          {
            name: 'Mumbai',
            portOfLoading: 'BOM',
            countryOfOrigin: 'India',
          },
        ],
      },
    },
    include: { landingLocations: true, loadingLocations: true },
  });

  console.log('✅ Created exporter profile and importer');

  const statuses: InvoiceStatus[] = ['PAID', 'SENT', 'DRAFT', 'OVERDUE'];

  for (let i = 1; i <= 5; i++) {
    const kgsPerBox = 8 + i;
    const boxes = 20 + i * 2;
    const ratePerKg = 2.5 + i * 0.2;

    const totalNetWeight = kgsPerBox * boxes;
    const amount = totalNetWeight * ratePerKg;
    const roundOff = i % 2 === 0 ? 0.25 : 0;

    await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-2026-${String(i).padStart(3, '0')}`,
        invoiceDate: new Date(Date.now() - i * 2 * 24 * 60 * 60 * 1000),
        status: statuses[i % statuses.length]!,
        importerId: importer.id,
        landingLocationId: importer.landingLocations[0]?.id ?? null,
        loadingLocationId: importer.loadingLocations[0]?.id ?? null,
        exportersRef: '',
        otherReferences: '',
        awbNumber: '',
        preCarriageBy: 'TRUCK BY ROAD',
        placeOfReceiptByPreCarrier: 'N/A',
        vesselFlightNo: 'By Air',
        portOfLoading: importer.loadingLocations[0]?.portOfLoading ?? null,
        portOfDischarge: importer.landingLocations[0]?.portOfDischarge ?? null,
        finalDestination: importer.landingLocations[0]?.finalDestination ?? null,
        buyerName: importer.buyerName,
        countryOfOrigin: importer.loadingLocations[0]?.countryOfOrigin ?? null,
        countryOfDestination: importer.landingLocations[0]?.countryOfDestination ?? null,
        descriptionOfGoods: 'FRUITS & VEGETABLES',
        hsCode: '709',
        termsOfDelivery: 'CNF YUL',
        termsOfPayment: 'ADVANCE',
        currency: importer.currency,
        exporterName: exporter.name,
        exporterAddress: exporter.address,
        exporterContact: exporter.contact,
        exporterEmail: exporter.email,
        totalBoxes: boxes,
        totalNetWeight: new Decimal(totalNetWeight),
        totalGrossWeight: null,
        subTotal: new Decimal(amount),
        roundOff: new Decimal(roundOff),
        total: new Decimal(amount + roundOff),
        amountInWords: `${importer.currency} amount in words`,
        notes: 'Sample seeded invoice',
        lineItems: {
          create: [
            {
              marksAndNos: '',
              containerNo: '',
              descriptionOfGoods: `Mixed produce batch ${i}`,
              netWeightPerPackage: new Decimal(kgsPerBox),
              numberOfBoxes: boxes,
              totalNetWeight: new Decimal(totalNetWeight),
              ratePerKg: new Decimal(ratePerKg),
              totalPerBox: new Decimal(kgsPerBox * ratePerKg),
              amount: new Decimal(amount),
            },
          ],
        },
      },
    });
  }

  await prisma.document.create({
    data: {
      title: 'Commercial Invoice Notes',
      type: 'WORD',
      content: '<h1>Commercial Invoice Notes</h1><p>Seed content</p>',
    },
  });

  console.log('✅ Seed complete!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
