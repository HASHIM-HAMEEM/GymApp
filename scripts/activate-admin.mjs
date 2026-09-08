import { createClient } from "@supabase/supabase-js";

const s = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});

const { data, error } = await s.rpc("activate_admin_profile", {
  p_auth_user_id: "40e2ae5c-8612-4296-b9db-312ee0de05ad",
});

if (error) console.error("Error:", error.message);
else console.log("Admin profile activated! must_set_password=false, account_state=active");
