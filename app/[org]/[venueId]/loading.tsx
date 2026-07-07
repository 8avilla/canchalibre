export default function VenueLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-7 w-48 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-4 w-32 animate-pulse rounded bg-gray-100" />

      <div className="mt-6 flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-16 w-14 flex-shrink-0 animate-pulse rounded-xl bg-gray-100" />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-gray-100" />
        ))}
      </div>
    </main>
  );
}
