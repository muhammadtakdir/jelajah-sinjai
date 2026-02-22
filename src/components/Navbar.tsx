"use client";

import Link from "next/link";
import { GoogleLogin } from "@react-oauth/google";
import { useGoogleUser } from "@/hooks/useGoogleUser";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function Navbar() {
	const { user, login, logout, isAuthenticated } = useGoogleUser();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

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
						Sinjai<span className="text-blue-600">Pass</span>
					</span>
				</Link>

				<div className="flex items-center gap-4">
					{isAuthenticated && user ? (
						<div className="flex items-center gap-3">
							<div className="hidden sm:flex flex-col items-end leading-tight">
								<span className="text-sm font-bold text-gray-800">{user.name}</span>
								<span className="text-xs text-gray-500">{user.email}</span>
							</div>
							<div className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-blue-100 shadow-sm">
								<img 
									src={user.picture} 
									alt={user.name} 
									className="h-full w-full object-cover"
								/>
							</div>
							<button 
								onClick={logout}
								className="text-sm font-semibold text-gray-400 hover:text-red-500 transition-colors ml-1"
							>
								Keluar
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
								useOneTap
								shape="pill"
								theme="outline"
								text="continue_with"
							/>
						</div>
					)}
				</div>
			</div>
		</nav>
	);
}
