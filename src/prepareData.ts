import { parseRdf } from '@ldo/ldo';
import { write } from '@jeswr/pretty-turtle';
import jsonld from 'jsonld';
import { SolidProfileShapeType } from './ldo/solidProfile.shapeTypes.js';
import fs from 'fs/promises';
import path from 'path';

interface ProfileData {
  '@id': string;
  '@type'?: string[];
  'foaf:name'?: string[];
  'schema:name'?: string[];
  'foaf:knows'?: { '@id': string }[];
  'solid:oidcIssuer'?: { '@id': string }[];
  'pim:storage'?: { '@id': string }[];
  'foaf:img'?: { '@id': string }[];
}

interface JsonLdOutput {
  '@context': Record<string, string | Record<string, string>>;
  '@graph': ProfileData[];
}

async function prepareData(): Promise<void> {
  const webidsDir = path.join(process.cwd(), 'webids');
  const outputPath = path.join(process.cwd(), 'public', 'profiles.json');
  
  // Read all TTL files from webids directory
  const files = await fs.readdir(webidsDir);
  const ttlFiles = files.filter(file => file.endsWith('.ttl'));
  
  console.log(`Found ${ttlFiles.length} WebID profiles to process...`);
  
  const profiles: ProfileData[] = [];
  let successCount = 0;
  let errorCount = 0;
  
  for (const file of ttlFiles) {
    const webIdUrl = decodeURIComponent(file.slice(0, -4)); // Remove .ttl extension
    const filePath = path.join(webidsDir, file);
    
    try {
      const ttlContent = await fs.readFile(filePath, 'utf-8');
      const ldoDataset = await parseRdf(ttlContent, { baseIRI: webIdUrl });
      
      // Get the profile using the ShapeType to ensure conformance
      const profile = ldoDataset
        .usingType(SolidProfileShapeType)
        .fromSubject(webIdUrl);
      
      // Extract only conformant data according to the ShEx shape
      const profileData: ProfileData = {
        '@id': webIdUrl,
      };
      
      // Extract foaf:name
      if (profile.name && [...profile.name].length > 0) {
        profileData['foaf:name'] = [...profile.name];
      }
      
      // // Extract schema:name (name2 in the LDO typings)
      if (profile.name2 && [...profile.name2].length > 0) {
        profileData['schema:name'] = [...profile.name2];
      }
  
      // // Extract solid:oidcIssuer
      if (profile.oidcIssuer && [...profile.oidcIssuer].length > 0) {
        profileData['solid:oidcIssuer'] = [...profile.oidcIssuer].map(i => ({ '@id': i['@id'] }));
      }
      
      // // Extract pim:storage
      if (profile.storage && [...profile.storage].length > 0) {
        profileData['pim:storage'] = [...profile.storage].map(s => ({ '@id': s['@id'] }));
      }
      
      // // Extract foaf:img
      if (profile.img && [...profile.img].length > 0) {
        if ([...profile.img].every(i => typeof i['@id'] === 'string')) {
          profileData['foaf:img'] = [...profile.img].map(i => ({ '@id': i['@id'] }));
        }
      }
      
      // Only add profiles that have at least some data beyond the @id
      if (Object.keys(profileData).length > 1) {
        profiles.push(profileData);
        successCount++;
      }
      
    } catch (error) {
      errorCount++;
      console.error(`Error processing ${webIdUrl}:`, error instanceof Error ? error.message : error);
    }
  }
  
  // Create JSON-LD output with proper context
  const jsonldOutput: JsonLdOutput = {
    '@context': {
      'foaf': 'http://xmlns.com/foaf/0.1/',
      'solid': 'http://www.w3.org/ns/solid/terms#',
      'pim': 'http://www.w3.org/ns/pim/space#',
      'schema': 'https://schema.org/',
      'xsd': 'http://www.w3.org/2001/XMLSchema#',
      'foaf:name': {
        '@id': 'http://xmlns.com/foaf/0.1/name',
        '@type': 'xsd:string',
      },
      'schema:name': {
        '@id': 'https://schema.org/name',
        '@type': 'xsd:string',
      },
      'foaf:knows': {
        '@id': 'http://xmlns.com/foaf/0.1/knows',
        '@type': '@id',
      },
      'solid:oidcIssuer': {
        '@id': 'http://www.w3.org/ns/solid/terms#oidcIssuer',
        '@type': '@id',
      },
      'pim:storage': {
        '@id': 'http://www.w3.org/ns/pim/space#storage',
        '@type': '@id',
      },
      'foaf:img': {
        '@id': 'http://xmlns.com/foaf/0.1/img',
        '@type': '@id',
      },
    },
    '@graph': profiles,
  };
  
  // Ensure public directory exists
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const compact = await jsonld.compact(jsonldOutput as any, jsonldOutput['@context']);
  
  // Write output
  await fs.writeFile(outputPath, JSON.stringify(compact, null, 2), 'utf-8');
  
  await fs.writeFile(
    path.join(process.cwd(), 'public', 'profiles.ttl'),
    await write([...await jsonld.toRDF(jsonldOutput as any) as any] as any, {
      format: 'text/turtle',
      prefixes: {
        foaf: 'http://xmlns.com/foaf/0.1/',
        solid: 'http://www.w3.org/ns/solid/terms#',
        pim: 'http://www.w3.org/ns/pim/space#',
        schema: 'https://schema.org/',
        xsd: 'http://www.w3.org/2001/XMLSchema#',
      }
    }),
    'utf-8'
  );

  console.log(`\nData preparation complete!`);
  console.log(`  - Successfully processed: ${successCount} profiles`);
  console.log(`  - Errors: ${errorCount}`);
  console.log(`  - Output written to: ${outputPath}`);
}

prepareData().catch(console.error);
