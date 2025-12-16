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

// Helper to normalize name field (can be string or array)
function getName(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value[0] : value;
}

function getNameForSearch(value: string | string[] | undefined): string {
  if (!value) return '';
  return Array.isArray(value) ? value.join(' ') : value;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const searchTerm = query.toLowerCase();

  // Search by name (foaf:name or schema:name) or WebID
  const results = profiles
    .filter(profile => {
      const name = getNameForSearch(profile['foaf:name']) || getNameForSearch(profile['schema:name']);
      const webid = profile['@id'] || '';
      const nameMatch = name.toLowerCase().includes(searchTerm);
      const webidMatch = webid.toLowerCase().includes(searchTerm);
      return nameMatch || webidMatch;
    })
    .map(profile => ({
      webid: profile['@id'],
      name: getName(profile['foaf:name']) || getName(profile['schema:name']) || 'Unknown',
      img: profile['foaf:img'] || null
    }));

  return NextResponse.json({
    query,
    count: results.length,
    results
  });
}
