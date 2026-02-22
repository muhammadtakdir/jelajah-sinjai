"use client";

import Link from "next/link";
import { GoogleLogin, googleLogout } from "@react-oauth/google";
import { useGoogleUser } from "@/hooks/useGoogleUser";
import { useEffect, useState } from "react";

export default function Navbar() {
	const { user, login, logout, isAuthenticated } = useGoogleUser();
	const [mounted, setMounted] = useState(false);
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const handleLogout = () => {
		googleLogout();
		logout();
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	if (!mounted) return null;

	return (
		<nav className="sticky top-0 z-[1000] w-full border-b bg-white/80 backdrop-blur-md shadow-sm">
			<div className="container mx-auto flex h-16 items-center justify-between px-4">
				<Link href="/" className="flex items-center gap-2">
					<div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-sm">
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
						</svg>
					</div>
					<span className="text-xl font-bold tracking-tight text-gray-900">
						Jelajah<span className="text-blue-600">Sinjai</span>
					</span>
				</Link>

				<div className="flex items-center gap-4">
					{isAuthenticated && user ? (
						<div className="flex items-center gap-3">
							<div className="hidden sm:flex flex-col items-end leading-tight mr-1">
								<span className="text-sm font-bold text-gray-800">{user.name}</span>
								<button 
									onClick={() => copyToClipboard(user.suiAddress)}
									className="group flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-600 transition-colors"
									title="Klik untuk salin Alamat SUI"
								>
									<span>{user.suiAddress.slice(0, 6)}...{user.suiAddress.slice(-4)}</span>
									{copied ? (
										<span className="text-green-500 font-bold">Tersalin!</span>
									) : (
										<svg className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
										</svg>
									)}
								</button>
							</div>
							<div className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-blue-100 shadow-sm">
								<img 
									src={user.picture} 
									alt={user.name} 
									className="h-full w-full object-cover"
								/>
							</div>
							<button 
								onClick={handleLogout}
								className="p-2 text-gray-400 hover:text-red-500 transition-colors"
								title="Keluar"
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
								</svg>
							</button>
						</div>
					) : (
						<div className="flex items-center">
							<GoogleLogin 
								onSuccess={(credentialResponse) => {
									if (credentialResponse.credential) {
										login(credentialResponse.credential);
									}
								}}
								onError={() => {
									console.error('Login Failed');
									alert('Login Gagal, silakan coba lagi.');
								}}
								text="continue_with"
							/>
						</div>
					)}
				</div>
			</div>
		</nav>
	);
}
