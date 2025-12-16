'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

interface WebIDResult {
  webid: string;
  name: string;
  img: string | null;
}

interface SearchResults {
  query: string;
  count: number;
  results: WebIDResult[];
}

interface SearchComponentProps {
  initialQuery?: string;
}

export default function SearchComponent({ initialQuery = '' }: SearchComponentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Search failed');
      }

      setResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Perform search on initial load if there's a query parameter
  useEffect(() => {
    const q = searchParams.get('q');
    if (q) {
      setQuery(q);
      performSearch(q);
    }
  }, [searchParams, performSearch]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      setError('Please enter a search query');
      // Clear the URL parameter if query is empty
      router.push('/');
      return;
    }

    // Update URL with query parameter
    router.push(`/?q=${encodeURIComponent(query)}`);
    
    await performSearch(query);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-gray-900 dark:text-white">
          WebID Search
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Search for WebIDs by name or content
        </p>
      </div>

      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={handleInputChange}
            placeholder="Enter search query..."
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:text-white"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {results && (
        <div className="space-y-6">
          <div className="text-gray-600 dark:text-gray-400">
            Found {results.count} result{results.count !== 1 ? 's' : ''} for &quot;{results.query}&quot;
          </div>

          {results.results.length === 0 ? (
            <div className="p-8 text-center bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="text-gray-600 dark:text-gray-400">
                No WebIDs found matching your search query.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.results.map((result) => (
                <div
                  key={result.webid}
                  className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {result.img && (
                      <div className="flex-shrink-0">
                        <Image
                          src={result.img}
                          alt={`Profile picture of ${result.name}`}
                          width={64}
                          height={64}
                          className="rounded-full object-cover"
                          unoptimized
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">
                        {result.name}
                      </h3>
                      <a
                        href={result.webid}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                      >
                        {result.webid}
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
