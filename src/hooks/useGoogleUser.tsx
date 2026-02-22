"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { jwtDecode } from "jwt-decode";
import { jwtToAddress } from "@mysten/sui/zklogin";

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
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

// Helper function to generate a consistent salt for a user
// In a production app, this should be fetched from a secure backend service
const getSalt = (sub: string) => {
	// For this demo, we derive a salt from the user's sub + app secret/constant
	// This ensures the address is consistent across logins
	// WARNING: In production, use a Master Seed + HKDF on a backend server!
	let hash = BigInt(0);
	const seed = `jelajah-sinjai-salt-${sub}`;
	for (let i = 0; i < seed.length; i++) {
		hash = ((hash << BigInt(5)) - hash) + BigInt(seed.charCodeAt(i));
	}
	// Ensure positive BigInt for salt
	const salt = hash > 0 ? hash : -hash;
	return salt; 
};

export function GoogleAuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<GoogleUser | null>(null);

	useEffect(() => {
		const savedUser = localStorage.getItem("google_user");
		if (savedUser) {
			setUser(JSON.parse(savedUser));
		}
	}, []);

	const login = (credential: string) => {
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
		<GoogleAuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
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
