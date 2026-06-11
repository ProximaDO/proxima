export default function AdminWithdrawalsLoading() {
  return (
    <main className="admin-fade-in space-y-6">
      <section className="admin-card p-6">
        <div className="admin-skeleton h-5 w-52" />
        <div className="admin-skeleton mt-3 h-3 w-64" />
      </section>

      <section className="admin-card p-4">
        <div className="admin-skeleton h-10 w-full" />
        <div className="admin-skeleton mt-3 h-10 w-full" />
        <div className="admin-skeleton mt-3 h-10 w-full" />
      </section>

      <section className="admin-card p-4">
        <div className="admin-skeleton h-8 w-2/3" />
        <div className="admin-skeleton mt-4 h-10 w-full" />
        <div className="admin-skeleton mt-3 h-10 w-full" />
      </section>
    </main>
  );
}
