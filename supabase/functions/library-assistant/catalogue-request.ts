export type CatalogueRequest = {
  availableOnly: boolean;
  offset: number;
};

const genericCatalogueTerms = new Set([
  'all',
  'any',
  'are',
  'books',
  'book',
  'can',
  'catalog',
  'catalogue',
  'collection',
  'display',
  'do',
  'every',
  'find',
  'get',
  'have',
  'in',
  'library',
  'list',
  'me',
  'more',
  'next',
  'our',
  'page',
  'please',
  'results',
  'see',
  'show',
  'the',
  'there',
  'titles',
  'want',
  'we',
  'what',
  'which',
  'you',
  'available',
]);

export function getRequestedBookOffset(message: string) {
  const requestedRange = message.match(/\b(?:books?|results?)\s+(\d{1,5})\s*(?:-|to)\s*\d{1,5}\b/i);
  if (requestedRange) {
    const firstResult = Number(requestedRange[1]);
    return Number.isInteger(firstResult) && firstResult > 0
      ? Math.min(firstResult - 1, 9990)
      : 0;
  }

  if (/\b(next|more)\b/i.test(message) && /\b(books?|results?|page)\b/i.test(message)) {
    return 10;
  }

  return 0;
}

export function getCatalogueRequest(message: string): CatalogueRequest | null {
  const normalized = message.toLowerCase().replace(/[^a-z0-9-]+/g, ' ').trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  if (!words.some((word) => /\b(?:books?|titles?|catalogue|catalog|collection)\b/.test(word))) return null;

  const offset = getRequestedBookOffset(message);
  const remainingTerms = words.filter((word) => !genericCatalogueTerms.has(word) && !/^\d+(?:-\d+)?$/.test(word));
  if (remainingTerms.length > 0) return null;

  return {
    availableOnly: /\bavailable\b|\bin[\s-]+stock\b/i.test(message),
    offset,
  };
}
