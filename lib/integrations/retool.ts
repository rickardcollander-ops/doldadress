export class RetoolService {
  private apiKey: string;
  private workspaceUrl: string;

  constructor(apiKey: string, workspaceUrl: string) {
    this.apiKey = apiKey;
    this.workspaceUrl = workspaceUrl;
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.workspaceUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Retool API error: ${response.statusText}`);
    }

    return response.json();
  }

  async getCustomerContext(email: string) {
    try {
      const response = await this.request(`/api/customer?email=${encodeURIComponent(email)}`);
      return {
        data: response,
      };
    } catch (error) {
      console.error('Error fetching Retool context:', error);
      return null;
    }
  }
}
