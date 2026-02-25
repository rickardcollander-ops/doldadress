import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Mark ticket as spam by updating status to 'closed' and adding spam marker
    const ticket = await prisma.ticket.update({
      where: { id },
      data: {
        status: 'closed',
        originalMessage: `[SPAM] ${await prisma.ticket.findUnique({ where: { id }, select: { originalMessage: true } }).then(t => t?.originalMessage || '')}`,
      },
    });

    return NextResponse.json(ticket);
  } catch (error) {
    console.error('Error marking ticket as spam:', error);
    return NextResponse.json(
      { error: 'Failed to mark ticket as spam' },
      { status: 500 }
    );
  }
}
