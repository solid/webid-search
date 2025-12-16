import { NextRequest, NextResponse } from 'next/server';
import profilesData from '@/public/profiles.json';

interface ProfileNode {
  '@id': string;
  'foaf:name'?: string | string[];
  'schema:name'?: string | string[];
  'foaf:img'?: string;
  'solid:oidcIssuer'?: string | string[];
  'pim:storage'?: string | string[];
}

const profiles: ProfileNode[] = (profilesData as { '@graph': ProfileNode[] })['@graph'];
const context = (profilesData as { '@context': object })['@context'];

// Helper to normalize name field (can be string or array)
function getName(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value[0] : value;
}

function getNameForSearch(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value.join(' ') : value;
}

function searchProfiles(query: string): ProfileNode[] {
  const searchTerm = query.toLowerCase();
  
  return profiles.filter(profile => {
    const name = getNameForSearch(profile['foaf:name']) || getNameForSearch(profile['schema:name']);
    const webid = profile['@id'] || '';
    const nameMatch = name.toLowerCase().includes(searchTerm);
    const webidMatch = webid.toLowerCase().includes(searchTerm);
    return nameMatch || webidMatch;
  });
}

function toTurtle(results: ProfileNode[]): string {
  const prefixes = `@prefix foaf: <http://xmlns.com/foaf/0.1/> .
@prefix solid: <http://www.w3.org/ns/solid/terms#> .
@prefix pim: <http://www.w3.org/ns/pim/space#> .
@prefix schema: <https://schema.org/> .

`;

  const triples = results.map(profile => {
    const lines: string[] = [];
    const subject = `<${profile['@id']}>`;
    
    if (profile['foaf:name']) {
      const names = Array.isArray(profile['foaf:name']) ? profile['foaf:name'] : [profile['foaf:name']];
      names.forEach(name => {
        lines.push(`${subject} foaf:name "${escapeString(name)}" .`);
      });
    }
    
    if (profile['schema:name']) {
      const names = Array.isArray(profile['schema:name']) ? profile['schema:name'] : [profile['schema:name']];
      names.forEach(name => {
        lines.push(`${subject} schema:name "${escapeString(name)}" .`);
      });
    }
    
    if (profile['foaf:img']) {
      lines.push(`${subject} foaf:img <${profile['foaf:img']}> .`);
    }
    
    if (profile['solid:oidcIssuer']) {
      const issuers = Array.isArray(profile['solid:oidcIssuer']) ? profile['solid:oidcIssuer'] : [profile['solid:oidcIssuer']];
      issuers.forEach(issuer => {
        lines.push(`${subject} solid:oidcIssuer <${issuer}> .`);
      });
    }
    
    if (profile['pim:storage']) {
      const storages = Array.isArray(profile['pim:storage']) ? profile['pim:storage'] : [profile['pim:storage']];
      storages.forEach(storage => {
        lines.push(`${subject} pim:storage <${storage}> .`);
      });
    }
    
    return lines.join('\n');
  }).join('\n\n');

  return prefixes + triples;
}

function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

function toJsonLd(results: ProfileNode[]): object {
  return {
    '@context': context,
    '@graph': results
  };
}

function toJsonApi(query: string, results: ProfileNode[]): object {
  return {
    query,
    count: results.length,
    results: results.map(profile => ({
      webid: profile['@id'],
      name: getName(profile['foaf:name']) || getName(profile['schema:name']) || 'Unknown',
      img: profile['foaf:img'] || null
    }))
  };
}

function getPreferredContentType(acceptHeader: string | null): 'turtle' | 'jsonld' | 'json' {
  if (!acceptHeader) return 'json';
  
  // Parse Accept header and sort by quality
  const types = acceptHeader.split(',').map(type => {
    const [mediaType, ...params] = type.trim().split(';');
    const qParam = params.find(p => p.trim().startsWith('q='));
    const q = qParam ? parseFloat(qParam.split('=')[1]) : 1;
    return { mediaType: mediaType.trim().toLowerCase(), q };
  }).sort((a, b) => b.q - a.q);
  
  for (const { mediaType } of types) {
    // Check for Turtle
    if (mediaType === 'text/turtle' || 
        mediaType === 'application/x-turtle' ||
        mediaType === 'text/n3') {
      return 'turtle';
    }
    // Check for JSON-LD
    if (mediaType === 'application/ld+json') {
      return 'jsonld';
    }
    // Check for regular JSON
    if (mediaType === 'application/json') {
      return 'json';
    }
    // Wildcard - default to JSON for API
    if (mediaType === '*/*') {
      return 'json';
    }
  }
  
  return 'json';
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');
  const acceptHeader = request.headers.get('Accept');
  const format = getPreferredContentType(acceptHeader);

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const results = searchProfiles(query);

  switch (format) {
    case 'turtle':
      return new NextResponse(toTurtle(results), {
        headers: {
          'Content-Type': 'text/turtle; charset=utf-8',
        },
      });
    
    case 'jsonld':
      return new NextResponse(JSON.stringify(toJsonLd(results), null, 2), {
        headers: {
          'Content-Type': 'application/ld+json; charset=utf-8',
        },
      });
    
    case 'json':
    default:
      return NextResponse.json(toJsonApi(query, results));
  }
}
