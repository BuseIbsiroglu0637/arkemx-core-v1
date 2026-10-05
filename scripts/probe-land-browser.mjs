import { searchEmlakjet } from './lib/emlakjet-browser.mjs';

const criteria = { province: 'Kastamonu', district: 'Merkez', tenure: 'sale', minArea: 1000, maxArea: 0, maxPrice: 0, use: 'residential', needs: [] };
try {
  const result = await searchEmlakjet(criteria);
  console.log(JSON.stringify({ criteria, ...result }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ criteria, code: error.code || 'unavailable', error: error.message,
    sources: [{ name: 'Emlakjet', status: error.code === 'source-blocked' ? 'blocked' : 'failed', readCount: 0, totalCount: null }] }, null, 2));
  process.exitCode = 1;
}
