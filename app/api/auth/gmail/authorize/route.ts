import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    const callbackOrigin = process.env.GOOGLE_OAUTH_BASE_URL?.replace(/\/$/, '') || request.nextUrl.origin;
    const callbackUrl = `${callbackOrigin}/api/auth/gmail/callback`;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl
    );

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify',
        'https://www.googleapis.com/auth/gmail.send',
      ],
      prompt: 'consent',
    });

    console.log('[Gmail OAuth] callbackUrl:', callbackUrl);
    console.log('[Gmail OAuth] authUrl redirect_uri:', new URL(authUrl).searchParams.get('redirect_uri'));
    console.log('[Gmail OAuth] full authUrl:', authUrl);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error authorizing Gmail:', error);
    return NextResponse.json(
      { error: 'Failed to authorize Gmail' },
      { status: 500 }
    );
  }
}
