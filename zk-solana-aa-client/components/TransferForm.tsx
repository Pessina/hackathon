"use client";

import { useState } from "react";
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
import { Wallet, Send, Shield } from "lucide-react";
import { useEnv } from "@/hooks/useEnv";

interface TransferFormProps {
  className?: string;
}

const TransferForm = ({ className }: TransferFormProps) => {
  const { NEXT_PUBLIC_JWT_ZK_PROOF_SERVER_URL, NEXT_PUBLIC_SOLANA_AA_ADDRESS } =
    useEnv();
  const [idToken, setIdToken] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [destinationAddress, setDestinationAddress] = useState<
    string | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const handleGoogleSuccess = (token: string) => {
    setIdToken(token);
    setIsAuthenticated(true);
    toast.success("Successfully signed in with Google!");
  };

  const handleGoogleError = () => {
    toast.error("Failed to sign in with Google. Please try again.");
  };

  const handleTransfer = async () => {
    if (!idToken) {
      toast.error("Please sign in with Google first");
      return;
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!destinationAddress?.trim()) {
      toast.error("Please enter a destination address");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `${NEXT_PUBLIC_JWT_ZK_PROOF_SERVER_URL}/api/transfer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            idToken,
            amount: Number(amount),
            destinationAddress: destinationAddress.trim(),
            contractAddress: NEXT_PUBLIC_SOLANA_AA_ADDRESS,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Transfer failed: ${response.statusText}`);
      }

      const result = await response.json();
      toast.success(
        `Transfer successful! Transaction: ${result.signature || "completed"}`
      );

      // Reset form
      setAmount("");
      setDestinationAddress(undefined);
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
    setIdToken("");
    setIsAuthenticated(false);
    setAmount("");
    setDestinationAddress(undefined);
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
          Secure, privacy-preserving transfers on Solana Devnet
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!isAuthenticated ? (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Sign in with Google to get your OIDC token for ZK proof
                generation
              </p>
            </div>
            <GoogleButton
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
            />
          </div>
        ) : (
          <div className="space-y-4">
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

            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-xs text-blue-800 dark:text-blue-200">
                <strong>Contract:</strong>{" "}
                <span className="font-mono break-all">
                  {NEXT_PUBLIC_SOLANA_AA_ADDRESS}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="amount" className="flex items-center space-x-2">
                  <Wallet className="h-4 w-4" />
                  <span>Amount (SOL)</span>
                </Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="0.1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  className="text-lg"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="destination"
                  className="flex items-center space-x-2"
                >
                  <Send className="h-4 w-4" />
                  <span>Destination Address</span>
                </Label>
                <Input
                  id="destination"
                  placeholder="Solana public key"
                  value={destinationAddress}
                  onChange={(e) => setDestinationAddress(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <Button
                onClick={handleTransfer}
                disabled={isLoading || !amount || !destinationAddress}
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
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransferForm;
