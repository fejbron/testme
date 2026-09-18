import { z } from "zod";

/** Server-only environment. Never import into a client component. */
const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SEED_ENC_KEY: z.string().min(1).optional(), // 32-byte base64; required for seed sealing
});

const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export const publicEnv = publicSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

let _server: z.infer<typeof serverSchema> | null = null;
export function serverEnv(): z.infer<typeof serverSchema> {
  if (_server) return _server;
  _server = serverSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL,
    DIRECT_URL: process.env.DIRECT_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SEED_ENC_KEY: process.env.SEED_ENC_KEY,
  });
  return _server;
}
