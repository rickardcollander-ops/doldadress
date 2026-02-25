import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { google } from 'googleapis';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session?.user?.email) {
      return NextResponse.redirect(new URL('/auth/signin', request.url));
    }

    // Force HTTPS and remove trailing slash to match Google Console exactly
    let callbackOrigin = process.env.GOOGLE_OAUTH_BASE_URL || request.nextUrl.origin;
    callbackOrigin = callbackOrigin.replace(/\/$/, ''); // Remove trailing slash
    
    // Ensure HTTPS in production
    if (!callbackOrigin.includes('localhost')) {
      callbackOrigin = callbackOrigin.replace(/^http:/, 'https:');
    }
    
    const callbackUrl = `${callbackOrigin}/api/auth/gmail/callback`;

    console.log('[Gmail OAuth DEBUG] GOOGLE_OAUTH_BASE_URL:', process.env.GOOGLE_OAUTH_BASE_URL);
    console.log('[Gmail OAuth DEBUG] request.nextUrl.origin:', request.nextUrl.origin);
    console.log('[Gmail OAuth DEBUG] Final callbackOrigin:', callbackOrigin);
    console.log('[Gmail OAuth DEBUG] Final callbackUrl:', callbackUrl);

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

    console.log('[Gmail OAuth] Generated authUrl redirect_uri:', new URL(authUrl).searchParams.get('redirect_uri'));

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error authorizing Gmail:', error);
    return NextResponse.json(
      { error: 'Failed to authorize Gmail' },
      { status: 500 }
    );
  }
}
