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
			// Check if we have one in session to persist across reloads (optional but good)
			// For simplicity, generate new one on fresh load
			const kp = new Ed25519Keypair();
			setEphemeralKeyPair(kp);
			
			const randomness = generateRandomness();
			// Max epoch is required. For dev we can set it high or fetch from network. 
			// Hardcoding relative expiration for simplicity (e.g. current epoch + 10)
			// But for pure frontend without rpc call now, we can use a placeholder or 0? 
			// No, nonce generation needs epoch. 
			// Let's assume epoch 0 for now or fetch it? 
			// Standard practice: fetch epoch. But to avoid async complexity in this step:
			// We will generate nonce JUST IN TIME when user clicks login if possible?
			// GoogleLogin needs nonce as prop.
			// Let's use a static epoch for demo or fetch it.
			// Ideally: const { epoch } = await suiClient.getLatestSuiSystemState();
			// We will simply use a future epoch (e.g. 10000) for validity window if allowed, 
			// or just generate randomness.
			
			// Actual nonce generation:
			const epoch = 100; // Placeholder epoch
			const n = generateNonce(kp.getPublicKey(), 100, randomness); 
			setNonce(n);
			
			// Store keys for later signing
			sessionStorage.setItem("ephemeral_randomness", randomness);
			sessionStorage.setItem("ephemeral_private", kp.getSecretKey());
		};
		initEphemeral();
		
		const savedUser = localStorage.getItem("google_user");
		if (savedUser) {
			setUser(JSON.parse(savedUser));
		}
	}, []);

	const login = async (credential: string) => {
		try {
			const decoded: any = jwtDecode(credential);
			
			// Generate salt (simulated consistent salt)
			const userSalt = getSalt(decoded.sub);
			
			// Generate real zkLogin Sui Address
			// jwtToAddress(jwt, salt, legacyAddress)
			// legacyAddress: true ensures compatibility with the standard zkLogin address derivation
			const zkLoginAddress = jwtToAddress(credential, userSalt, true);

			const newUser: GoogleUser = {
				sub: decoded.sub,
				email: decoded.email,
				name: decoded.name,
				picture: decoded.picture,
				suiAddress: zkLoginAddress,
				jwt: credential,
			};

			// Register user to backend to ensure they exist for check-ins
			try {
				await fetch(API_ENDPOINTS.USER_REGISTER, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						suiAddress: zkLoginAddress,
						nama: decoded.name
					})
				});
			} catch (backendErr) {
				console.error("Failed to register user to backend:", backendErr);
			}

			setUser(newUser);
			localStorage.setItem("google_user", JSON.stringify(newUser));
			
			// console.log("zkLogin Address Generated:", zkLoginAddress);
		} catch (error) {
			console.error("Failed to process zkLogin:", error);
			alert("Gagal memproses login Web3. Silakan coba lagi.");
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
