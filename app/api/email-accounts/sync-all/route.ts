import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db/client';
import { google } from 'googleapis';
import { generateAIResponse } from '@/lib/services/ai-generator';
import { ContextAggregator } from '@/lib/services/context-aggregator';

async function syncSingleAccount(account: {
  id: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const tenant = await prisma.tenant.findUnique({ where: { subdomain: 'doldadress' } });

  if (!tenant) {
    throw new Error('Tenant not found');
  }

  const integrations = await prisma.integration.findMany({
    where: {
      tenantId: tenant.id,
      isActive: true,
    },
  });
  const contextAggregator = new ContextAggregator();

  const response = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread in:inbox',
    maxResults: 10,
  });

  const messages = response.data.messages || [];
  let newTickets = 0;

  for (const message of messages) {
    try {
      const msg = await gmail.users.messages.get({
        userId: 'me',
        id: message.id!,
        format: 'full',
      });

      const headers = msg.data.payload?.headers || [];
      const subject = headers.find((h) => h.name === 'Subject')?.value || 'No Subject';
      const from = headers.find((h) => h.name === 'From')?.value || '';
      const emailMatch = from.match(/<(.+)>/);
      const customerEmail = emailMatch ? emailMatch[1] : from;
      const customerName = from.replace(/<.+>/, '').trim();

      let body = '';
      if (msg.data.payload?.body?.data) {
        body = Buffer.from(msg.data.payload.body.data, 'base64').toString();
      } else if (msg.data.payload?.parts) {
        const textPart = msg.data.payload.parts.find((p) => p.mimeType === 'text/plain');
        if (textPart?.body?.data) {
          body = Buffer.from(textPart.body.data, 'base64').toString();
        }
      }

      // Check if ticket already exists for this Gmail message ID
      const existingTicket = await prisma.ticket.findFirst({
        where: {
          tenantId: tenant.id,
          originalMessage: {
            contains: `[Gmail ID: ${message.id}]`,
          },
        },
      });

      if (existingTicket) {
        console.log(`[Email Sync] Skipping duplicate message ${message.id} for ${account.email}`);
        continue;
      }

      const contextData = await contextAggregator.gatherContext(customerEmail, integrations as any);

      const ticket = await prisma.ticket.create({
        data: {
          tenantId: tenant.id,
          customerEmail,
          customerName,
          subject,
          originalMessage: `[Gmail ID: ${message.id}]\n[Inbox account: ${account.email}]\n\n${body || 'No content'}`,
          status: 'new',
          priority: 'normal',
          contextData,
        },
      });

      newTickets += 1;

      generateAIResponse(subject, body || 'No content', contextData, tenant.id)
        .then(async ({ response: aiResponse, confidence }) => {
          await prisma.ticket.update({
            where: { id: ticket.id },
            data: {
              aiResponse,
              aiConfidence: confidence,
            },
          });
        })
        .catch(console.error);

      await gmail.users.messages.modify({
        userId: 'me',
        id: message.id!,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
    } catch (error) {
      console.error(`Error processing message ${message.id} for ${account.email}:`, error);
    }
  }

  await prisma.emailAccount.update({
    where: { id: account.id },
    data: { lastSyncAt: new Date() },
  });

  return { accountId: account.id, email: account.email, newTickets };
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: {
        emailAccounts: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            email: true,
            accessToken: true,
            refreshToken: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.emailAccounts.length === 0) {
      return NextResponse.json({ success: true, syncedAccounts: 0, totalNewTickets: 0, results: [] });
    }

    const results = [] as Array<{ accountId: string; email: string; newTickets: number; error?: string }>;

    for (const account of user.emailAccounts) {
      try {
        const result = await syncSingleAccount(account);
        results.push(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          accountId: account.id,
          email: account.email,
          newTickets: 0,
          error: message,
        });
      }
    }

    const totalNewTickets = results.reduce((sum, r) => sum + r.newTickets, 0);

    return NextResponse.json({
      success: true,
      syncedAccounts: results.length,
      totalNewTickets,
      results,
    });
  } catch (error) {
    console.error('Error syncing all email accounts:', error);
    return NextResponse.json(
      { error: 'Failed to sync email accounts' },
      { status: 500 }
    );
  }
}
