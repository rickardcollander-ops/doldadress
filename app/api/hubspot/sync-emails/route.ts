import { NextRequest, NextResponse } from 'next/server';
import { getHubSpotClient } from '@/lib/hubspot';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactId, emails } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 }
      );
    }

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'emails array is required' },
        { status: 400 }
      );
    }

    const hubspot = getHubSpotClient();
    const results = [];

    for (const email of emails) {
      const { subject, body, from, to, timestamp } = email;
      
      if (!subject || !body || !from || !to) {
        continue;
      }

      const result = await hubspot.createEmail(contactId, {
        subject,
        body,
        from,
        to,
        timestamp: timestamp ? new Date(timestamp) : undefined,
      });
      
      results.push({
        id: result.id,
        createdAt: result.createdAt,
        success: true,
      });
    }

    return NextResponse.json({
      success: true,
      synced: results.length,
      results,
    });
  } catch (error) {
    console.error('Error syncing emails to HubSpot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync emails to HubSpot',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
