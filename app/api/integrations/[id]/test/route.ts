import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

/**
 * Per Billecta docs (https://docs.billecta.com/api):
 * - Auth: SecureToken must be base64-encoded in the Authorization header
 * - Endpoint to verify credentials: GET /v1/creditors/creditors (returns all creditors for user)
 */
async function billectaProbe(creditorPublicId: string, apiKey: string) {
  const baseUrl = 'https://api.billecta.com';
  const endpoint = `${baseUrl}/v1/creditors/creditors`;

  const raw = apiKey.trim();
  const encoded = Buffer.from(raw, 'utf8').toString('base64');

  // Try both: base64(raw) and raw-as-is (in case it's already encoded)
  const tokenVariants = [...new Set([encoded, raw])];

  let lastStatus = 401;
  let lastBodySnippet = '';

  for (const token of tokenVariants) {
    const res = await fetch(endpoint, {
      headers: {
        'Authorization': `SecureToken ${token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    lastStatus = res.status;

    if (res.ok) {
      const body = await res.json();
      const creditors = Array.isArray(body) ? body : [];
      const matched = creditors.find(
        (c: any) => c.CreditorPublicId === creditorPublicId
      );

      return {
        ok: true,
        upstreamStatus: res.status,
        authScheme: 'SecureToken',
        usedEncodedKey: token === encoded,
        matchedCreditorPublicId: matched?.CreditorPublicId || null,
        creditorName: matched?.Name || null,
        totalCreditors: creditors.length,
        message: matched
          ? `Billecta OK — creditor "${matched.Name}" found`
          : `Billecta auth OK but creditorPublicId not found among ${creditors.length} creditors`,
      };
    }

    lastBodySnippet = (await res.text().catch(() => '')).slice(0, 200);
  }

  return {
    ok: false,
    upstreamStatus: lastStatus,
    authScheme: 'SecureToken',
    ...(process.env.NODE_ENV !== 'production' && lastBodySnippet
      ? { upstreamBodySnippet: lastBodySnippet }
      : {}),
    message: `Billecta auth failed: HTTP ${lastStatus}`,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json().catch(() => ({}));
    const email = typeof body?.email === 'string' && body.email.trim().length > 0
      ? body.email.trim()
      : 'test@example.com';

    const integration = await prisma.integration.findUnique({
      where: { id },
      select: { id: true, type: true, credentials: true, isActive: true },
    });

    if (!integration) {
      return NextResponse.json({ ok: false, message: 'Integration not found' }, { status: 404 });
    }

    if (integration.type !== 'billecta') {
      return NextResponse.json({ ok: false, message: 'Test endpoint currently supports Billecta only' }, { status: 400 });
    }

    const credentials = integration.credentials as Record<string, string>;
    const apiKey = String(credentials.apiKey || '').trim();
    const creditorPublicId = String(credentials.creditorPublicId || '').trim();

    if (!apiKey || !creditorPublicId) {
      return NextResponse.json(
        {
          ok: false,
          message: 'Missing credentials: apiKey and creditorPublicId are required',
        },
        { status: 400 }
      );
    }

    const result = await billectaProbe(creditorPublicId, apiKey);

    return NextResponse.json({
      integrationId: integration.id,
      integrationType: integration.type,
      isActive: integration.isActive,
      testedEmail: email,
      ...result,
    });
  } catch (error) {
    console.error('Error testing integration connection:', error);
    const details = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        ok: false,
        message: 'Failed to test integration connection',
        ...(process.env.NODE_ENV !== 'production' ? { details } : {}),
      },
      { status: 500 }
    );
  }
}
