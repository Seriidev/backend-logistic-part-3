import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://yuusell:yuusell_dev@localhost:5433/yuusell_dev?schema=public',
});

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Seeding database...');

  // Create Super Admin user
  const passwordHash = await bcrypt.hash('Admin@123456', 12);

  const superAdmin = await prisma.user.upsert({
    where: { email: 'admin@yuusell.com' },
    update: {},
    create: {
      email: 'admin@yuusell.com',
      passwordHash,
      role: 'SUPER_ADMIN',
      firstName: 'Super',
      lastName: 'Admin',
      isActive: true,
    },
  });

  console.log(`✅ Super Admin created: ${superAdmin.email}`);

  // Create a test Manager
  const managerHash = await bcrypt.hash('Manager@123456', 12);

  const manager = await prisma.user.upsert({
    where: { email: 'manager@yuusell.com' },
    update: {},
    create: {
      email: 'manager@yuusell.com',
      passwordHash: managerHash,
      role: 'MANAGER',
      firstName: 'Test',
      lastName: 'Manager',
      isActive: true,
    },
  });

  console.log(`✅ Manager created: ${manager.email}`);

  // Create a test Customer
  const customerHash = await bcrypt.hash('Customer@123456', 12);

  const customer = await prisma.user.upsert({
    where: { email: 'customer@yuusell.com' },
    update: {},
    create: {
      email: 'customer@yuusell.com',
      passwordHash: customerHash,
      role: 'CUSTOMER',
      firstName: 'Test',
      lastName: 'Customer',
      isActive: true,
    },
  });

  console.log(`✅ Customer created: ${customer.email}`);

  console.log('🌱 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
