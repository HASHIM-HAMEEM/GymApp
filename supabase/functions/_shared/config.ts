import { ApiError } from "./http.ts";

export interface RuntimeConfig {
  redirectUrl: string;
  serviceKey: string;
  supabaseUrl: string;
  publicKey: string;
}

function requiredEnvironmentValue(names: readonly string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name)?.trim();
    if (value) return value;
  }

  throw new ApiError(500, "SERVER_MISCONFIGURED", "The service is not configured correctly.");
}

function validateSupabaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(500, "SERVER_MISCONFIGURED", "The service is not configured correctly.");
  }

  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !localHttp) || url.username || url.password) {
    throw new ApiError(500, "SERVER_MISCONFIGURED", "The service is not configured correctly.");
  }

  return url.toString().replace(/\/$/, "");
}

function validateRedirectUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(500, "SERVER_MISCONFIGURED", "The service is not configured correctly.");
  }

  const localHttp = url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname);
  const customScheme = /^[a-z][a-z0-9+.-]*:$/.test(url.protocol) &&
    !["blob:", "data:", "file:", "http:", "https:", "javascript:"].includes(url.protocol);
  if ((url.protocol !== "https:" && !localHttp && !customScheme) || url.username || url.password) {
    throw new ApiError(500, "SERVER_MISCONFIGURED", "The service is not configured correctly.");
  }

  return url.toString();
}

export function loadRuntimeConfig(): RuntimeConfig {
  return {
    supabaseUrl: validateSupabaseUrl(requiredEnvironmentValue(["SUPABASE_URL"])),
    publicKey: requiredEnvironmentValue(["SUPABASE_PUBLISHABLE_KEY", "SUPABASE_ANON_KEY"]),
    serviceKey: requiredEnvironmentValue(["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]),
    redirectUrl: validateRedirectUrl(
      Deno.env.get("APP_AUTH_REDIRECT_URL")?.trim() ||
        "https://firdous-gym-app.vercel.app/confirm",
    ),
  };
}
