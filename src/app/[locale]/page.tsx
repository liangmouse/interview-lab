import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { resolveAuthEntryTarget } from "@/lib/auth-routing";

export default async function Page() {
  const user = await getCurrentUser();
  redirect(resolveAuthEntryTarget(!!user));
}
