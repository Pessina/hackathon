import { useCallback, useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import {
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { useEnv } from "./useEnv";
import idl from "../lib/zk_solana_aa.json";
import { createHash } from "crypto";

interface SP1Groth16Proof {
  proof: Buffer;
  sp1PublicInputs: Buffer;
}

interface TransferParams {
  email: string;
  salt: string;
  groth16Proof: SP1Groth16Proof;
  amount: number; // in SOL
  destinationAddress: string;
}

interface CreateAccountParams {
  email: string;
  salt: string;
  groth16Proof: SP1Groth16Proof;
  payer?: PublicKey;
}

export const useSolanaProgram = () => {
  const { connection } = useConnection();
  const { publicKey, sendTransaction, signTransaction, signAllTransactions } =
    useWallet();
  const { NEXT_PUBLIC_SOLANA_PROGRAM_ID } = useEnv();

  const programId = useMemo(
    () => new PublicKey(NEXT_PUBLIC_SOLANA_PROGRAM_ID),
    [NEXT_PUBLIC_SOLANA_PROGRAM_ID]
  );

  const provider = useMemo(() => {
    if (!publicKey || !signTransaction || !signAllTransactions) return null;

    return new AnchorProvider(
      connection,
      {
        publicKey,
        signTransaction: signTransaction as <
          T extends Transaction | VersionedTransaction
        >(
          tx: T
        ) => Promise<T>,
        signAllTransactions: signAllTransactions as <
          T extends Transaction | VersionedTransaction
        >(
          txs: T[]
        ) => Promise<T[]>,
      },
      { commitment: "confirmed" }
    );
  }, [connection, publicKey, signTransaction, signAllTransactions]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(idl as Idl, provider);
  }, [provider]);

  const hashEmail = useCallback((email: string): Uint8Array => {
    const hash = createHash("sha256");
    hash.update(email);
    return new Uint8Array(hash.digest());
  }, []);

  const getUserAccountAddress = useCallback(
    (email: string, salt: string): [PublicKey, number] => {
      const emailHash = hashEmail(email);
      return PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_account"),
          Buffer.from(emailHash),
          Buffer.from(salt),
        ],
        programId
      );
    },
    [programId, hashEmail]
  );

  const createUserAccount = useCallback(
    async ({ email, salt, groth16Proof, payer }: CreateAccountParams) => {
      if (!program || !publicKey || !sendTransaction) {
        throw new Error("Program not initialized or wallet not connected");
      }

      const emailHash = hashEmail(email);
      const payerKey = payer || publicKey;
      const [userAccountAddress] = getUserAccountAddress(email, salt);

      const tx = await program.methods
        .createUserAccountWithAuth(Array.from(emailHash), salt, groth16Proof)
        .accounts({
          payer: payerKey,
          userAccount: userAccountAddress,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
        ])
        .transaction();

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");

      return {
        signature,
        userAccount: getUserAccountAddress(email, salt)[0],
      };
    },
    [
      program,
      publicKey,
      sendTransaction,
      connection,
      getUserAccountAddress,
      hashEmail,
    ]
  );

  const transferFromUserAccount = useCallback(
    async ({
      email,
      salt,
      groth16Proof,
      amount,
      destinationAddress,
    }: TransferParams) => {
      if (!program || !publicKey || !sendTransaction) {
        throw new Error("Program not initialized or wallet not connected");
      }

      const emailHash = hashEmail(email);
      const destination = new PublicKey(destinationAddress);
      const amountInLamports = new BN(amount * LAMPORTS_PER_SOL);
      const [userAccountAddress] = getUserAccountAddress(email, salt);

      const tx = await program.methods
        .transferFromUserAccountWithAuth(
          Array.from(emailHash),
          salt,
          groth16Proof,
          amountInLamports
        )
        .accounts({
          authority: publicKey,
          userAccount: userAccountAddress,
          destination,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
        ])
        .transaction();

      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");

      return {
        signature,
        userAccount: getUserAccountAddress(email, salt)[0],
      };
    },
    [
      program,
      publicKey,
      sendTransaction,
      connection,
      getUserAccountAddress,
      hashEmail,
    ]
  );

  const getUserAccountBalance = useCallback(
    async (email: string, salt: string): Promise<number> => {
      const [userAccountAddress] = getUserAccountAddress(email, salt);
      const balance = await connection.getBalance(userAccountAddress);

      // Calculate rent-exempt minimum (updated for new account size with salt)
      const rentExemptMinimum =
        await connection.getMinimumBalanceForRentExemption(
          8 + 32 + 4 + 32 + 1 // UserAccount::SPACE (discriminator + email_hash + salt + bump)
        );

      const availableBalance = Math.max(0, balance - rentExemptMinimum);
      return availableBalance / LAMPORTS_PER_SOL;
    },
    [connection, getUserAccountAddress]
  );

  const checkUserAccountExists = useCallback(
    async (email: string, salt: string): Promise<boolean> => {
      if (!program) return false;

      try {
        const [userAccountAddress] = getUserAccountAddress(email, salt);
        const accountInfo = await connection.getAccountInfo(userAccountAddress);
        return !!accountInfo;
      } catch {
        return false;
      }
    },
    [program, connection, getUserAccountAddress]
  );

  const getUserAccountData = useCallback(
    async (email: string, salt: string) => {
      if (!program) return null;

      try {
        const [userAccountAddress] = getUserAccountAddress(email, salt);
        return await (program.account as any).userAccount.fetch(
          userAccountAddress
        );
      } catch {
        return null;
      }
    },
    [program, getUserAccountAddress]
  );

  return {
    program,
    programId,
    isReady: !!program && !!publicKey,
    getUserAccountAddress,
    createUserAccount,
    transferFromUserAccount,
    getUserAccountBalance,
    checkUserAccountExists,
    getUserAccountData,
  };
};
