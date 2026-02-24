"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleAuthProvider } from "@/hooks/useGoogleUser";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { networkConfig } from "@/lib/networkConfig";
import { ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
	const [queryClient] = useState(() => new QueryClient());

	return (
		<QueryClientProvider client={queryClient}>
			<SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
				<WalletProvider autoConnect>
					<GoogleAuthProvider>
						{children}
					</GoogleAuthProvider>
				</WalletProvider>
			</SuiClientProvider>
		</QueryClientProvider>
	);
}
