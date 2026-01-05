import { NextRequest, NextResponse } from 'next/server';

// CORS headers to allow all origins
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

// Helper function to add CORS headers to a response
function addCorsHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

function getPreferredContentType(acceptHeader: string | null): 'turtle' | 'jsonld' | 'json' | 'html' {
  if (!acceptHeader) return 'html';
  
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
    // Check for regular JSON (for API clients)
    if (mediaType === 'application/json') {
      return 'json';
    }
    // Check for HTML
    if (mediaType === 'text/html' || 
        mediaType === 'application/xhtml+xml') {
      return 'html';
    }
    // Wildcard - default to HTML for browsers
    if (mediaType === '*/*') {
      return 'html';
    }
  }
  
  return 'html';
}

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  
  // Handle preflight OPTIONS requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }
  
  // Only handle content negotiation for the root path
  if (pathname !== '/') {
    return addCorsHeaders(NextResponse.next());
  }
  
  const acceptHeader = request.headers.get('Accept');
  const preferredType = getPreferredContentType(acceptHeader);
  
  // If requesting a machine-readable format, rewrite to API
  if (preferredType !== 'html') {
    const query = searchParams.get('q');
    const format = preferredType;
    
    const url = request.nextUrl.clone();
    url.pathname = '/api/search';
    if (query) {
      url.searchParams.set('q', query);
    }
    url.searchParams.set('format', format);
    
    return addCorsHeaders(NextResponse.rewrite(url));
  }
  
  // For HTML requests, let the page render normally
  return addCorsHeaders(NextResponse.next());
}

export const config = {
  // Match all routes for CORS headers
  matcher: '/(.*)',
};
