const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Max-Age": "86400",
};

const responseHeaders = {
  ...corsHeaders,
  "Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
};

const MAX_BODY_BYTES = 16_384;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...responseHeaders, ...headers },
  });
}

export function successResponse(data: Record<string, unknown>, status = 200): Response {
  return jsonResponse({ ok: true, data }, status);
}

export function errorResponse(error: ApiError): Response {
  return jsonResponse(
    { ok: false, error: { code: error.code, message: error.message } },
    error.status,
    error.status === 405 ? { Allow: "POST, OPTIONS" } : undefined,
  );
}

export async function handlePost(
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return errorResponse(new ApiError(405, "METHOD_NOT_ALLOWED", "Only POST requests are accepted."));
  }

  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) {
      return errorResponse(error);
    }

    console.error("Unhandled Edge Function error");
    return errorResponse(new ApiError(500, "INTERNAL_ERROR", "The request could not be completed."));
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const bytes = Number(contentLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_BODY_BYTES) {
      throw new ApiError(413, "REQUEST_TOO_LARGE", "The request body is too large.");
    }
  }

  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
    throw new ApiError(413, "REQUEST_TOO_LARGE", "The request body is too large.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "The request body must be valid JSON.");
  }

  if (!isRecord(parsed)) {
    throw new ApiError(400, "INVALID_BODY", "The request body must be a JSON object.");
  }

  return parsed;
}

export function assertOnlyKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): void {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some((key) => !allowed.has(key))) {
    throw new ApiError(400, "INVALID_BODY", "The request body contains unsupported fields.");
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
