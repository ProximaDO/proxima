export default function AdminMarketsLoading() {
  return (
    <main className="admin-fade-in space-y-6">
      <section className="admin-card p-6">
        <div className="admin-skeleton h-5 w-40" />
        <div className="admin-skeleton mt-3 h-3 w-44" />
      </section>

      <section className="space-y-3">
        {[1, 2, 3, 4].map((item) => (
          <article key={item} className="admin-card p-4">
            <div className="admin-skeleton h-4 w-3/4" />
            <div className="admin-skeleton mt-2 h-3 w-1/2" />
          </article>
        ))}
      </section>
    </main>
  );
}
