import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'doldadress' },
    update: {},
    create: { subdomain: 'doldadress', name: 'Doldadress' },
  });
  console.log('Tenant:', tenant.id);

  const user = await prisma.user.upsert({
    where: { email: 'rc@successifier.com' },
    update: { role: 'superadmin', tenantId: tenant.id },
    create: { email: 'rc@successifier.com', name: 'RC', role: 'superadmin', tenantId: tenant.id },
  });
  console.log('User:', user.id, user.email, user.role);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
