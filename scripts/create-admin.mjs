#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceKey = (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)?.trim();
const email = "test@gmail.com";
const password = "test";
const displayName = "Apex Admin";

if (!supabaseUrl || !serviceKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});

async function main() {
  // 1. Delete all existing auth users
  console.log("Deleting all existing auth users...");
  const { data: users, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw new Error(`Could not list users: ${listError.message}`);

  for (const user of users.users) {
    const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
    if (delError) console.error(`Could not delete user ${user.email}: ${delError.message}`);
    else console.log(`  Deleted: ${user.email}`);
  }

  // 2. Create the admin user with email + password directly
  console.log(`\nCreating admin user: ${email}`);
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "admin" },
  });

  if (createError) throw new Error(`Could not create admin user: ${createError.message}`);
  console.log(`  Auth user created: ${created.user.id}`);

  // 3. Bootstrap the admin profile
  console.log("Initializing admin profile...");
  const { data: outcome, error: rpcError } = await supabase.rpc("bootstrap_admin_profile", {
    p_auth_user_id: created.user.id,
    p_display_name: displayName,
  });

  if (rpcError) throw new Error(`Could not bootstrap admin profile: ${rpcError.message}`);
  console.log(`  Profile outcome: ${outcome}`);

  // 4. Mark must_set_password = false since password is already set
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ must_set_password: false, account_state: "active" })
    .eq("id", created.user.id);

  if (updateError) console.error(`  Warning: could not update profile state: ${updateError.message}`);
  else console.log("  Profile activated, password set.");

  console.log("\nDone! Admin user ready:");
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
  console.log("  Role: admin");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
