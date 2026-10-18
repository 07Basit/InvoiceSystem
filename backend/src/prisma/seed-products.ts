import { PrismaClient } from '@prisma/client';

// The products listed on raiyanglobal.com, for the product dropdown. Safe to re-run: existing names are left alone.
const prisma = new PrismaClient();

const PRODUCTS = [
  'Allu Patta', 'Alphanso Mango', 'Amba Haldi', 'Amla', 'Amrapali Mango', 'Apple Bore',
  'Arvi', 'Ash Gourd', 'Badami Mango', 'Banana', 'Banana Flower', 'Banana Leaf',
  'Banganapalli Mango', 'Bangla Paan', 'Bathua Leaves', 'Big Kantola', 'Bilva Leaves', 'Black Grapes',
  'Bombay Onion', 'Brinjal', 'Cabbage', 'Cauliflower', 'Chameli Bore', 'Chausa Mango',
  'Chickoo', 'Coconut', 'Coconut Leaves', 'Coriander', 'Culcutta Paan', 'Culcutta parwal',
  'Curry Banana', 'Curry Leaves', 'Custard Apple Desi', 'Custard Apple Golden', 'Dasheri Mango', 'Desi Parwal',
  'Dragon Fruit', 'Drumstick', 'Drumstick Leaves', 'Dudhi', 'Durva Grass', 'Ellichi Banana',
  'French Beans', 'G4 Chilli', 'Galka', 'Gangora Leaves', 'Garlic Cloves', 'Ghevda Papdi',
  'Ginger', 'Green Amaranth Leaves', 'Green Big Pumpkin', 'Green Chilli', 'Green Garlic', 'Green Grapes',
  'Green Peas', 'Green Tea', 'Gunda', 'Guwar', 'Haldi Leaves', 'Himayat Mango',
  'Himsagar Mango', 'Ice Apple (Tadgola)', 'Jackfruit', 'Jalbi Embly', 'Jalpai', 'Jamun',
  'Jasmine', 'Kand', 'Kapoori Paan', 'Karela', 'Kesar Mango', 'Kotchur Lothi',
  'Lal Bag Mango', 'Langda Mango', 'Lemon', 'Lemon Grass', 'Long Bean', 'Lotus Flower',
  'Lotus Root', 'Lotus Stem', 'Lychee', 'Madras Onion', 'Mango Steem', 'Mogra',
  'Musk Melon', 'Neelam Mango', 'Neem Flowers', 'Okra', 'Orange Marigold', 'Pakoda Chilli',
  'Palm Roots', 'Papaya', 'Patha', 'Pawta Papdi', 'Payari Mango', 'Pink Guava',
  'Poi Saag', 'Pomegranate', 'Pudina Leaves', 'Radish', 'Rajapuri Mango', 'Rambutan',
  'Rasalu Mango', 'Raw Mango', 'Red Amaranth Leaves', 'Red Bore', 'Red Carrot', 'Red Chaniya Ber',
  'Red Dates', 'Red Rose', 'Round Dhudhi', 'Sarso Saag', 'Singada', 'Small Kantola',
  'Snake Gourd', 'Suran', 'Surti Kand', 'Surti Papdi', 'Surti Raviya', 'Tamarind',
  'Tinda', 'Tindora', 'Totapuri Mango', 'Turai', 'Tuwer', 'Valor Papdi',
  'Vellerrica', 'White Guava', 'White Rose', 'Wood Apple', 'Yellow Dates', 'Yellow Haldi',
  'Yellow Marigold', 'Yellow Rose',
];

async function main() {
  let added = 0;
  for (const name of PRODUCTS) {
    if (await prisma.product.findUnique({ where: { name } })) continue;
    await prisma.product.create({ data: { name } });
    added++;
  }
  console.log(`Added ${added} products (${PRODUCTS.length - added} already existed)`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
