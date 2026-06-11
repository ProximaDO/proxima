export default function AdminLoading() {
  return (
    <main className="admin-fade-in space-y-6">
      <section className="admin-card p-6">
        <div className="admin-skeleton h-5 w-56" />
        <div className="admin-skeleton mt-3 h-3 w-72" />
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((item) => (
          <article key={item} className="admin-card p-5">
            <div className="admin-skeleton h-3 w-24" />
            <div className="admin-skeleton mt-3 h-8 w-20" />
          </article>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[1, 2].map((item) => (
          <article key={item} className="admin-card p-5">
            <div className="admin-skeleton h-4 w-32" />
            <div className="admin-skeleton mt-3 h-3 w-52" />
            <div className="admin-skeleton mt-5 h-8 w-8" />
          </article>
        ))}
      </section>
    </main>
  );
}
