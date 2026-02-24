import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { ContextAggregator } from '@/lib/services/context-aggregator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, subject, message, priority } = body;

    if (!email || !subject || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: email, subject, message' },
        { status: 400 }
      );
    }

    const tenantId = 'doldadress';

    const integrations = await prisma.integration.findMany({
      where: {
        tenantId,
        isActive: true,
      },
    });

    const contextAggregator = new ContextAggregator();
    const context = await contextAggregator.gatherContext(email, integrations as any);

    const ticket = await prisma.ticket.create({
      data: {
        tenantId,
        customerEmail: email,
        customerName: name,
        subject,
        originalMessage: message,
        priority: priority || 'normal',
        status: 'new',
        contextData: context,
      },
    });

    return NextResponse.json({
      success: true,
      ticketId: ticket.id,
    });
  } catch (error) {
    console.error('Error creating ticket from webhook:', error);
    return NextResponse.json(
      { error: 'Failed to create ticket' },
      { status: 500 }
    );
  }
}
