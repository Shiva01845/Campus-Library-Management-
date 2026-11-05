import { getCatalogueRequest } from './catalogue-request.ts';

const listingCases = [
  { message: 'Show me all available books in the library.', availableOnly: true },
  { message: 'What books are available?', availableOnly: true },
  { message: 'List all books in the library.', availableOnly: false },
  { message: 'Display available books.', availableOnly: true },
  { message: 'Show me the library catalogue.', availableOnly: false },
];

Deno.test('recognizes broad catalogue-list requests', () => {
  for (const testCase of listingCases) {
    const actual = getCatalogueRequest(testCase.message);
    if (!actual || actual.availableOnly !== testCase.availableOnly || actual.offset !== 0) {
      throw new Error(`Catalogue request was not classified correctly: ${testCase.message}`);
    }
  }
});

Deno.test('leaves keyword searches for the existing AI book-search flow', () => {
  for (const message of ['Find Java books.', 'Show me available Python books.']) {
    if (getCatalogueRequest(message) !== null) {
      throw new Error(`Keyword search was classified as a broad catalogue request: ${message}`);
    }
  }
});

Deno.test('recognizes following catalogue pages', () => {
  const nextPage = getCatalogueRequest('Show next available books.');
  const numberedPage = getCatalogueRequest('Show books 21-30.');
  const keywordNextPage = getCatalogueRequest('Show next Java books.');

  if (!nextPage || nextPage.offset !== 10 || !nextPage.availableOnly) {
    throw new Error('The next available-books page was not recognized.');
  }
  if (!numberedPage || numberedPage.offset !== 20 || numberedPage.availableOnly) {
    throw new Error('The numbered catalogue page was not recognized.');
  }
  if (keywordNextPage !== null) {
    throw new Error('A keyword-search continuation was classified as a broad catalogue request.');
  }
});
