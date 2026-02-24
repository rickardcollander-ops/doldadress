import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

const TENANT_KEY = 'doldadress';

async function resolveTenantId(request: NextRequest) {
  const host = request.headers.get('host') || request.nextUrl.hostname || '';
  const subdomain = host
    .split('.')[0]
    .replace(':3001', '')
    .replace(':3000', '')
    .replace('localhost', TENANT_KEY)
    .replace('127', TENANT_KEY);

  const tenant = await prisma.tenant.findFirst({
    where: {
      OR: [
        { id: TENANT_KEY },
        { subdomain: TENANT_KEY },
        { subdomain },
      ],
    },
    select: { id: true },
  });

  if (tenant) {
    return tenant.id;
  }

  // Last-resort fallback for local/dev environments with different seed data
  const firstTenant = await prisma.tenant.findFirst({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  });

  if (firstTenant) {
    return firstTenant.id;
  }

  throw new Error(`No tenant found for integration settings (host='${host}', subdomain='${subdomain}')`);
}

export async function GET(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId(request);

    const integrations = await prisma.integration.findMany({
      where: { tenantId },
    });

    return NextResponse.json({ integrations });
  } catch (error) {
    console.error('Error fetching integrations:', error);
    const details = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to fetch integrations',
        ...(process.env.NODE_ENV !== 'production' ? { details } : {}),
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await resolveTenantId(request);
    const body = await request.json();
    const { type, credentials } = body;

    if (!type || !credentials) {
      return NextResponse.json(
        { error: 'Type and credentials are required' },
        { status: 400 }
      );
    }

    const integration = await prisma.integration.upsert({
      where: {
        tenantId_type: {
          tenantId,
          type,
        },
      },
      update: {
        credentials,
        name: type.charAt(0).toUpperCase() + type.slice(1),
      },
      create: {
        tenantId,
        type,
        name: type.charAt(0).toUpperCase() + type.slice(1),
        credentials,
        isActive: true,
      },
    });

    return NextResponse.json(integration);
  } catch (error) {
    console.error('Error creating integration:', error);
    const details = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to create integration',
        ...(process.env.NODE_ENV !== 'production' ? { details } : {}),
      },
      { status: 500 }
    );
  }
}
