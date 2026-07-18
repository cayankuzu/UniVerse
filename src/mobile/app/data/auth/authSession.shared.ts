import { getRecoveredAuthUser } from "../../platform/supabase/authSession";

export async function getCurrentAuthUserOrThrow() {
  const user = await getRecoveredAuthUser();
  if (user?.id) return user;

  throw new Error("Unauthorized");
}
