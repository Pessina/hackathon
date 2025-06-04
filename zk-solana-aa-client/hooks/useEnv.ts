import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string(),
  NEXT_PUBLIC_SOLANA_RPC: z.string().url(),
});

type Env = z.infer<typeof envSchema>;

export const useEnv = (): Env => {
  const env = {
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_SOLANA_RPC: process.env.NEXT_PUBLIC_SOLANA_RPC,
  };

  try {
    return envSchema.parse(env);
  } catch (error) {
    throw new Error(`Invalid environment variables: ${error}`);
  }
};
