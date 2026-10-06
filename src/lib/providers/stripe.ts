import { fetchNoRedirect } from '../fetchNoRedirect';
/**
 * REAL Stripe integration — creates a Checkout Session and returns its
 * hosted-payment URL. paymentProvider() selects THIS module the moment
 * STRIPE_SECRET_KEY holds a real value.
 *
 * Written to Stripe's documented Checkout Sessions API (form-encoded, no
 * SDK dependency). It is a complete implementation, but — like the whole
 * payment path — must be proven with ONE real test-mode transaction before
 * launch (part of the release gate): a placeholder-detected key never reaches
 * this code, and no live charge has been exercised end-to-end from here yet.
 *
 * The webhook (checkout.session.completed) is the only trusted "paid" signal;
 * the success redirect is never treated as proof of payment.
 */
import type {
  CreateOrderInput,
  ExistingOrder,
  PaymentOrder,
  PaymentProvider,
} from '../payments';
import { requireEnv } from '../env';

export const stripeReal: PaymentProvider = {
  name: 'stripe',
  isStub: false,

  // Reuse an existing Checkout Session while it is still open, so a resumed
  // purchase does not open a SECOND payable session for the same booking
  // (double-charge prevention). Returns null if expired/complete/unknown.
  async getOrder(orderId: string): Promise<ExistingOrder | null> {
    const secret = requireEnv('STRIPE_SECRET_KEY');
    const res = await fetchNoRedirect(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(orderId)}`,
      { headers: { authorization: `Bearer ${secret}` } }
    );
    if (!res.ok) return null;
    const session = (await res.json()) as { status?: string; url?: string };
    if (session.status === 'open' && session.url) {
      return { open: true, checkoutUrl: session.url };
    }
    return { open: false };
  },

  async createOrder(input: CreateOrderInput): Promise<PaymentOrder> {
    const secret = requireEnv('STRIPE_SECRET_KEY');

    const params = new URLSearchParams();
    params.set('mode', 'payment');
    params.set(
      'success_url',
      input.successUrl ?? 'https://solborne.com/dashboard/?package=success'
    );
    params.set('cancel_url', input.cancelUrl ?? 'https://solborne.com/dashboard/');
    // The booking id travels on the session so the webhook can cross-check it;
    // the session id itself is the stored order id we key capture on.
    params.set('client_reference_id', input.bookingId);
    params.set('metadata[booking_id]', input.bookingId);
    params.set('line_items[0][quantity]', '1');
    params.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
    params.set('line_items[0][price_data][unit_amount]', String(input.amountMinor));
    params.set(
      'line_items[0][price_data][product_data][name]',
      input.description ?? 'Solborne & Co. — screening package'
    );

    const res = await fetchNoRedirect('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(
        `Stripe Checkout Session creation failed: ${res.status} ${detail.slice(0, 300)}`
      );
    }
    const session = (await res.json()) as {
      id: string;
      url?: string;
      amount_total?: number;
      currency?: string;
    };
    return {
      orderId: session.id,
      amountMinor: session.amount_total ?? input.amountMinor,
      currency: (session.currency ?? input.currency).toUpperCase(),
      checkoutUrl: session.url,
      stub: false,
    };
  },
};
