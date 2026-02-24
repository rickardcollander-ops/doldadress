import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function verifyHubSpotSignature(
  requestBody: string,
  signature: string,
  clientSecret: string
): boolean {
  const hash = crypto
    .createHmac('sha256', clientSecret)
    .update(requestBody)
    .digest('hex');
  
  return hash === signature;
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-hubspot-signature-v3');
    const requestBody = await request.text();
    
    const clientSecret = process.env.HUBSPOT_CLIENT_SECRET;
    
    if (!clientSecret) {
      console.error('HUBSPOT_CLIENT_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook configuration error' },
        { status: 500 }
      );
    }

    if (signature && !verifyHubSpotSignature(requestBody, signature, clientSecret)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    const events = JSON.parse(requestBody);

    for (const event of events) {
      const { subscriptionType, objectId, propertyName, propertyValue } = event;

      switch (subscriptionType) {
        case 'contact.propertyChange':
          console.log(`Contact ${objectId} property ${propertyName} changed to ${propertyValue}`);
          break;
        
        case 'engagement.creation':
          console.log(`New engagement created: ${objectId}`);
          break;
        
        case 'engagement.deletion':
          console.log(`Engagement deleted: ${objectId}`);
          break;
        
        default:
          console.log(`Unhandled event type: ${subscriptionType}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing HubSpot webhook:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
