// Validation and state rules for the product list (Firestore "products" documents). Pure, no I/O.
// The same "active" rule is mirrored in src/lib/product-list.js for the PWA.

const ASIN_PATTERN = /^[A-Z0-9]{10}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

export function isIsoDate(value) {
  return typeof value === 'string' && ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

// A product is active when it has no archivedAt (absent or null). Archived products are kept in the file but not tracked.
export function isActive(product) {
  return !product.archivedAt;
}

// Input: the Firestore documents of the "products" collection as { id, data }, where id is the ASIN.
// Returns the validated product list. A document whose asin field differs from its id is rejected.
export function productsFromDocuments(documents) {
  const products = documents.map(({ id, data }) => {
    if (data?.asin !== id) {
      throw new Error(`Documento products/${id}: il campo asin non corrisponde all'id`);
    }
    return data;
  });
  return validateProducts(products);
}

export function validateProducts(products) {
  if (!Array.isArray(products)) {
    throw new Error('La lista prodotti deve essere un array');
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
    if (product.name !== undefined && typeof product.name !== 'string') {
      throw new Error(`${product.asin}: name deve essere una stringa`);
    }
    if (product.addedAt !== undefined && !isIsoDate(product.addedAt)) {
      throw new Error(`${product.asin}: addedAt deve essere una data ISO`);
    }
    if (product.archivedAt !== undefined && product.archivedAt !== null && !isIsoDate(product.archivedAt)) {
      throw new Error(`${product.asin}: archivedAt deve essere una data ISO o null`);
    }
  });
  return products;
}
