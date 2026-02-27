"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Web3Auth } from "@web3auth/modal";
import { AuthAdapter } from "@web3auth/auth-adapter";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";
import { CommonPrivateKeyProvider } from "@web3auth/base-provider";
import { API_ENDPOINTS } from "@/lib/api";

interface GoogleUser {
	sub: string;
	email: string;
	name: string;
	picture: string;
	suiAddress: string;
	jwt: string;
	passportObjectId?: string;
}

interface GoogleAuthContextType {
	user: GoogleUser | null;
	walletKeypair?: Ed25519Keypair;
	login: () => Promise<void>;
	logout: () => void;
	isAuthenticated: boolean;
	isInitializing: boolean;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

// Helper to convert hex string to Uint8Array
const hexToUint8Array = (hex: string) => {
	const cleanHex = hex.replace(/^0x/, "");
	const match = cleanHex.match(/.{1,2}/g);
	if (!match) return new Uint8Array();
	return new Uint8Array(match.map((byte) => parseInt(byte, 16)));
};

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<GoogleUser | null>(null);
	const [walletKeypair, setWalletKeypair] = useState<Ed25519Keypair | undefined>(undefined);
	const [web3auth, setWeb3auth] = useState<Web3Auth | null>(null);
	const [isInitializing, setIsInitializing] = useState(true);

	// Initialize Web3Auth on mount
	useEffect(() => {
		const init = async () => {
			try {
				const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || "";
				
				const chainConfig = {
					chainNamespace: CHAIN_NAMESPACES.OTHER,
					chainId: process.env.NEXT_PUBLIC_SUI_NETWORK === "mainnet" ? "0x3" : "0x2",
					rpcTarget: process.env.NEXT_PUBLIC_SUI_NETWORK === "mainnet"
						? process.env.NEXT_PUBLIC_SUI_MAINNET_URL || "https://fullnode.mainnet.sui.io:443"
						: process.env.NEXT_PUBLIC_SUI_TESTNET_URL || "https://fullnode.testnet.sui.io:443",
					displayName: "Sui",
					blockExplorerUrl: "https://suiexplorer.com/",
					ticker: "SUI",
					tickerName: "Sui"
				};

				const privateKeyProvider = new CommonPrivateKeyProvider({
					config: { chainConfig }
				});

				const w3a = new Web3Auth({
					clientId,
					web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
					privateKeyProvider,
					uiConfig: {
						appName: "Jelajah Sinjai",
						theme: { primary: "#2563eb" },
						logoLight: "https://web3auth.io/images/w3a-L-Favicon-1.svg",
						logoDark: "https://web3auth.io/images/w3a-D-Favicon-1.svg",
						defaultLanguage: "en",
						mode: "light",
					}
				});

				const authAdapter = new AuthAdapter({
					adapterSettings: {
						uxMode: "popup",
						loginConfig: {
							google: {
								verifier: "jelajahsinjai", // Updated to match your Auth Connection ID
								typeOfLogin: "google",
								clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "6066138957-vu8vqg10mghtv1br97cc86r1p44sha43.apps.googleusercontent.com",
							},
						},
					},
				});
				w3a.configureAdapter(authAdapter);
				
				await w3a.initModal();
				setWeb3auth(w3a);

				if (w3a.connected && w3a.provider) {
					await handleConnectedProvider(w3a);
				}
			} catch (error) {
				console.error("Web3Auth init error:", error);
			} finally {
				setIsInitializing(false);
			}
		};
		init();
	}, []);

	const handleConnectedProvider = async (w3a: Web3Auth) => {
		const provider = w3a.provider;
		if (!provider) return;

		const suiKey = (await provider.request({ method: "private_key" })) as string;
		if (!suiKey) throw new Error("Unable to retrieve private key");
		
		const bytes = hexToUint8Array(suiKey);
		const kp = Ed25519Keypair.fromSecretKey(bytes);
		setWalletKeypair(kp);

		const userInfo = await w3a.getUserInfo();
		const authData = await w3a.authenticateUser();
		const suiAddr = kp.toSuiAddress();

		console.log("[Web3Auth] User Details (Use this 'sub' for ADMIN_GOOGLE_SUBS):", {
			email: userInfo.email,
			sub: userInfo.verifierId
		});

		const newUser: GoogleUser = {
			sub: userInfo.verifierId || "",
			email: userInfo.email || "",
			name: userInfo.name || "",
			picture: userInfo.profileImage || "",
			suiAddress: suiAddr,
			jwt: authData.idToken,
		};

		const syncedUser = await syncUserWithBackend(authData.idToken, suiAddr);
		if (syncedUser && syncedUser.passportObjectId) {
			newUser.passportObjectId = syncedUser.passportObjectId;
		}

		setUser(newUser);
		return kp;
	};

	const syncUserWithBackend = async (jwt: string, suiAddress: string) => {
		if (!jwt) return null;
		try {
			const res = await fetch(API_ENDPOINTS.USER_REGISTER, {
				method: "POST",
				headers: { 
					"Content-Type": "application/json",
					"Authorization": `Bearer ${jwt}`
				},
				body: JSON.stringify({ suiAddress })
			});
			if (res.ok) {
				return await res.json();
			}
		} catch (err) {
			console.error("[USER] Failed to sync user to backend:", err);
		}
		return null;
	};

	const login = async () => {
		if (!web3auth) return;
		try {
			const provider = await web3auth.connect();
			if (!provider) throw new Error("Login failed");
			await handleConnectedProvider(web3auth);
		} catch (error) {
			console.error("Login error:", error);
		}
	};

	const logout = async () => {
		if (web3auth && web3auth.connected) {
			await web3auth.logout();
		}
		setUser(null);
		setWalletKeypair(undefined);
	};

	return (
		<GoogleAuthContext.Provider
			value={{
				user,
				walletKeypair,
				login,
				logout,
				isAuthenticated: !!user,
				isInitializing
			}}
		>
			{children}
		</GoogleAuthContext.Provider>
	);
}

export function useGoogleUser() {
	const context = useContext(GoogleAuthContext);
	if (context === undefined) {
		throw new Error("useGoogleUser must be used within a GoogleAuthProvider");
	}
	return context;
}
