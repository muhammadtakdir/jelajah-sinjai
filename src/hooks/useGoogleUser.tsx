"use client";

import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { jwtDecode } from "jwt-decode";

interface GoogleUser {
	sub: string;
	email: string;
	name: string;
	picture: string;
	suiAddress: string;
}

interface GoogleAuthContextType {
	user: GoogleUser | null;
	login: (credential: string) => void;
	logout: () => void;
	isAuthenticated: boolean;
}

const GoogleAuthContext = createContext<GoogleAuthContextType | undefined>(undefined);

// Helper function to create a "virtual" Sui address from email hash
const generateVirtualSuiAddress = (email: string) => {
	// Simple hash for demo purposes - in real app use something more robust if needed
	let hash = 0;
	for (let i = 0; i < email.length; i++) {
		hash = ((hash << 5) - hash) + email.charCodeAt(i);
		hash |= 0; 
	}
	const hex = Math.abs(hash).toString(16).padStart(64, '0');
	return `0x${hex}`;
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
		const decoded: any = jwtDecode(credential);
		const newUser: GoogleUser = {
			sub: decoded.sub,
			email: decoded.email,
			name: decoded.name,
			picture: decoded.picture,
			suiAddress: generateVirtualSuiAddress(decoded.email),
		};
		setUser(newUser);
		localStorage.setItem("google_user", JSON.stringify(newUser));
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
