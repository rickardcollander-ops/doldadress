import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

function decodeBase64IfPossible(value: string): string | null {
  try {
    const candidate = value.trim();
    if (!candidate || candidate.length < 20) return null;

    if (!/^[A-Za-z0-9+/=]+$/.test(candidate) || candidate.length % 4 !== 0) {
      return null;
    }

    const decoded = Buffer.from(candidate, 'base64').toString('utf8').trim();
    if (!decoded || decoded === candidate || decoded.length < 10) return null;
    // Header-safe token only (printable ASCII, no whitespace/control chars)
    if (!/^[\x21-\x7E]+$/.test(decoded)) return null;

    return decoded;
  } catch {
    return null;
  }
}

function getApiKeyVariants(apiKey: string): string[] {
  const variants: string[] = [];
  const seen = new Set<string>();

  const add = (value: string | null | undefined) => {
    const trimmed = String(value || '').trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    variants.push(trimmed);
  };

  add(apiKey);
  const decodedOnce = decodeBase64IfPossible(apiKey);
  add(decodedOnce);
  const decodedTwice = decodedOnce ? decodeBase64IfPossible(decodedOnce) : null;
  add(decodedTwice);

  const encodedRaw = Buffer.from(String(apiKey || '').trim(), 'utf8').toString('base64').trim();
  add(encodedRaw);
  const encodedDecodedOnce = decodedOnce ? Buffer.from(decodedOnce, 'utf8').toString('base64').trim() : null;
  add(encodedDecodedOnce);

  return variants;
}

async function billectaProbe(creditorPublicId: string, apiKey: string) {
  // Verified with Billecta support/developer tooling: this endpoint returns 200 when token + creditor are correct
  const endpoint = `https://api.billecta.com/v1/creditors/creditor/${creditorPublicId}`;

  const requestWithAuth = async (scheme: 'Bearer' | 'SecureToken', key: string) => {
    const res = await fetch(endpoint, {
      headers: {
        Authorization: `${scheme} ${key}`,
        'Content-Type': 'application/json',
      },
    });

    return res;
  };

  const candidates = getApiKeyVariants(apiKey);
  const schemes: Array<'Bearer' | 'SecureToken'> = ['Bearer', 'SecureToken'];
  let lastStatus = 401;
  let lastScheme: 'Bearer' | 'SecureToken' = 'Bearer';
  let lastBodySnippet = '';

  for (const key of candidates) {
    for (const scheme of schemes) {
      const res = await requestWithAuth(scheme, key);
      lastStatus = res.status;
      lastScheme = scheme;
      if (res.ok) {
        const body = await res.json();
        return {
          ok: true,
          upstreamStatus: res.status,
          authScheme: scheme,
          usedDecodedKey: key !== apiKey.trim(),
          matchedCreditorPublicId: body?.CreditorPublicId || null,
          message: `Billecta auth OK (${scheme})`,
        };
      }

      const bodyText = await res.text().catch(() => '');
      lastBodySnippet = bodyText.slice(0, 200);
    }
  }

  return {
    ok: false,
    upstreamStatus: lastStatus,
    authScheme: lastScheme,
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
