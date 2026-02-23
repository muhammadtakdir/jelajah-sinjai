"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GoogleAuthProvider } from "@/hooks/useGoogleUser";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { networkConfig } from "@/lib/networkConfig";
import { ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
	const [queryClient] = useState(() => new QueryClient());
	const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

	return (
		<QueryClientProvider client={queryClient}>
			<SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
				<WalletProvider autoConnect>
					<GoogleOAuthProvider clientId={googleClientId}>
						<GoogleAuthProvider>
							{children}
						</GoogleAuthProvider>
					</GoogleOAuthProvider>
				</WalletProvider>
			</SuiClientProvider>
		</QueryClientProvider>
	);
}
