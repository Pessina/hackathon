"use client";

import { FC, ReactNode, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useEnv } from "../hooks/useEnv";

import "@solana/wallet-adapter-react-ui/styles.css";

interface WalletProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: FC<WalletProviderProps> = ({
  children,
}) => {
  const { NEXT_PUBLIC_SOLANA_RPC } = useEnv();

  const endpoint = useMemo(
    () => NEXT_PUBLIC_SOLANA_RPC,
    [NEXT_PUBLIC_SOLANA_RPC]
  );

  const wallets = useMemo(() => [new SolflareWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
