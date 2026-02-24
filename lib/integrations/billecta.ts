export class BillectaService {
  private apiKey: string;
  private creditorPublicId: string;
  private baseUrl = 'https://api.billecta.com';

  constructor(apiKey: string, creditorPublicId: string) {
    this.apiKey = apiKey;
    this.creditorPublicId = creditorPublicId;
  }

  private decodeBase64IfPossible(value: string): string | null {
    try {
      const candidate = value?.trim();
      if (!candidate || candidate.length < 20) return null;

      if (!/^[A-Za-z0-9+/=]+$/.test(candidate) || candidate.length % 4 !== 0) {
        return null;
      }

      const decoded = Buffer.from(candidate, 'base64').toString('utf8').trim();
      if (!decoded || decoded === candidate || decoded.length < 10) return null;
      if (!/^[\x21-\x7E]+$/.test(decoded)) return null;

      return decoded;
    } catch {
      return null;
    }
  }

  private getApiKeyVariants(): string[] {
    const variants: string[] = [];
    const seen = new Set<string>();

    const add = (value: string | null | undefined) => {
      const trimmed = String(value || '').trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      variants.push(trimmed);
    };

    add(this.apiKey);
    const decodedOnce = this.decodeBase64IfPossible(this.apiKey);
    add(decodedOnce);
    const decodedTwice = decodedOnce ? this.decodeBase64IfPossible(decodedOnce) : null;
    add(decodedTwice);

    const encodedRaw = Buffer.from(String(this.apiKey || '').trim(), 'utf8').toString('base64').trim();
    add(encodedRaw);
    const encodedDecodedOnce = decodedOnce ? Buffer.from(decodedOnce, 'utf8').toString('base64').trim() : null;
    add(encodedDecodedOnce);

    return variants;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const apiKeyVariants = this.getApiKeyVariants();
    const authSchemes: Array<'Bearer' | 'SecureToken'> = ['Bearer', 'SecureToken'];
    let lastStatusText = 'Unauthorized';

    for (const apiKey of apiKeyVariants) {
      for (const scheme of authSchemes) {
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers: {
            'Authorization': `${scheme} ${apiKey}`,
            'Content-Type': 'application/json',
            ...options.headers,
          },
        });

        lastStatusText = response.statusText || lastStatusText;

        if (response.ok) {
          return response.json();
        }
      }
    }

    throw new Error(`Billecta API error: ${lastStatusText}`);
  }

  private async requestFirstAvailable(endpoints: string[], options: RequestInit = {}) {
    let lastError: unknown = null;

    for (const endpoint of endpoints) {
      try {
        return await this.request(endpoint, options);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError instanceof Error ? lastError : new Error('Billecta API request failed');
  }

  async getDebtorByEmail(email: string) {
    try {
      const response = await this.requestFirstAvailable([
        `/v1/creditors/creditor/${this.creditorPublicId}/debtors?search=${encodeURIComponent(email)}`,
        `/v1/creditors/${this.creditorPublicId}/debtors?search=${encodeURIComponent(email)}`,
        `/api/v1/creditors/creditor/${this.creditorPublicId}/debtors?search=${encodeURIComponent(email)}`,
        `/api/v1/creditors/${this.creditorPublicId}/debtors?search=${encodeURIComponent(email)}`,
      ]
      );
      return response.data?.[0] || null;
    } catch (error) {
      console.error('Error fetching Billecta debtor:', error);
      return null;
    }
  }

  async getCustomerContext(email: string) {
    try {
      const debtor = await this.getDebtorByEmail(email);
      if (!debtor) return null;

      const invoices = await this.requestFirstAvailable([
        `/v1/creditors/creditor/${this.creditorPublicId}/debtors/${debtor.DebtorPublicId}/invoices`,
        `/v1/creditors/${this.creditorPublicId}/debtors/${debtor.DebtorPublicId}/invoices`,
        `/api/v1/creditors/creditor/${this.creditorPublicId}/debtors/${debtor.DebtorPublicId}/invoices`,
        `/api/v1/creditors/${this.creditorPublicId}/debtors/${debtor.DebtorPublicId}/invoices`,
      ]);

      return {
        creditorPublicId: this.creditorPublicId,
        debtorPublicId: debtor.DebtorPublicId,
        invoices: invoices.data?.map((inv: any) => ({
          id: inv.InvoicePublicId,
          number: inv.InvoiceNumber,
          status: inv.State,
          amount: inv.TotalAmount,
          dueDate: inv.DueDate,
          isPaid: inv.IsPaid,
        })) || [],
      };
    } catch (error) {
      console.error('Error fetching Billecta context:', error);
      return null;
    }
  }
}
