"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import { jwtToAddress } from "@mysten/sui/zklogin";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { generateNonce, generateRandomness } from "@mysten/sui/zklogin";
import { API_ENDPOINTS } from "@/lib/api";

interface GoogleUser {
	sub: string;
	email: string;
	name: string;
	picture: string;
	suiAddress: string;
	jwt: string;
}

interface GoogleAuthContextType {
	user: GoogleUser | null;
	login: (credential: string) => void;
	logout: () => void;
	isAuthenticated: boolean;
	nonce: string | undefined; // Expose nonce for Google Button
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

const getSalt = (sub: string) => {
	let hash = BigInt(0);
	const seed = `jelajah-sinjai-salt-${sub}`;
	for (let i = 0; i < seed.length; i++) {
		hash = ((hash << BigInt(5)) - hash) + BigInt(seed.charCodeAt(i));
	}
	const salt = hash > 0 ? hash : -hash;
	return salt; 
};

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<GoogleUser | null>(null);
	const [nonce, setNonce] = useState<string | undefined>(undefined);
	const [ephemeralKeyPair, setEphemeralKeyPair] = useState<Ed25519Keypair | undefined>(undefined);

	// Initialize Ephemeral Key Pair on mount (needed for Nonce)
	useEffect(() => {
		const initEphemeral = async () => {
			const kp = new Ed25519Keypair();
			setEphemeralKeyPair(kp);
			
			const randomness = generateRandomness();
			const epoch = 100; // Placeholder epoch
			const n = generateNonce(kp.getPublicKey(), 100, randomness); 
			setNonce(n);
			
			sessionStorage.setItem("ephemeral_randomness", randomness);
			sessionStorage.setItem("ephemeral_private", kp.getSecretKey());
		};
		initEphemeral();
		
		const savedUser = localStorage.getItem("google_user");
		if (savedUser) {
			const parsedUser = JSON.parse(savedUser);
			setUser(parsedUser);
			
			// Auto-sync returning user if they have a JWT
			if (parsedUser.jwt) {
				syncUserWithBackend(parsedUser.jwt, parsedUser.suiAddress);
			}
		}
	}, []);

	const syncUserWithBackend = async (jwt: string, suiAddress: string) => {
		try {
			console.log("[USER] Syncing with backend...");
			const res = await fetch(API_ENDPOINTS.USER_REGISTER, {
				method: "POST",
				headers: { 
					"Content-Type": "application/json",
					"Authorization": `Bearer ${jwt}`
				},
				body: JSON.stringify({ suiAddress })
			});
			if (res.ok) console.log("[USER] Backend sync successful");
		} catch (err) {
			console.error("[USER] Failed to register/sync user to backend:", err);
		}
	};

	const login = async (credential: string) => {
		try {
			const decoded: any = jwtDecode(credential);
			
			const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";
			if (decoded.aud !== GOOGLE_CLIENT_ID) {
				alert("Keamanan: Token tidak valid untuk aplikasi ini.");
				return;
			}

			if (decoded.exp < Date.now() / 1000) {
				alert("Sesi login telah kadaluarsa.");
				return;
			}

			console.log("USER GOOGLE SUB ID:", decoded.sub);

			const userSalt = getSalt(decoded.sub);
			const zkLoginAddress = jwtToAddress(credential, userSalt, true);

			const newUser: GoogleUser = {
				sub: decoded.sub,
				email: decoded.email,
				name: decoded.name,
				picture: decoded.picture,
				suiAddress: zkLoginAddress,
				jwt: credential,
			};

			// SET STATE DULUAN agar UI langsung update
			setUser(newUser);
			localStorage.setItem("google_user", JSON.stringify(newUser));

			// REGISTER LANGSUNG SAAT LOGIN
			await syncUserWithBackend(credential, zkLoginAddress);
			
		} catch (error) {
			console.error("Failed to process zkLogin:", error);
			alert("Gagal memproses login Web3.");
		}
	};

	const logout = () => {
		setUser(null);
		localStorage.removeItem("google_user");
	};

	return (
		<GoogleAuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, nonce }}>
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
