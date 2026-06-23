const https = require('https');
const http = require('http');

// Test SKUs from Ateneum file
const testSKUs = ['127705', '127712', '125244', '125190', '102146'];

// Common toy/wholesale CDN URL patterns to test
const urlPatterns = [
  sku => `https://www.askato.pl/media/catalog/product/p/${sku[0]}/${sku[1]}/${sku}.jpg`,
  sku => `https://www.askato.pl/media/catalog/product/${sku}.jpg`,
  sku => `https://askato.pl/media/catalog/product/p/${sku}.jpg`,
  sku => `https://www.askato.pl/pub/media/catalog/product/${sku}.jpg`,
  sku => `https://cdn.askato.pl/products/${sku}.jpg`,
  sku => `https://www.askato.pl/zdjecia/${sku}.jpg`,
];

function checkUrl(url) {
  return new Promise(resolve => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 5000 }, res => {
      resolve({ url, status: res.statusCode, ok: res.statusCode === 200 });
      res.destroy();
    });
    req.on('error', () => resolve({ url, status: 0, ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ url, status: 0, ok: false }); });
  });
}

async function main() {
  const sku = testSKUs[0];
  console.log(`Testuję URL-e dla SKU: ${sku}\n`);
  
  for (const pattern of urlPatterns) {
    const url = pattern(sku);
    const result = await checkUrl(url);
    console.log(`${result.ok ? '✅' : '❌'} [${result.status}] ${url}`);
  }
  
  // Also try to find image URL by visiting askato.pl product page
  console.log('\n--- Sprawdzam stronę produktu ---');
  const pageUrl = `https://www.askato.pl/${sku}`;
  const pageResult = await checkUrl(pageUrl);
  console.log(`Strona produktu: ${pageResult.status} - ${pageUrl}`);
}

main().catch(console.error);
