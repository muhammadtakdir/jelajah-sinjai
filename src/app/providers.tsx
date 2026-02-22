"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { networkConfig } from "@/lib/networkConfig";
import { ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
	const [queryClient] = useState(() => new QueryClient());
	const defaultNetwork = (process.env.NEXT_PUBLIC_SUI_NETWORK as "testnet" | "mainnet") || "testnet";

	return (
		<QueryClientProvider client={queryClient}>
			<SuiClientProvider networks={networkConfig} defaultNetwork={defaultNetwork}>
				<WalletProvider autoConnect>
					{children}
				</WalletProvider>
			</SuiClientProvider>
		</QueryClientProvider>
	);
}
