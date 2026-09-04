#!/usr/bin/env node

import { createClient } from "@supabase/supabase-js";

class BootstrapError extends Error {}

const authOptions = {
  autoRefreshToken: false,
  detectSessionInUrl: false,
  persistSession: false,
};

function requiredEnvironmentValue(names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }

  throw new BootstrapError(`Set ${names.join(" or ")} before running this command.`);
}

function validateSupabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new BootstrapError("SUPABASE_URL is not a valid URL.");
  }

  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !localHttp) || url.username || url.password) {
    throw new BootstrapError("SUPABASE_URL must use HTTPS, except for local development.");
  }

  return url.toString().replace(/\/$/, "");
}

function validateRedirectUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new BootstrapError("APP_AUTH_REDIRECT_URL is not a valid URL.");
  }

  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  const customScheme = /^[a-z][a-z0-9+.-]*:$/.test(url.protocol) &&
    !["blob:", "data:", "file:", "http:", "https:", "javascript:"].includes(url.protocol);
  if ((url.protocol !== "https:" && !localHttp && !customScheme) || url.username || url.password) {
    throw new BootstrapError("APP_AUTH_REDIRECT_URL must use HTTPS or a valid application scheme.");
  }

  return url.toString();
}

function normalizeEmail(value) {
  const email = value.normalize("NFKC").trim().toLowerCase();
  if (
    email.length === 0 ||
    email.length > 254 ||
    !/^[\x21-\x7e]+$/.test(email) ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
  ) {
    throw new BootstrapError("ADMIN_EMAIL is not a valid email address.");
  }
  return email;
}

function normalizeName(value) {
  const name = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (name.length === 0 || [...name].length > 120 || /[\p{Cc}\p{Cf}]/u.test(name)) {
    throw new BootstrapError("ADMIN_NAME is not valid.");
  }
  return name;
}

function storedEmail(value) {
  return typeof value === "string" ? value.normalize("NFKC").trim().toLowerCase() : "";
}

function isConfirmed(user) {
  return Boolean(user.email_confirmed_at || user.confirmed_at);
}

function appMetadata(user) {
  return typeof user.app_metadata === "object" && user.app_metadata !== null && !Array.isArray(user.app_metadata)
    ? user.app_metadata
    : {};
}

async function findAuthUserByEmail(supabase, email) {
  const perPage = 1_000;
  const maxPages = 100;
  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new BootstrapError("Existing auth accounts could not be checked.");

    const match = data.users.find((user) => storedEmail(user.email) === email);
    if (match) return match;
    if (data.users.length < perPage) return null;
  }

  throw new BootstrapError("The auth account lookup was too large to complete safely.");
}

async function activeAdminProfiles(supabase) {
  const { data, error } = await supabase.rpc("active_admin_profiles");
  if (error) throw new BootstrapError("Active administrator profiles could not be checked.");
  return Array.isArray(data) ? data : [];
}

async function bootstrapAdminProfile(supabase, authUserId, displayName) {
  const { data, error } = await supabase.rpc("bootstrap_admin_profile", {
    p_auth_user_id: authUserId,
    p_display_name: displayName,
  });
  if (error) throw new BootstrapError("The administrator profile could not be initialized.");
  return data;
}

async function removeNewAuthUser(supabase, userId) {
  try {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) console.error("A newly created auth account could not be rolled back; manual review is required.");
  } catch {
    console.error("A newly created auth account could not be rolled back; manual review is required.");
  }
}

async function restoreAppMetadata(supabase, userId, previousMetadata) {
  try {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      app_metadata: previousMetadata,
    });
    if (error) console.error("Existing auth metadata could not be restored; manual review is required.");
  } catch {
    console.error("Existing auth metadata could not be restored; manual review is required.");
  }
}

