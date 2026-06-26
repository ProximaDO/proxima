import { redirect } from "next/navigation";

export default async function AdminKycPage() {
  redirect("/admin/users");
}
