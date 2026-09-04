declare namespace Deno {
  const env: {
    get(name: string): string | undefined;
  };

  function serve(handler: (request: Request) => Response | Promise<Response>): void;
}

declare module "npm:@supabase/supabase-js@2.112.4" {
  export const createClient: typeof import("@supabase/supabase-js").createClient;
  export type SupabaseClient = import("@supabase/supabase-js").SupabaseClient;
  export type User = import("@supabase/supabase-js").User;
}
