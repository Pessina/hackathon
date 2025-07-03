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

interface SP1Groth16Proof {
  proof: Buffer;
  sp1PublicInputs: Buffer;
}

// Match the optimized PublicOutputs structure from the ZK program
interface PublicOutputs {
  email_hash: number[];    // PoseidonHash as array of 8 BabyBear field elements (only private field)
  sub: string;             // Subject (public field, exposed directly)
  iss: string;             // Issuer (public field, exposed directly)  
  aud: string;             // Audience (public field, exposed directly)
  verified: boolean;
}

// Helper function to convert Poseidon hash to bytes (matching Solana program)
function poseidonToBytes(hash: number[]): Uint8Array {
  const bytes = new Uint8Array(32);
  for (let i = 0; i < Math.min(hash.length, 8); i++) {
    // Convert each field element to little-endian bytes
    const elemBytes = new ArrayBuffer(4);
    const view = new DataView(elemBytes);
    view.setUint32(0, hash[i], true); // little-endian
    
    const start = i * 4;
    const end = Math.min(start + 4, 32);
    const copyLen = end - start;
    bytes.set(new Uint8Array(elemBytes, 0, copyLen), start);
  }
  return bytes;
}

// Parse public outputs from SP1 public inputs
function parsePublicOutputs(publicInputs: Buffer): PublicOutputs {
  // SP1 public inputs are serialized using bincode
  // The structure is: email_hash (32 bytes), sub (string), iss (string), aud (string), verified (1 byte)
  
  try {
    const view = new DataView(publicInputs.buffer, publicInputs.byteOffset, publicInputs.byteLength);
    let offset = 0;
    
    // Read email_hash (32 bytes = 8 field elements * 4 bytes each)
    const email_hash = [];
    for (let i = 0; i < 8; i++) {
      email_hash.push(view.getUint32(offset, true));
      offset += 4;
    }
    
    // For strings, we need to read the length first (4 bytes) then the content
    // Read sub string
    const subLength = view.getUint32(offset, true);
    offset += 4;
    const subBytes = new Uint8Array(publicInputs.slice(offset, offset + subLength));
    const sub = new TextDecoder().decode(subBytes);
    offset += subLength;
    
    // Read iss string
    const issLength = view.getUint32(offset, true);
    offset += 4;
    const issBytes = new Uint8Array(publicInputs.slice(offset, offset + issLength));
    const iss = new TextDecoder().decode(issBytes);
    offset += issLength;
    
    // Read aud string
    const audLength = view.getUint32(offset, true);
    offset += 4;
    const audBytes = new Uint8Array(publicInputs.slice(offset, offset + audLength));
    const aud = new TextDecoder().decode(audBytes);
    offset += audLength;
    
    // Read verified (1 byte)
    const verified = view.getUint8(offset) !== 0;
    
    return {
      email_hash,
      sub,
      iss,
      aud,
      verified
    };
  } catch (error) {
    console.error("Error parsing public outputs:", error);
    // Return default values if parsing fails
    return {
      email_hash: Array(8).fill(0),
      sub: "",
      iss: "",
      aud: "",
      verified: false
    };
  }
}

interface TransferParams {
  salt: string;
  groth16Proof: SP1Groth16Proof;
  amount: number; // in SOL
  destinationAddress: string;
}

interface CreateAccountParams {
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


  const getUserAccountAddress = useCallback(
    (emailHash: Uint8Array, salt: string): [PublicKey, number] => {
      return PublicKey.findProgramAddressSync(
        [
          Buffer.from("user_account"),
          Buffer.from(emailHash),
          Buffer.from(salt),
        ],
        programId
      );
    },
    [programId]
  );

