import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const host = request.headers.get('host') || '';
    const subdomain = host.split('.')[0].replace(':3001', '').replace('localhost', 'doldadress');
    
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    await prisma.apiKey.delete({
      where: {
        id: params.keyId,
        tenantId: tenant.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json({ error: 'Failed to delete API key' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { keyId: string } }
) {
  try {
    const host = request.headers.get('host') || '';
    const subdomain = host.split('.')[0].replace(':3001', '').replace('localhost', 'doldadress');
    
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const { isActive } = await request.json();

    const apiKey = await prisma.apiKey.update({
      where: {
        id: params.keyId,
        tenantId: tenant.id,
      },
      data: { isActive },
    });

    return NextResponse.json({ apiKey });
  } catch (error) {
    console.error('Error updating API key:', error);
    return NextResponse.json({ error: 'Failed to update API key' }, { status: 500 });
  }
}
