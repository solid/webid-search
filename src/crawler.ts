import { parseRdf } from '@ldo/ldo';
import { SolidProfileShapeType } from './ldo/solidProfile.shapeTypes.js';
import fs from 'fs/promises';

const MAX_CONCURRENT_REQUESTS = 100;

const queue: { url: string, depth: number }[] = (await fs.readdir('webids/'))
  .filter((file) => file.endsWith('.ttl'))
  .map((file) => ({ url: decodeURIComponent(file.slice(0, -4)), depth: 0 }));

const visited = new Set<string>(queue.map(item => item.url));
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

    if (webIDInfo.oidcIssuer) {
      console.log(`Discovered WebID: ${webID.url}`);
      count++;
      await fs.writeFile(`webids/${encodeURIComponent(webID.url)}.ttl`, ttl).catch(() => {});
    } else {
      console.log(`Ignored (no OIDC issuer): ${webID.url}`);
    }

    if (webID.depth < 3) {
      for (const friend of webIDInfo.knows || []) {
        if (!visited.has(friend)) {
          visited.add(friend);
          queue.push({ url: friend, depth: webIDInfo.oidcIssuer ? 0 : webID.depth + 1 });
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

console.log('Crawling started. Press Ctrl+C to stop.');

process.on('exit', () => {
  console.log(`Crawled ${count} WebIDs.`);
});
