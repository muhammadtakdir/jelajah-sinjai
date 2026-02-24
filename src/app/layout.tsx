import type { Metadata } from "next";
import "./globals.css";
import "@mysten/dapp-kit/dist/index.css";
import { Providers } from "./providers";


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
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
