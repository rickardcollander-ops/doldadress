import { NextRequest, NextResponse } from 'next/server';
import { getHubSpotClient } from '@/lib/hubspot';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactId, notes } = body;

    if (!contactId) {
      return NextResponse.json(
        { error: 'contactId is required' },
        { status: 400 }
      );
    }

    if (!notes || !Array.isArray(notes)) {
      return NextResponse.json(
        { error: 'notes array is required' },
        { status: 400 }
      );
    }

    const hubspot = getHubSpotClient();
    const results = [];

    for (const note of notes) {
      const { content, timestamp } = note;
      
      if (!content) {
        continue;
      }

      const result = await hubspot.createNote(
        contactId,
        content,
        timestamp ? new Date(timestamp) : undefined
      );
      
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
    console.error('Error syncing notes to HubSpot:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync notes to HubSpot',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