async function main() {
  const supabaseUrl = validateSupabaseUrl(requiredEnvironmentValue(["SUPABASE_URL"]));
  const serviceKey = requiredEnvironmentValue(["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);
  const email = normalizeEmail(requiredEnvironmentValue(["ADMIN_EMAIL"]));
  const displayName = normalizeName(requiredEnvironmentValue(["ADMIN_NAME"]));
  const redirectTo = validateRedirectUrl(requiredEnvironmentValue(["APP_AUTH_REDIRECT_URL"]));
  const supabase = createClient(supabaseUrl, serviceKey, { auth: authOptions });

  const activeAdmins = await activeAdminProfiles(supabase);
  const existingUser = await findAuthUserByEmail(supabase, email);

  if (activeAdmins.length > 0) {
    const matchingAdmin = existingUser
      ? activeAdmins.find((profile) => profile.id === existingUser.id)
      : null;

    if (matchingAdmin && existingUser && isConfirmed(existingUser) && matchingAdmin.must_set_password === false) {
      console.log("The target administrator is already active; no changes were made.");
      return;
    }

    if (!matchingAdmin) {
      throw new BootstrapError("A different active administrator already exists; no changes were made.");
    }
  }

  if (existingUser && isConfirmed(existingUser)) {
    throw new BootstrapError(
      "ADMIN_EMAIL belongs to a confirmed account that is not the active target administrator.",
    );
  }

  const previousMetadata = existingUser ? { ...appMetadata(existingUser) } : null;
  const previousRole = existingUser ? appMetadata(existingUser).role : undefined;
  if (previousRole !== undefined && previousRole !== "admin") {
    throw new BootstrapError("ADMIN_EMAIL belongs to another account role.");
  }

  let invitedUser = null;
  try {
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });
    if (!error) invitedUser = data.user;
  } catch {
    invitedUser = null;
  }
  if (!invitedUser) throw new BootstrapError("The administrator invitation could not be sent.");

  const newlyCreated = existingUser === null;
  if (
    storedEmail(invitedUser.email) !== email ||
    (existingUser !== null && invitedUser.id !== existingUser.id) ||
    isConfirmed(invitedUser)
  ) {
    if (newlyCreated) await removeNewAuthUser(supabase, invitedUser.id);
    throw new BootstrapError("The invited auth account did not match the requested administrator.");
  }

  const currentMetadata = {
    ...(previousMetadata ?? {}),
    ...appMetadata(invitedUser),
  };
  if (currentMetadata.role !== undefined && currentMetadata.role !== "admin") {
    if (newlyCreated) await removeNewAuthUser(supabase, invitedUser.id);
    throw new BootstrapError("ADMIN_EMAIL belongs to another account role.");
  }

  let metadataUpdated = false;
  try {
    const { error } = await supabase.auth.admin.updateUserById(invitedUser.id, {
      app_metadata: { ...currentMetadata, role: "admin" },
    });
    metadataUpdated = !error;
  } catch {
    metadataUpdated = false;
  }
  if (!metadataUpdated) {
    if (newlyCreated) await removeNewAuthUser(supabase, invitedUser.id);
    throw new BootstrapError("The administrator auth metadata could not be set.");
  }

  const outcome = await bootstrapAdminProfile(supabase, invitedUser.id, displayName);
  if (outcome === "conflict_role" || outcome === "conflict_other_admin") {
    if (newlyCreated) {
      await removeNewAuthUser(supabase, invitedUser.id);
    } else if (previousMetadata) {
      await restoreAppMetadata(supabase, invitedUser.id, previousMetadata);
    }
    throw new BootstrapError("The administrator profile could not be initialized: the bootstrap policy refused it.");
  }

  console.log(
    outcome === "already_active"
      ? "The target administrator is already active; no changes were made."
      : "Admin invitation sent and profile initialized.",
  );
}

main().catch((error) => {
  const message = error instanceof BootstrapError
    ? error.message
    : "Admin bootstrap failed without making a reportable provider error.";
  console.error(message);
  process.exitCode = 1;
});
