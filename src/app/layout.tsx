import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "@mysten/dapp-kit/dist/index.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Jelajah Sinjai",
  description: "Web3 Tourism App for Sinjai",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