  const createUserAccount = useCallback(
    async ({ salt, groth16Proof, payer }: CreateAccountParams) => {
      if (!program || !publicKey || !sendTransaction) {
        throw new Error("Program not initialized or wallet not connected");
      }

      // Parse the email hash from the proof public outputs
      const publicOutputs = parsePublicOutputs(groth16Proof.sp1PublicInputs);
      const emailHash = poseidonToBytes(publicOutputs.email_hash);
      
      const payerKey = payer || publicKey;
      const [userAccountAddress] = getUserAccountAddress(emailHash, salt);

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
        userAccount: getUserAccountAddress(emailHash, salt)[0],
      };
    },
    [
      program,
      publicKey,
      sendTransaction,
      connection,
      getUserAccountAddress,
    ]
  );

  const transferFromUserAccount = useCallback(
    async ({
      salt,
      groth16Proof,
      amount,
      destinationAddress,
    }: TransferParams) => {
      if (!program || !publicKey || !sendTransaction) {
        throw new Error("Program not initialized or wallet not connected");
      }

      // Parse the email hash from the proof public outputs
      const publicOutputs = parsePublicOutputs(groth16Proof.sp1PublicInputs);
      const emailHash = poseidonToBytes(publicOutputs.email_hash);
      
      const destination = new PublicKey(destinationAddress);
      const amountInLamports = new BN(amount * LAMPORTS_PER_SOL);
      const [userAccountAddress] = getUserAccountAddress(emailHash, salt);

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
        userAccount: getUserAccountAddress(emailHash, salt)[0],
      };
    },
    [
      program,
      publicKey,
      sendTransaction,
      connection,
      getUserAccountAddress,
    ]
  );

  const getUserAccountBalance = useCallback(
    async (emailHash: Uint8Array, salt: string): Promise<number> => {
      const [userAccountAddress] = getUserAccountAddress(emailHash, salt);
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

  const getUserAccountBalanceFromProof = useCallback(
    async (groth16Proof: SP1Groth16Proof, salt: string): Promise<number> => {
      const publicOutputs = parsePublicOutputs(groth16Proof.sp1PublicInputs);
      const emailHash = poseidonToBytes(publicOutputs.email_hash);
      return getUserAccountBalance(emailHash, salt);
    },
    [getUserAccountBalance]
  );

  const checkUserAccountExists = useCallback(
    async (emailHash: Uint8Array, salt: string): Promise<boolean> => {
      if (!program) return false;

      try {
        const [userAccountAddress] = getUserAccountAddress(emailHash, salt);
        const accountInfo = await connection.getAccountInfo(userAccountAddress);
        return !!accountInfo;
      } catch {
        return false;
      }
    },
    [program, connection, getUserAccountAddress]
  );

  const checkUserAccountExistsFromProof = useCallback(
    async (groth16Proof: SP1Groth16Proof, salt: string): Promise<boolean> => {
      const publicOutputs = parsePublicOutputs(groth16Proof.sp1PublicInputs);
      const emailHash = poseidonToBytes(publicOutputs.email_hash);
      return checkUserAccountExists(emailHash, salt);
    },
    [checkUserAccountExists]
  );

  const getUserAccountData = useCallback(
    async (emailHash: Uint8Array, salt: string) => {
      if (!program) return null;

      try {
        const [userAccountAddress] = getUserAccountAddress(emailHash, salt);
        return await (program.account as any).userAccount.fetch(
          userAccountAddress
        );
      } catch {
        return null;
      }
    },
    [program, getUserAccountAddress]
  );

  const getUserAccountDataFromProof = useCallback(
    async (groth16Proof: SP1Groth16Proof, salt: string) => {
      const publicOutputs = parsePublicOutputs(groth16Proof.sp1PublicInputs);
      const emailHash = poseidonToBytes(publicOutputs.email_hash);
      return getUserAccountData(emailHash, salt);
    },
    [getUserAccountData]
  );

  const getUserAccountAddressFromProof = useCallback(
    (groth16Proof: SP1Groth16Proof, salt: string): [PublicKey, number] => {
      const publicOutputs = parsePublicOutputs(groth16Proof.sp1PublicInputs);
      const emailHash = poseidonToBytes(publicOutputs.email_hash);
      return getUserAccountAddress(emailHash, salt);
    },
    [getUserAccountAddress]
  );

  return {
    program,
    programId,
    isReady: !!program && !!publicKey,
    getUserAccountAddress,
    getUserAccountAddressFromProof,
    createUserAccount,
    transferFromUserAccount,
    getUserAccountBalance,
    getUserAccountBalanceFromProof,
    checkUserAccountExists,
    checkUserAccountExistsFromProof,
    getUserAccountData,
    getUserAccountDataFromProof,
  };
};
