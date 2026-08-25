import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { PreferencesForm } from "@/components/PreferencesForm";

// Must be dynamic: this page reads the visitor's own session cookie and
// shows their personal subscription. Statically prerendering it would bake
// in whatever (or whoever's) state existed at build time - wrong for every
// visitor after the first.
export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // RLS scopes this to the signed-in user's own row automatically - no
  // explicit .eq("user_id", user.id) needed, though it wouldn't hurt.
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .maybeSingle();

  return (
    <div style={{ minHeight: "100vh", padding: "40px 20px" }}>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <PreferencesForm
          userEmail={user.email ?? ""}
          initialCategories={subscription?.categories ?? ["physical", "extremism", "cyber"]}
          initialMinSeverity={subscription?.min_severity ?? "high"}
          hasSubscription={Boolean(subscription)}
        />
      </div>
    </div>
  );
}
