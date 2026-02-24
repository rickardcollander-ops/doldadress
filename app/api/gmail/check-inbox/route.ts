import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { GmailService } from '@/lib/integrations/gmail';
import { ContextAggregator } from '@/lib/services/context-aggregator';

export async function POST(request: NextRequest) {
  try {
    const tenantId = 'doldadress';

    // Get Gmail integration
    const gmailIntegration = await prisma.integration.findFirst({
      where: {
        tenantId,
        type: 'gmail',
        isActive: true,
      },
    });

    if (!gmailIntegration) {
      return NextResponse.json(
        { error: 'Gmail integration not configured' },
        { status: 400 }
      );
    }

    const gmailService = new GmailService({
      clientId: gmailIntegration.credentials.clientId as string,
      clientSecret: gmailIntegration.credentials.clientSecret as string,
      refreshToken: gmailIntegration.credentials.refreshToken as string,
    });

    // Fetch unread emails
    const emails = await gmailService.getUnreadEmails(10);
    const createdTickets = [];

    // Get all integrations for context
    const integrations = await prisma.integration.findMany({
      where: {
        tenantId,
        isActive: true,
      },
    });

    const contextAggregator = new ContextAggregator();

    for (const email of emails) {
      // Check if ticket already exists for this email
      const existingTicket = await prisma.ticket.findFirst({
        where: {
          tenantId,
          customerEmail: email.from,
          subject: email.subject,
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
      });

      if (existingTicket) {
        continue; // Skip if ticket already exists
      }

      // Gather context for this customer
      const context = await contextAggregator.gatherContext(email.from, integrations);

      // Create ticket
      const ticket = await prisma.ticket.create({
        data: {
          tenantId,
          customerEmail: email.from,
          customerName: email.name,
          subject: email.subject,
          originalMessage: email.body,
          status: 'new',
          priority: 'normal',
          contextData: context,
        },
      });

      createdTickets.push(ticket);

      // Mark email as read
      await gmailService.markAsRead(email.id);
    }

    return NextResponse.json({
      success: true,
      ticketsCreated: createdTickets.length,
      tickets: createdTickets,
    });
  } catch (error) {
    console.error('Error checking Gmail inbox:', error);
    return NextResponse.json(
      { error: 'Failed to check inbox' },
      { status: 500 }
    );
  }
}
