import { createClient, type SupabaseClient } from "./deps.ts";
import { loadRuntimeConfig, type RuntimeConfig } from "./config.ts";
import { ApiError } from "./http.ts";

export interface AdminRequestContext {
  caller: SupabaseClient;
  config: RuntimeConfig;
  service: SupabaseClient;
  userId: string;
}

const authOptions = {
  autoRefreshToken: false,
  detectSessionInUrl: false,
  persistSession: false,
};

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match || match[1].length > 16_384) {
    throw new ApiError(401, "AUTH_REQUIRED", "A valid bearer token is required.");
  }

  return match[1];
}

export async function requireActiveAdmin(request: Request): Promise<AdminRequestContext> {
  const config = loadRuntimeConfig();
  const token = bearerToken(request);
  const caller = createClient(config.supabaseUrl, config.publicKey, {
    auth: authOptions,
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const service = createClient(config.supabaseUrl, config.serviceKey, { auth: authOptions });

  let userId: string | undefined;
  try {
    const { data, error } = await caller.auth.getUser(token);
    if (error && (typeof error.status !== "number" || error.status >= 500)) {
      throw new ApiError(503, "AUTH_UNAVAILABLE", "Authentication could not be verified right now.");
    }
    if (!error) userId = data.user?.id;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, "AUTH_UNAVAILABLE", "Authentication could not be verified right now.");
  }

  if (!userId) {
    throw new ApiError(401, "AUTH_INVALID", "The bearer token is invalid or expired.");
  }

  const { data: isAdmin, error: adminError } = await caller.rpc("current_user_is_admin");
  if (adminError) {
    throw new ApiError(500, "AUTHORIZATION_CHECK_FAILED", "Authorization could not be verified.");
  }
  if (isAdmin !== true) {
    throw new ApiError(403, "ADMIN_REQUIRED", "An active administrator account is required.");
  }

  return { caller, config, service, userId };
}
