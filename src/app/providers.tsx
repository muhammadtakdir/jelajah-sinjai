"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleAuthProvider } from "@/hooks/useGoogleUser";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { networkConfig } from "@/lib/networkConfig";
import { ReactNode, useState } from "react";
import { LanguageProvider } from "@/lib/LanguageContext";

export function Providers({ children }: { children: ReactNode }) {
	const [queryClient] = useState(() => new QueryClient());

	return (
		<QueryClientProvider client={queryClient}>
			<SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
				<WalletProvider autoConnect>
					<GoogleAuthProvider>
						<LanguageProvider>
							{children}
						</LanguageProvider>
					</GoogleAuthProvider>
				</WalletProvider>
			</SuiClientProvider>
		</QueryClientProvider>
	);
}
