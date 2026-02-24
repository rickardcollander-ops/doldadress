import { NextRequest, NextResponse } from 'next/server';
import { getHubSpotClient } from '@/lib/hubspot';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const engagementId = searchParams.get('engagementId');
    const contactId = searchParams.get('contactId');

    if (!engagementId && !contactId) {
      return NextResponse.json(
        { error: 'Either engagementId or contactId is required' },
        { status: 400 }
      );
    }

    const hubspot = getHubSpotClient();
    let attachments = [];

    if (engagementId) {
      attachments = await hubspot.getAttachments(engagementId);
    } else if (contactId) {
      const engagements = await hubspot.getContactEngagements(contactId);
      
      for (const engagement of engagements.results || []) {
        try {
          const engagementAttachments = await hubspot.getAttachments(engagement.id);
          if (engagementAttachments && Array.isArray(engagementAttachments)) {
            attachments.push(...engagementAttachments);
          }
        } catch (error) {
          console.error(`Error fetching attachments for engagement ${engagement.id}:`, error);
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: attachments.length,
      attachments,
    });
  } catch (error) {
    console.error('Error fetching attachments from HubSpot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch attachments from HubSpot',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { attachmentId } = body;

    if (!attachmentId) {
      return NextResponse.json(
        { error: 'attachmentId is required' },
        { status: 400 }
      );
    }

    const hubspot = getHubSpotClient();
    const attachment = await hubspot.downloadAttachment(attachmentId);

    return NextResponse.json({
      success: true,
      attachment,
    });
  } catch (error) {
    console.error('Error downloading attachment from HubSpot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to download attachment from HubSpot',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
