import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BILLECTA_BASE_URL = 'https://api.billecta.com';
const ZENDESK_IMPORT_MARKER = '[Zendesk Import Source:';

function decodeBase64IfPossible(value) {
  try {
    const candidate = String(value || '').trim();
    if (!candidate || candidate.length < 20) return null;
    if (!/^[A-Za-z0-9+/=]+$/.test(candidate) || candidate.length % 4 !== 0) return null;

    const decoded = Buffer.from(candidate, 'base64').toString('utf8').trim();
    if (!decoded || decoded === candidate || decoded.length < 10) return null;
    if (!/^[\x21-\x7E]+$/.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function getApiKeyVariants(rawApiKey) {
  const variants = [];
  const seen = new Set();

  const add = (value) => {
    const trimmed = String(value || '').trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    variants.push(trimmed);
  };

  add(rawApiKey);
  const decodedOnce = decodeBase64IfPossible(rawApiKey);
  add(decodedOnce);
  const decodedTwice = decodedOnce ? decodeBase64IfPossible(decodedOnce) : null;
  add(decodedTwice);

  add(Buffer.from(String(rawApiKey || '').trim(), 'utf8').toString('base64'));
  if (decodedOnce) add(Buffer.from(decodedOnce, 'utf8').toString('base64'));

  return variants;
}

async function billectaRequest(endpoint, apiKey) {
  const keyVariants = getApiKeyVariants(apiKey);
  const authSchemes = ['Bearer', 'SecureToken'];
  let lastStatusText = 'Unauthorized';
  let lastStatusCode = 401;
  const attempts = [];

  for (let keyIndex = 0; keyIndex < keyVariants.length; keyIndex += 1) {
    const variant = keyVariants[keyIndex];
    for (const scheme of authSchemes) {
      const response = await fetch(`${BILLECTA_BASE_URL}${endpoint}`, {
        headers: {
          Authorization: `${scheme} ${variant}`,
          'Content-Type': 'application/json',
        },
      });

      const responseText = await response.text().catch(() => '');
      const bodySnippet = responseText.slice(0, 180);
      lastStatusText = response.statusText || lastStatusText;
      lastStatusCode = response.status || lastStatusCode;

      attempts.push({
        endpoint,
        scheme,
        keyIndex,
        status: response.status,
        statusText: response.statusText || '',
        bodySnippet,
      });

      if (response.ok) {
        return responseText ? JSON.parse(responseText) : {};
      }
    }
  }

  throw new Error(`Billecta API error: ${lastStatusCode} ${lastStatusText} | attempts=${JSON.stringify(attempts)}`);
}

async function billectaRequestFirstAvailable(endpoints, apiKey) {
  const endpointErrors = [];

  for (const endpoint of endpoints) {
    try {
      return await billectaRequest(endpoint, apiKey);
    } catch (error) {
      endpointErrors.push({
        endpoint,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw new Error(`Billecta API request failed | endpointErrors=${JSON.stringify(endpointErrors)}`);
}

async function getBillectaContext(email, credentials) {
  const debtorResponse = await billectaRequestFirstAvailable(
    [
      `/v1/creditors/creditor/${credentials.creditorPublicId}/debtors?search=${encodeURIComponent(email)}`,
      `/v1/creditors/${credentials.creditorPublicId}/debtors?search=${encodeURIComponent(email)}`,
      `/api/v1/creditors/creditor/${credentials.creditorPublicId}/debtors?search=${encodeURIComponent(email)}`,
      `/api/v1/creditors/${credentials.creditorPublicId}/debtors?search=${encodeURIComponent(email)}`,
    ],
    credentials.apiKey
  );

  const debtor = debtorResponse?.data?.[0];
  if (!debtor?.DebtorPublicId) return null;

  const invoicesResponse = await billectaRequestFirstAvailable(
    [
      `/v1/creditors/creditor/${credentials.creditorPublicId}/debtors/${debtor.DebtorPublicId}/invoices`,
      `/v1/creditors/${credentials.creditorPublicId}/debtors/${debtor.DebtorPublicId}/invoices`,
      `/api/v1/creditors/creditor/${credentials.creditorPublicId}/debtors/${debtor.DebtorPublicId}/invoices`,
      `/api/v1/creditors/${credentials.creditorPublicId}/debtors/${debtor.DebtorPublicId}/invoices`,
    ],
    credentials.apiKey
  );

  return {
    creditorPublicId: credentials.creditorPublicId,
    debtorPublicId: debtor.DebtorPublicId,
    invoices:
      invoicesResponse?.data?.map((inv) => ({
        id: inv.InvoicePublicId,
        number: inv.InvoiceNumber,
        status: inv.State,
        amount: inv.TotalAmount,
        dueDate: inv.DueDate,
        isPaid: inv.IsPaid,
      })) || [],
  };
}

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { subdomain: 'doldadress' },
    select: { id: true },
  });

  if (!tenant) throw new Error("Tenant 'doldadress' not found");

  const billectaIntegration = await prisma.integration.findFirst({
    where: {
      tenantId: tenant.id,
      type: 'billecta',
      isActive: true,
    },
    select: { credentials: true },
  });

  if (!billectaIntegration?.credentials?.apiKey || !billectaIntegration?.credentials?.creditorPublicId) {
    throw new Error('No active Billecta integration with credentials found');
  }

  const inboxTickets = await prisma.ticket.findMany({
    where: {
      tenantId: tenant.id,
      NOT: {
        originalMessage: {
          contains: ZENDESK_IMPORT_MARKER,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 4,
    select: {
      id: true,
      customerEmail: true,
      subject: true,
      contextData: true,
      createdAt: true,
    },
  });

  console.log(`Processing ${inboxTickets.length} inbox tickets (latest 4).`);

  for (const ticket of inboxTickets) {
    try {
      const billecta = await getBillectaContext(ticket.customerEmail, billectaIntegration.credentials);

      if (!billecta) {
        console.log(`SKIPPED | ${ticket.id} | ${ticket.customerEmail} | no Billecta match`);
        continue;
      }

      await prisma.ticket.update({
        where: { id: ticket.id },
        data: {
          contextData: {
            ...(ticket.contextData || {}),
            billecta,
          },
        },
      });

      console.log(`UPDATED | ${ticket.id} | ${ticket.customerEmail} | invoices=${billecta.invoices.length}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(`ERROR   | ${ticket.id} | ${ticket.customerEmail} | ${message}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
