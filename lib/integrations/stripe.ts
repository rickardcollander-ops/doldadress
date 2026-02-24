import Stripe from 'stripe';

export class StripeService {
  private stripe: Stripe;

  constructor(apiKey: string) {
    this.stripe = new Stripe(apiKey, {
      apiVersion: '2024-12-18.acacia',
    });
  }

  async getCustomerByEmail(email: string) {
    try {
      const customers = await this.stripe.customers.list({
        email,
        limit: 1,
      });
      return customers.data[0] || null;
    } catch (error) {
      console.error('Error fetching Stripe customer:', error);
      return null;
    }
  }

  async getCustomerContext(email: string) {
    try {
      const customer = await this.getCustomerByEmail(email);
      if (!customer) return null;

      const [subscriptions, invoices, charges] = await Promise.all([
        this.stripe.subscriptions.list({ customer: customer.id, limit: 10 }),
        this.stripe.invoices.list({ customer: customer.id, limit: 10 }),
        this.stripe.charges.list({ customer: customer.id, limit: 10 }),
      ]);

      return {
        customerId: customer.id,
        subscriptions: subscriptions.data.map(sub => ({
          id: sub.id,
          status: sub.status,
          currentPeriodEnd: sub.current_period_end,
          items: sub.items.data.map(item => ({
            price: item.price.unit_amount,
            product: item.price.product,
          })),
        })),
        invoices: invoices.data.map(inv => ({
          id: inv.id,
          status: inv.status,
          amount: inv.amount_due,
          dueDate: inv.due_date,
          paid: inv.paid,
        })),
        charges: charges.data.map(charge => ({
          id: charge.id,
          amount: charge.amount,
          status: charge.status,
          created: charge.created,
        })),
      };
    } catch (error) {
      console.error('Error fetching Stripe context:', error);
      return null;
    }
  }
}
