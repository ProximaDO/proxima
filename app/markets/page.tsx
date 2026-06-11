import { redirect } from "next/navigation";

export default function MarketsPage() {
  redirect("/?category=all#activos");
}
