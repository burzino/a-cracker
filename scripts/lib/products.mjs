// Validation of data/products.json. Pure, so the update script fails fast on a bad list.

const ASIN_PATTERN = /^[A-Z0-9]{10}$/;

export function validateProducts(products) {
  if (!Array.isArray(products)) {
    throw new Error('products.json deve contenere un array');
  }
  const seen = new Set();
  products.forEach((product, index) => {
    if (typeof product?.asin !== 'string' || !ASIN_PATTERN.test(product.asin)) {
      throw new Error(`Voce ${index}: ASIN non valido (${JSON.stringify(product?.asin)})`);
    }
    if (seen.has(product.asin)) {
      throw new Error(`ASIN duplicato: ${product.asin}`);
    }
    seen.add(product.asin);
    if (product.targetPrice !== undefined && !(Number(product.targetPrice) > 0)) {
      throw new Error(`${product.asin}: targetPrice deve essere un numero positivo`);
    }
  });
  return products;
}
