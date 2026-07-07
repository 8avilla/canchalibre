export default function OrgLoading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="h-7 w-40 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-4 w-64 animate-pulse rounded bg-gray-100" />

      <div className="mt-6 grid gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    </main>
  );
}
