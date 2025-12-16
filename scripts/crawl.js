#!/usr/bin/env node

const fetch = require('node-fetch');
const $rdf = require('rdflib');
const fs = require('fs').promises;
const path = require('path');

/**
 * Crawls a WebID to discover linked WebIDs
 * @param {string} webid - The WebID or URL to crawl
 * @returns {Promise<Set<string>>} Set of discovered WebIDs
 */
async function crawlWebID(webid) {
  console.log(`Crawling WebID: ${webid}`);
  const discoveredWebIDs = new Set();
  
  try {
    // Fetch the WebID document
    const response = await fetch(webid, {
      headers: {
        'Accept': 'text/turtle, application/ld+json, application/rdf+xml, */*'
      }
    });
    
    if (!response.ok) {
      console.error(`Failed to fetch ${webid}: ${response.status} ${response.statusText}`);
      return discoveredWebIDs;
    }
    
    const contentType = response.headers.get('content-type') || 'text/turtle';
    const body = await response.text();
    
    // Parse RDF data
    const store = $rdf.graph();
    const doc = $rdf.sym(webid);
    
    let mimeType = 'text/turtle';
    if (contentType.includes('application/ld+json')) {
      mimeType = 'application/ld+json';
    } else if (contentType.includes('application/rdf+xml')) {
      mimeType = 'application/rdf+xml';
    }
    
    try {
      $rdf.parse(body, store, webid, mimeType);
    } catch (parseError) {
      console.error(`Failed to parse RDF from ${webid}:`, parseError.message);
      return discoveredWebIDs;
    }
    
    // Common predicates that might link to other WebIDs
    const predicates = [
      'http://xmlns.com/foaf/0.1/knows',
      'http://www.w3.org/ns/solid/terms#publicTypeIndex',
      'http://www.w3.org/ns/solid/terms#privateTypeIndex',
      'http://www.w3.org/ns/pim/space#storage',
      'http://xmlns.com/foaf/0.1/maker',
      'http://purl.org/dc/terms/creator',
      'http://xmlns.com/foaf/0.1/primaryTopic',
      'http://www.w3.org/2006/vcard/ns#hasURL',
      'http://xmlns.com/foaf/0.1/weblog',
      'http://xmlns.com/foaf/0.1/homepage',
      'http://xmlns.com/foaf/0.1/account'
    ];
    
    // Extract WebIDs from the RDF graph
    const statements = store.statementsMatching(null, null, null, doc);
    
    for (const statement of statements) {
      const subject = statement.subject.value;
      const predicate = statement.predicate.value;
      const object = statement.object.value;
      
      // Check if the object looks like a WebID (URI with fragment or profile-like path)
      if (object && object.startsWith('http')) {
        if (object.includes('#') || 
            object.includes('/profile') || 
            predicates.includes(predicate)) {
          // Validate it's not the same as input
          if (object !== webid && !discoveredWebIDs.has(object)) {
            console.log(`  Found WebID: ${object}`);
            discoveredWebIDs.add(object);
          }
        }
      }
      
      // Also check subject if it looks like a WebID
      if (subject && subject.startsWith('http') && subject !== webid) {
        if (subject.includes('#')) {
          if (!discoveredWebIDs.has(subject)) {
            console.log(`  Found WebID: ${subject}`);
            discoveredWebIDs.add(subject);
          }
        }
      }
    }
    
  } catch (error) {
    console.error(`Error crawling ${webid}:`, error.message);
  }
  
  return discoveredWebIDs;
}

/**
 * Loads existing WebIDs from the data file
 * @returns {Promise<Set<string>>} Set of existing WebIDs
 */
async function loadExistingWebIDs() {
  const dataPath = path.join(__dirname, '..', 'data', 'webids.json');
  try {
    const content = await fs.readFile(dataPath, 'utf8');
    const data = JSON.parse(content);
    return new Set(data.webids || []);
  } catch (error) {
    // File doesn't exist yet or is invalid
    return new Set();
  }
}

/**
 * Saves WebIDs to the data file
 * @param {Set<string>} webids - Set of WebIDs to save
 */
async function saveWebIDs(webids) {
  const dataPath = path.join(__dirname, '..', 'data', 'webids.json');
  const data = {
    lastUpdated: new Date().toISOString(),
    count: webids.size,
    webids: Array.from(webids).sort()
  };
  await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
}

/**
 * Main function
 */
async function main() {
  const webid = process.argv[2];
  
  if (!webid) {
    console.error('Usage: node crawl.js <webid>');
    process.exit(1);
  }
  
  console.log('Loading existing WebIDs...');
  const existingWebIDs = await loadExistingWebIDs();
  console.log(`Found ${existingWebIDs.size} existing WebIDs`);
  
  // Add the input WebID to the collection
  existingWebIDs.add(webid);
  
  // Crawl the WebID
  const discoveredWebIDs = await crawlWebID(webid);
  
  // Merge with existing
  let newCount = 0;
  for (const discovered of discoveredWebIDs) {
    if (!existingWebIDs.has(discovered)) {
      newCount++;
      existingWebIDs.add(discovered);
    }
  }
  
  console.log(`\nDiscovered ${discoveredWebIDs.size} WebIDs`);
  console.log(`${newCount} new WebIDs added to the collection`);
  console.log(`Total WebIDs: ${existingWebIDs.size}`);
  
  // Save the updated collection
  await saveWebIDs(existingWebIDs);
  console.log('\nWebIDs saved to data/webids.json');
  
  // Output summary for GitHub Actions
  if (newCount > 0) {
    console.log(`\n::set-output name=new_webids::${newCount}`);
    console.log(`::set-output name=total_webids::${existingWebIDs.size}`);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
