import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { encryptJSON, decryptJSON } from '@/lib/crypto';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const { id } = await params;

    // If credentials are being updated, encrypt them
    const updateData = { ...body };
    if (updateData.credentials) {
      updateData.credentials = encryptJSON(updateData.credentials) as any;
    }

    const integration = await prisma.integration.update({
      where: { id },
      data: updateData,
    });

    // Decrypt credentials for response
    const decryptedIntegration = {
      ...integration,
      credentials: integration.credentials 
        ? decryptJSON(integration.credentials as any)
        : integration.credentials,
    };

    return NextResponse.json(decryptedIntegration);
  } catch (error) {
    console.error('Error updating integration:', error);
    return NextResponse.json(
      { error: 'Failed to update integration' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.integration.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting integration:', error);
    return NextResponse.json(
      { error: 'Failed to delete integration' },
      { status: 500 }
    );
  }
}
