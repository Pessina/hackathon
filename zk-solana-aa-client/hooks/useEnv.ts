import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z
    .string()
    .min(1, "Google Client ID is required"),
  NEXT_PUBLIC_SOLANA_RPC: z.string().url("Solana RPC must be a valid URL"),
  NEXT_PUBLIC_SOLANA_MNEMONIC: z.string().min(1, "Solana mnemonic is required"),
  NEXT_PUBLIC_SOLANA_PROGRAM_ID: z
    .string()
    .min(1, "Solana Program ID is required"),
  NEXT_PUBLIC_JWT_ZK_PROOF_SERVER_URL: z
    .string()
    .url("JWT ZK Proof Server URL must be a valid URL"),
});

type Env = z.infer<typeof envSchema>;

export const useEnv = (): Required<Env> => {
  const env = {
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    NEXT_PUBLIC_SOLANA_RPC: process.env.NEXT_PUBLIC_SOLANA_RPC,
    NEXT_PUBLIC_SOLANA_MNEMONIC: process.env.NEXT_PUBLIC_SOLANA_MNEMONIC,
    NEXT_PUBLIC_JWT_ZK_PROOF_SERVER_URL:
      process.env.NEXT_PUBLIC_JWT_ZK_PROOF_SERVER_URL,
    NEXT_PUBLIC_SOLANA_PROGRAM_ID: process.env.NEXT_PUBLIC_SOLANA_PROGRAM_ID,
  };

  try {
    return envSchema.parse(env);
  } catch (error) {
    console.error("Environment validation failed:", error);
    throw new Error(
      `Invalid environment variables. Please check your .env.local file. Details: ${error}`
    );
  }
};
