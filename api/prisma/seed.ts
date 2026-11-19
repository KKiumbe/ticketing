// Seeds Business Meets Tech. Early bird ends 3 days before the event; gate = +20%; 2.5% processing fee.
// PRICES/CAPACITIES ARE PLACEHOLDERS: edit them in Admin before going live.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const event = await prisma.event.upsert({
    where: { slug: 'business-meets-tech' },
    update: {},
    create: {
      slug: 'business-meets-tech',
      name: 'Business Meets Tech',
      description: 'Where developers, SMEs and marketers meet. Devs find gigs, marketers find work, businesses find talent.',
      venue: 'Ngong Hills Hotel, Kilimani, Nairobi',
      startsAt: new Date('2026-12-04T14:00:00+03:00'),
      gateMarkupPercent: 20,
      fees: [{ name: 'Payment processing fee', type: 'percent', value: 2.5, perTicket: false, appliesTo: 'ALL' }],
    },
  });
  if (await prisma.ticketCategory.count({ where: { eventId: event.id } })) {
    console.log('Categories already exist, skipping.');
    return;
  }
  const deadline = new Date('2026-12-03T23:59:00+03:00');
  const cats = [
    { name: 'Developer', description: 'System devs and people selling apps', price: 1500, capacity: 100, earlyBirdPrice: 1000, earlyBirdQuota: 40, minDeposit: 500, sortOrder: 1 },
    { name: 'Business Owner / SME', description: 'Business owners looking for systems & talent', price: 2500, capacity: 80, earlyBirdPrice: 2000, earlyBirdQuota: 30, minDeposit: 1000, sortOrder: 2 },
    { name: 'Marketer', description: 'Marketers looking for clients and work', price: 1500, capacity: 60, earlyBirdPrice: 1000, earlyBirdQuota: 20, minDeposit: 500, sortOrder: 3 },
  ];
  for (const c of cats) {
    await prisma.ticketCategory.create({
      data: { ...c, eventId: event.id, earlyBirdDaysBefore: 3, allowInstallments: true, installmentDeadline: deadline },
    });
  }
  console.log(`Seeded Business Meets Tech (event id ${event.id})`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
