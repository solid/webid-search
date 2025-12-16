import { parseRdf } from '@ldo/ldo';
import { SolidProfileShapeType } from './ldo/solidProfile.shapeTypes.js';
import fs from 'fs/promises';

const MAX_CONCURRENT_REQUESTS = 100;

// Parse CLI arguments for additional seed URLs
const cliSeeds = process.argv.slice(2).map((url) => ({ url, depth: 0 }));

const existingSeeds: { url: string, depth: number }[] = (await fs.readdir('webids/'))
  .filter((file) => file.endsWith('.ttl'))
  .map((file) => ({ url: decodeURIComponent(file.slice(0, -4)), depth: 0 }));

// Combine existing seeds with CLI seeds, avoiding duplicates
const visited = new Set<string>(existingSeeds.map(item => item.url));
const queue: { url: string, depth: number }[] = [...existingSeeds];

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
