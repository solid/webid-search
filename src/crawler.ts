import { parseRdf } from '@ldo/ldo';
import { SolidProfileShapeType } from './ldo/solidProfile.shapeTypes.js';
import { CatalogPersonShapeType } from './ldo/catalogPerson.shapeTypes.js';
import fs from 'fs/promises';
import DF from '@rdfjs/data-model';

const CATALOG_URL = 'https://raw.githubusercontent.com/solid/catalog/refs/heads/main/catalog-data.ttl';
const MAX_CONCURRENT_REQUESTS = 100;

// Fetch WebIDs from the Solid catalog
async function fetchCatalogWebIDs(): Promise<string[]> {
  try {
    const res = await fetch(CATALOG_URL);
    if (!res.ok) {
      console.error(`Failed to fetch catalog: ${res.status}`);
      return [];
    }
    const ttl = await res.text();
    
    const catalog = await parseRdf(ttl, { baseIRI: CATALOG_URL });
    const persons = catalog.usingType(CatalogPersonShapeType).matchSubject(
      DF.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
      DF.namedNode('http://example.org#Person')
    );
    
    const webids: string[] = [];
    for (const person of persons) {
      if (person.webid) {
        webids.push(person.webid['@id']);
      }
    }
    
    return webids;
  } catch (error) {
    console.error('Error fetching catalog:', error);
    return [];
  }
}

// Parse CLI arguments for additional seed URLs
const cliSeeds = process.argv.slice(2).map((url) => ({ url, depth: 0 }));

const existingSeeds: { url: string, depth: number }[] = (await fs.readdir('webids/'))
  .filter((file) => file.endsWith('.ttl'))
  .map((file) => ({ url: decodeURIComponent(file.slice(0, -4)), depth: 0 }));

// Fetch catalog WebIDs
console.log('Fetching WebIDs from Solid catalog...');
const catalogWebIDs = await fetchCatalogWebIDs();
console.log(`Found ${catalogWebIDs.length} WebIDs in catalog.`);
const catalogSeeds = catalogWebIDs.map((url) => ({ url, depth: 0 }));

// Combine existing seeds with CLI seeds and catalog seeds, avoiding duplicates
const visited = new Set<string>(existingSeeds.map(item => item.url));
const queue: { url: string, depth: number }[] = [...existingSeeds];

// Add catalog seeds (de-duplicated)
let catalogAdded = 0;
for (const seed of catalogSeeds) {
  if (!visited.has(seed.url)) {
    visited.add(seed.url);
    queue.push(seed);
    catalogAdded++;
  }
}
console.log(`Added ${catalogAdded} new WebIDs from catalog (${catalogWebIDs.length - catalogAdded} already existed).`);

// Add CLI seeds (de-duplicated)
for (const seed of cliSeeds) {
  if (!visited.has(seed.url)) {
    visited.add(seed.url);
    queue.push(seed);
  }
}
let count = 0;

async function handleWebID(webID: { url: string, depth: number }): Promise<void> {
  try {
    const res = await fetch(webID.url, {
      headers: {
        'Accept': 'text/turtle',
      },
    });

    if (!res.ok) {
      return;
    }

    const ttl = await res.text();

    const profile = await parseRdf(ttl, { baseIRI: res.url });

    // Process profile to extract WebID info
    const webIDInfo = profile
      .usingType(SolidProfileShapeType)
      .fromSubject(webID.url);

    const oidcIssuers = [...(webIDInfo.oidcIssuer || [])];
    const hasOidcIssuer = oidcIssuers.length > 0;
    if (hasOidcIssuer) {
      console.log(`Discovered WebID: ${webID.url}`);
      count++;
      await fs.writeFile(`webids/${encodeURIComponent(webID.url)}.ttl`, ttl).catch(() => {});
    } else {
      console.log(`Ignored (no OIDC issuer): ${webID.url}`);
    }

    if (webID.depth < 3) {
      for (const friend of webIDInfo.knows || []) {
        const friendUrl = friend['@id'];
        if (!visited.has(friendUrl)) {
          visited.add(friendUrl);
          queue.push({ url: friendUrl, depth: hasOidcIssuer ? 0 : webID.depth + 1 });
        }
      }
    }
  } catch (error) {
    // Error handling
  }
}

let concurrentRequests = 0;

function processQueue(): void {
  while (queue.length > 0 && concurrentRequests <= MAX_CONCURRENT_REQUESTS) {
    concurrentRequests++;
    handleWebID(queue.shift()!)
      .finally(() => {
        concurrentRequests--;
        processQueue();
      });
  }
}

processQueue();

if (cliSeeds.length > 0) {
  console.log(`Added ${cliSeeds.length} seed(s) from CLI arguments.`);
}
console.log(`Crawling started with ${queue.length} initial seed(s). Press Ctrl+C to stop.`);

process.on('exit', () => {
  console.log(`Crawled ${count} WebIDs.`);
});
