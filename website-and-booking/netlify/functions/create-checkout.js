exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { amount, treatmentName, paymentType, customerEmail, customerName } = JSON.parse(event.body);
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const origin = event.headers.origin || 'https://haloe.health';

    const productName = paymentType === 'deposit'
      ? `Deposit — ${treatmentName}`
      : `Full payment — ${treatmentName}`;

    const description = paymentType === 'deposit'
      ? 'Non-refundable deposit to secure your booking. Remainder payable on the day.'
      : `Full payment for ${treatmentName} with haloe.`;

    // Build form-encoded body for Stripe API
    const params = new URLSearchParams();
    params.append('payment_method_types[]', 'card');
    params.append('mode', 'payment');
    params.append('customer_email', customerEmail);
    params.append('line_items[0][price_data][currency]', 'gbp');
    params.append('line_items[0][price_data][product_data][name]', productName);
    params.append('line_items[0][price_data][product_data][description]', description);
    params.append('line_items[0][price_data][unit_amount]', String(amount));
    params.append('line_items[0][quantity]', '1');
    params.append('metadata[customerName]', customerName);
    params.append('metadata[treatmentName]', treatmentName);
    params.append('metadata[paymentType]', paymentType);
    params.append('success_url', `${origin}/booking-confirmed.html?type=${paymentType}`);
    params.append('cancel_url', `${origin}/book.html`);

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await response.json();

    if (!response.ok) {
      console.error('Stripe error:', session);
      return { statusCode: 500, body: JSON.stringify({ error: session.error?.message || 'Stripe error' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ url: session.url }),
    };

  } catch (err) {
    console.error('Function error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
