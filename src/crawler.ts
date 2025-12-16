import { parseRdf } from '@ldo/ldo';
import { SolidProfileShapeType } from './ldo/solidProfile.shapeTypes.js';
import fs from 'fs/promises';

const MAX_CONCURRENT_REQUESTS = 100;

const queue: string[] = (await fs.readdir('webids/'))
  .filter((file) => file.endsWith('.ttl'))
  .map((file) => decodeURIComponent(file.slice(0, -4)));

const visited = new Set<string>(queue);
let count = 0;

async function handleWebID(webID: string): Promise<void> {
  try {
    const res = await fetch(webID, {
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
      .fromSubject(webID);

    if (webIDInfo && webIDInfo?.oidcIssuer) {
      console.log(`Discovered WebID: ${webID}`);
      console.log(webIDInfo.oidcIssuer);
      count++;
      await fs.writeFile(`webids/${encodeURIComponent(webID)}.ttl`, ttl).catch(() => {});

      for (const known of webIDInfo.knows || []) {
        if (known['@id'] && !visited.has(known['@id'])) {
          visited.add(known['@id']);
          queue.push(known['@id']);
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
