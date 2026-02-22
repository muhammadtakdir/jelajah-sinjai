"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GoogleAuthProvider } from "@/hooks/useGoogleUser";
import { ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
	const [queryClient] = useState(() => new QueryClient());
	const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

	return (
		<QueryClientProvider client={queryClient}>
			<GoogleOAuthProvider clientId={googleClientId}>
				<GoogleAuthProvider>
					{children}
				</GoogleAuthProvider>
			</GoogleOAuthProvider>
		</QueryClientProvider>
	);
}
