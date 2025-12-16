import SearchComponent from "./components/SearchComponent";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const { q } = await searchParams;
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <SearchComponent initialQuery={q || ''} />
    </div>
  );
}
