"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import GoogleButton from "@/components/GoogleButton";
import { toast } from "sonner";
import { Send, Shield } from "lucide-react";
import { useEnv } from "@/hooks/useEnv";
import { useSolanaProgram } from "@/hooks/useSolanaProgram";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Buffer } from "buffer";
import { parseOIDCToken } from "@/lib/utils";

interface TransferFormProps {
  className?: string;
}

interface TransferData {
  amount: number;
  destinationAddress: string;
}

interface ZKProofData {
  email: string;
  groth16Proof: {
    proof: Buffer;
    sp1PublicInputs: Buffer;
  };
}

const TransferForm = ({ className }: TransferFormProps) => {
  const { NEXT_PUBLIC_JWT_ZK_PROOF_SERVER_URL } = useEnv();
  const { connected } = useWallet();
  const {
    isReady,
    createUserAccount,
    transferFromUserAccount,
    getUserAccountBalance,
    checkUserAccountExists,
  } = useSolanaProgram();

  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [zkProofData, setZkProofData] = useState<ZKProofData | null>(null);
  const [userAccountExists, setUserAccountExists] = useState(false);
  const [userAccountBalance, setUserAccountBalance] = useState<number>(0);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
    watch,
  } = useForm<TransferData>({
    mode: "onChange",
    defaultValues: {
      amount: 0,
      destinationAddress: "",
    },
  });

  const watchedAmount = watch("amount");

  const handleGoogleSuccess = async (token: string) => {
    const { email, kid } = parseOIDCToken(token);

    try {
      // Fetch Google JWKS
      const jwksResponse = await fetch(
        "https://www.googleapis.com/oauth2/v3/certs"
      );
      const jwks = (await jwksResponse.json()) as {
        keys: Array<{
          kid: string;
          n: string;
          e: string;
          kty: string;
          alg: string;
          use: string;
        }>;
      };

      const key = jwks.keys.find((k) => k.kid === kid);
      if (!key) {
        throw new Error(`No key found for kid: ${kid}`);
      }

      // Proving is working, do not remove this code
      // // Get ZK proof from server
      // const response = await fetch(
      //   `${NEXT_PUBLIC_JWT_ZK_PROOF_SERVER_URL}/generate-proof`,
      //   {
      //     method: "POST",
      //     headers: {
      //       "Content-Type": "application/json",
      //     },
      //     body: JSON.stringify({
      //       jwt_token: token,
      //       public_key: {
      //         n: key.n,
      //         e: key.e,
      //       },
      //     }),
      //   }
      // );

      // if (!response.ok) {
      //   throw new Error(`Failed to get ZK proof: ${response.statusText}`);
      // }

      // const proofResult = await response.json();

      const proofResult = {
        proof:
          "a4594c590a66ef12edb001c8882f9bd7864a08a7632c47ab307653856802a6b91fc8278b0874f2f63b75d549aee19b97795e9014487d476113090d43c10d620d5d1c382706db7309889e6147003d59e2ac4ba757fb39c83d7939ca295d6afbefa521ac8501c6b4c236fe3f741cb4191673db2385b7262df37345110f011d90be806920fb2c4e9532c327c83b52ff4ef2a7214152b4f5334e3b664b222bcf21929b29f2a21542e7396b4166f16f835aadaf4841909def08cca74350604dbaf1d607eb8ddb071b79975c87e4891023b5efb43b1bc02e26f196855410f13ccb6eb30f88fdfa0daeb310570cb4b0835f23cdf82d1de7022d54441aa9b4379ebd6a2d882aa397",
        verification_key:
          "0x00390c74c859c201b98ba24a54e76c683b6a25625767e42529b156f19cfc4eae",
        public_outputs_bytes:
          "b9c53ddad62c54e2b8e437460ac30709d700d1eb6b0d1b58e2344a6c64cef0c4a4a787d8be7a56f1a18eb2726ac123c5a56ed3d4676e970915b717b1ff81204c000000000000000001",
        proof_size: 260,
      };

      console.log("proofResult", proofResult);

      // Convert hex strings to Uint8Array
      const proof = Buffer.from(proofResult.proof, "hex");
      const sp1PublicInputs = Buffer.from(
        proofResult.public_outputs_bytes,
        "hex"
      );
      setZkProofData({
        email,
        groth16Proof: {
          proof,
          sp1PublicInputs,
        },
      });

      setIsAuthenticated(true);
      toast.success("Successfully signed in with Google!");

      // Check account status
      if (isReady) {
        const exists = await checkUserAccountExists(email);
        setUserAccountExists(exists);

        if (exists) {
          const balance = await getUserAccountBalance(email);
          setUserAccountBalance(balance);
        }
      }
    } catch (error) {
      console.error("Failed to get ZK proof:", error);
      toast.error("Failed to generate ZK proof. Please try again.");
    }
  };

  const handleCreateAccount = async () => {
    if (!zkProofData || !connected || !isReady) {
      toast.error("Please connect your wallet and sign in with Google first");
      return;
    }

    setIsLoading(true);

    try {
      const result = await createUserAccount({
        email: zkProofData.email,
        groth16Proof: zkProofData.groth16Proof,
      });

      toast.success(
        `Account created successfully! Address: ${result.userAccount.toString()}`
      );
      setUserAccountExists(true);

      // Update balance
      const balance = await getUserAccountBalance(zkProofData.email);
      setUserAccountBalance(balance);
    } catch (error) {
      console.error("Account creation error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Account creation failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: TransferData) => {
    if (!zkProofData || !connected || !isReady) {
      toast.error("Please connect your wallet and sign in with Google first");
      return;
    }

    if (data.amount > userAccountBalance) {
      toast.error(
        `Insufficient balance. Available: ${userAccountBalance.toFixed(4)} SOL`
      );
      return;
    }

    setIsLoading(true);

    try {
      const result = await transferFromUserAccount({
        email: zkProofData.email,
        groth16Proof: zkProofData.groth16Proof,
        amount: data.amount,
        destinationAddress: data.destinationAddress,
      });

      toast.success(`Transfer successful! Transaction: ${result.signature}`);

      // Reset form and update balance
      reset();
      const newBalance = await getUserAccountBalance(zkProofData.email);
      setUserAccountBalance(newBalance);
    } catch (error) {
      console.error("Transfer error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Transfer failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = () => {
    setIsAuthenticated(false);
    setZkProofData(null);
    setUserAccountExists(false);
    setUserAccountBalance(0);
    reset();
    toast.info("Signed out successfully");
  };

  return (
    <Card className={`w-full max-w-md mx-auto ${className}`}>
      <CardHeader className="text-center">
        <div className="flex items-center justify-center mb-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <Shield className="h-8 w-8 text-primary" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold">ZK Solana Transfer</CardTitle>
        <CardDescription>
          Secure, privacy-preserving transfers on Solana
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step 1: Connect Wallet */}
        {!connected ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Solana wallet to get started
            </p>
            <WalletMultiButton className="w-full" />
          </div>
        ) : /* Step 2: Sign in with Google */ !isAuthenticated ? (
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Sign in with Google to generate your ZK proof
            </p>
            <GoogleButton
              onSuccess={handleGoogleSuccess}
              onError={() =>
                toast.error("Failed to sign in with Google. Please try again.")
              }
            />
          </div>
        ) : (
          /* Step 3: Account Management and Transfer */
          <div className="space-y-4">
            {/* Auth Status */}
            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center space-x-2">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <span className="text-sm font-medium text-green-800 dark:text-green-200">
                  Authenticated
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={signOut}>
                Sign Out
              </Button>
            </div>

            {/* Account Status */}
            {zkProofData && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-xs space-y-1">
                  <div className="font-medium text-blue-800 dark:text-blue-200">
                    Email: {zkProofData.email}
                  </div>
                  <div className="text-blue-700 dark:text-blue-300">
                    Status:{" "}
                    <span
                      className={
                        userAccountExists ? "text-green-600" : "text-red-600"
                      }
                    >
                      {userAccountExists
                        ? "Account Created"
                        : "Account Not Created"}
                    </span>
                  </div>
                  {userAccountExists && (
                    <div className="text-blue-700 dark:text-blue-300">
                      Balance: {userAccountBalance.toFixed(4)} SOL
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Create Account or Transfer Form */}
            {!userAccountExists ? (
              <Button
                onClick={handleCreateAccount}
                disabled={isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2">
                    <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Creating Account...</span>
                  </div>
                ) : (
                  "Create ZK Account"
                )}
              </Button>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Amount Field */}
                <div className="space-y-2">
                  <Label htmlFor="amount">
                    Amount (SOL)
                    <span className="text-xs text-muted-foreground ml-2">
                      Available: {userAccountBalance.toFixed(4)}
                    </span>
                  </Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.0001"
                    min="0"
                    max={userAccountBalance}
                    placeholder="0.1"
                    {...register("amount", {
                      required: "Amount is required",
                      min: {
                        value: 0.0001,
                        message: "Minimum amount is 0.0001 SOL",
                      },
                      max: {
                        value: userAccountBalance,
                        message: "Amount exceeds available balance",
                      },
                      valueAsNumber: true,
                    })}
                    className="text-lg"
                  />
                  {errors.amount && (
                    <p className="text-sm text-red-500">
                      {errors.amount.message}
                    </p>
                  )}
                </div>

                {/* Destination Address Field */}
                <div className="space-y-2">
                  <Label htmlFor="destination">Destination Address</Label>
                  <Input
                    id="destination"
                    placeholder="Solana public key"
                    {...register("destinationAddress", {
                      required: "Destination address is required",
                      pattern: {
                        value: /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
                        message: "Invalid Solana address format",
                      },
                    })}
                    className="font-mono text-sm"
                  />
                  {errors.destinationAddress && (
                    <p className="text-sm text-red-500">
                      {errors.destinationAddress.message}
                    </p>
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={
                    isLoading ||
                    !isValid ||
                    userAccountBalance === 0 ||
                    watchedAmount > userAccountBalance
                  }
                  className="w-full"
                  size="lg"
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Processing Transfer...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Send className="h-4 w-4" />
                      <span>Send Transfer</span>
                    </div>
                  )}
                </Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransferForm;
