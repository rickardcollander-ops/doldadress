import { Resend } from 'resend';

export class ResendService {
  private resend: Resend;
  private fromEmail: string;

  constructor(apiKey: string, fromEmail: string) {
    this.resend = new Resend(apiKey);
    this.fromEmail = fromEmail;
  }

  async sendEmail(to: string, subject: string, html: string) {
    try {
      const response = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
      });
      return response;
    } catch (error) {
      console.error('Error sending email via Resend:', error);
      throw error;
    }
  }

  async getEmailHistory(email: string) {
    try {
      const response = await this.resend.emails.list();
      if (!response.data) return [];
      
      const emailList = Array.isArray(response.data) ? response.data : (response.data as any).data || [];
      const filtered = emailList.filter((e: any) => 
        e.to?.includes(email) || e.from?.includes(email)
      );
      
      return filtered.map((e: any) => ({
        id: e.id,
        subject: e.subject,
        from: e.from,
        to: e.to,
        createdAt: e.created_at,
      }));
    } catch (error) {
      console.error('Error fetching Resend email history:', error);
      return [];
    }
  }

  async getCustomerContext(email: string) {
    try {
      const emailHistory = await this.getEmailHistory(email);
      return {
        emailHistory,
      };
    } catch (error) {
      console.error('Error fetching Resend context:', error);
      return null;
    }
  }
}
