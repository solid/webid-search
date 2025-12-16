import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Mock WebID data - in a real application, this would be fetched from a database or external source
const webIDs = [
  {
    webid: 'https://example.com/alice',
    name: 'Alice Johnson',
    content: 'Software engineer passionate about web technologies and semantic web'
  },
  {
    webid: 'https://example.com/bob',
    name: 'Bob Smith',
    content: 'Data scientist working on machine learning and AI projects'
  },
  {
    webid: 'https://example.com/charlie',
    name: 'Charlie Brown',
    content: 'Web developer specializing in React and TypeScript'
  },
  {
    webid: 'https://example.com/diana',
    name: 'Diana Prince',
    content: 'Full stack developer with expertise in Next.js and semantic web'
  },
  {
    webid: 'https://example.com/eve',
    name: 'Eve Martinez',
    content: 'Frontend developer focused on user experience and accessibility'
  }
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  const searchTerm = query.toLowerCase();

  // Search by name (foaf:name) or content
  const results = webIDs.filter(webid => {
    const nameMatch = webid.name.toLowerCase().includes(searchTerm);
    const contentMatch = webid.content.toLowerCase().includes(searchTerm);
    return nameMatch || contentMatch;
  });

  return NextResponse.json({
    query,
    count: results.length,
    results
  });
}
