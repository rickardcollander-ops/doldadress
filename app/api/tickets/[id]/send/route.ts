import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import { ResendService } from '@/lib/integrations/resend';
import { google } from 'googleapis';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { response, fromAccountId } = body;

    if (!response) {
      return NextResponse.json(
        { error: 'Response text is required' },
        { status: 400 }
      );
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: 'Ticket not found' },
        { status: 404 }
      );
    }

    let sentVia = 'unknown';

    // If a Gmail account is selected, send via Gmail
    if (fromAccountId) {
      const emailAccount = await prisma.emailAccount.findUnique({
        where: { id: fromAccountId },
      });

      if (!emailAccount || !emailAccount.isActive) {
        return NextResponse.json(
          { error: 'Selected email account not found or inactive' },
          { status: 400 }
        );
      }

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
      );

      oauth2Client.setCredentials({
        access_token: emailAccount.accessToken,
        refresh_token: emailAccount.refreshToken,
      });

      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

      const rawMessage = [
        `From: ${emailAccount.email}`,
        `To: ${ticket.customerEmail}`,
        `Subject: Re: ${ticket.subject}`,
        `Content-Type: text/plain; charset="UTF-8"`,
        '',
        response,
      ].join('\r\n');

      const encodedMessage = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      await gmail.users.messages.send({
        userId: 'me',
        requestBody: { raw: encodedMessage },
      });

      sentVia = emailAccount.email;
    } else {
      // Fallback: send via Resend
      const resendIntegration = await prisma.integration.findFirst({
        where: {
          tenantId: ticket.tenantId,
          type: 'resend',
          isActive: true,
        },
      });

      if (!resendIntegration) {
        return NextResponse.json(
          { error: 'No email account selected and Resend integration not configured' },
          { status: 400 }
        );
      }

      const resendService = new ResendService(
        (resendIntegration.credentials as any).apiKey as string,
        (resendIntegration.credentials as any).fromEmail as string
      );

      await resendService.sendEmail(
        ticket.customerEmail,
        `Re: ${ticket.subject}`,
        response
      );

      sentVia = (resendIntegration.credentials as any).fromEmail || 'resend';
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id },
      data: {
        finalResponse: response,
        status: 'sent',
        sentAt: new Date(),
      },
    });

    return NextResponse.json({ ...updatedTicket, sentVia });
  } catch (error) {
    console.error('Error sending response:', error);
    return NextResponse.json(
      { error: 'Failed to send response' },
      { status: 500 }
    );
  }
}
