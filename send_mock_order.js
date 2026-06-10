async function sendOrder() {
  const payload = {
    userId: 'client-1',
    guestDeviceId: null,
    clientName: 'Test Client',
    clientNip: '1234567890',
    clientEmail: 'hurtownik@example.com',
    clientPhone: '123456789',
    comments: 'no comments',
    items: [
      {
        id: 'prod-1',
        sku: 'SKU1',
        ean: 'EAN1',
        name: 'Test Product',
        quantity: 5,
        price: 20.10
      }
    ]
  };

  try {
    const res = await fetch('http://localhost:3002/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    console.log('STATUS:', res.status);
    console.log('RESPONSE:', data);
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}

sendOrder();
