import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
}

export default async function MarketDetailRedirectPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error, success } = await searchParams;

  const query = new URLSearchParams({ category: "all", market: id });
  if (error) query.set("error", error);
  if (success) query.set("success", success);

  redirect(`/?${query.toString()}#activos`);
}
