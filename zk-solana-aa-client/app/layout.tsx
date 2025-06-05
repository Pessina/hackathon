import type { Metadata } from "next";
import "./globals.css";
import { WalletContextProvider } from "@/providers/WalletProvider";
import GoogleProvider from "@/providers/GoogleProvider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "ZK Solana AA",
  description: "Zero-Knowledge Account Abstraction for Solana",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <GoogleProvider>
          <WalletContextProvider>
            {children}
            <Toaster />
          </WalletContextProvider>
        </GoogleProvider>
      </body>
    </html>
  );
}
