"use client";

import Link from "next/link";
import { useGoogleUser } from "@/hooks/useGoogleUser";
import { useEffect, useState } from "react";
import { Bell, X, Info, Calendar, Megaphone, Clock, Loader2, Globe } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/lib/api";
import { Language, translations } from "@/lib/translations";
import { useLanguage } from "@/lib/LanguageContext";

interface NavbarProps {
	onLogout?: () => void;
}

export default function Navbar({ onLogout }: NavbarProps) {
	const { user, login, logout, isAuthenticated, isInitializing } = useGoogleUser();
	const { lang, t, changeLanguage } = useLanguage();
	const [mounted, setMounted] = useState(false);
	const [copied, setCopied] = useState(false);
	const [showNotifications, setShowNotifications] = useState(false);
	const [selectedNotif, setSelectedNotif] = useState<any>(null);
	const [showLangMenu, setShowShowLangMenu] = useState(false);

	const { data: notifications } = useQuery({
		queryKey: ["notifications"],
		queryFn: async () => {
			const res = await fetch(API_ENDPOINTS.NOTIFICATIONS);
			if (!res.ok) return [];
			return res.json();
		},
		refetchInterval: 30000, // Refresh every 30s
	});

	useEffect(() => {
		setMounted(true);
	}, []);

	const handleLogout = () => {
		if (onLogout) {
			onLogout();
		} else {
			logout();
		}
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
					{isAuthenticated && user && (
						<div className="relative">
							<button 
								onClick={() => setShowNotifications(!showNotifications)}
								className={`p-2 rounded-full transition-all relative ${showNotifications ? 'bg-blue-50 text-blue-600' : 'text-gray-400 hover:bg-gray-100'}`}
							>
								<Bell size={22} />
								{notifications && notifications.length > 0 && (
									<span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse"></span>
								)}
							</button>

							{/* Notification Dropdown */}
							{showNotifications && (
								<div className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden z-[2000] animate-in slide-in-from-top-2 duration-200">
									<div className="p-4 bg-blue-600 text-white flex justify-between items-center">
										<span className="font-bold">{t.notifikasi}</span>
										<button onClick={() => setShowNotifications(false)} className="opacity-70 hover:opacity-100"><X size={18} /></button>
									</div>
									<div className="max-h-[400px] overflow-y-auto divide-y divide-gray-50">
										{notifications && notifications.length > 0 ? (
											notifications.map((n: any) => (
												<div 
													key={n.id} 
													onClick={() => {
														setSelectedNotif(n);
														setShowNotifications(false);
													}}
													className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
												>
													<div className="flex gap-3">
														<div className={`p-2 rounded-xl shrink-0 ${n.type === 'event' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
															{n.type === 'event' ? <Calendar size={16} /> : <Megaphone size={16} />}
														</div>
														<div>
															<h4 className="text-xs font-bold text-gray-800 line-clamp-1">{n.title}</h4>
															<p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">{n.message}</p>
															<span className="text-[8px] text-gray-400 mt-1 block uppercase font-medium">{t.baru_saja}</span>
														</div>
													</div>
												</div>
											))
										) : (
											<div className="p-10 text-center text-gray-400">
												<Bell size={32} className="mx-auto mb-2 opacity-20" />
												<p className="text-xs">{t.no_notifications}</p>
											</div>
										)}
									</div>
									<div className="p-3 bg-gray-50 text-center border-t border-gray-100">
										<button className="text-[10px] font-bold text-blue-600 hover:text-blue-800 uppercase tracking-widest">{t.lihat_semua}</button>
									</div>
								</div>
							)}
						</div>
					)}

					{/* Language Switcher */}
					<div className="relative">
						<button 
							onClick={() => setShowShowLangMenu(!showLangMenu)}
							className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-all flex items-center gap-1"
							title={t.language}
						>
							<Globe size={20} />
							<span className="text-[10px] font-bold uppercase">{lang}</span>
						</button>
						{showLangMenu && (
							<div className="absolute right-0 mt-2 w-32 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-[2000] py-1">
								<button 
									onClick={() => { changeLanguage("id"); setShowShowLangMenu(false); }}
									className={`w-full px-4 py-2 text-left text-xs font-bold hover:bg-gray-50 ${lang === 'id' ? 'text-blue-600' : 'text-gray-600'}`}
								>
									🇮🇩 Indonesia
								</button>
								<button 
									onClick={() => { changeLanguage("en"); setShowShowLangMenu(false); }}
									className={`w-full px-4 py-2 text-left text-xs font-bold hover:bg-gray-50 ${lang === 'en' ? 'text-blue-600' : 'text-gray-600'}`}
								>
									🇺🇸 English
								</button>
							</div>
						)}
					</div>

					{isAuthenticated && user ? (
						<div className="flex items-center gap-3">
							<div className="hidden sm:flex flex-col items-end leading-tight mr-1">
								<span className="text-sm font-bold text-gray-800">{user.name}</span>
								<button 
									onClick={() => copyToClipboard(user.suiAddress)}
									className="group flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-600 transition-colors"
									title={t.copy_address}
								>
									<span>{user.suiAddress.slice(0, 6)}...{user.suiAddress.slice(-4)}</span>
									{copied ? (
										<span className="text-green-500 font-bold">{t.tersalin}</span>
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
								title={t.keluar}
							>
								<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
								</svg>
							</button>
						</div>
					) : (
						<div className="flex items-center">
							<button 
								onClick={() => login()}
								disabled={isInitializing}
								className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-md transition-all active:scale-95 flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
							>
								{isInitializing ? (
									<Loader2 className="w-4 h-4 animate-spin" />
								) : (
									<svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
										<path d="M12.48 10.92v3.28h7.84c-.24 1.84-.908 3.152-1.928 4.176-1.228 1.228-3.14 2.56-6.4 2.56-5.116 0-9.28-4.148-9.28-9.272s4.164-9.272 9.28-9.272c2.796 0 4.92 1.108 6.42 2.52l2.308-2.308C18.86 1.056 16.03 0 12.48 0 5.868 0 .404 5.464.404 12s5.464 12 12.076 12c3.572 0 6.26-1.176 8.364-3.388 2.172-2.172 2.86-5.232 2.86-7.74 0-.636-.052-1.236-.148-1.76H12.48z"/>
									</svg>
								)}
								<span>{isInitializing ? t.loading : t.masuk}</span>
							</button>
						</div>
					)}
				</div>
			</div>

			{/* Notification Detail Modal */}
			{selectedNotif && (
				<div className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200">
					<div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
						<div className={`p-6 text-white ${selectedNotif.type === 'event' ? 'bg-purple-600' : 'bg-blue-600'}`}>
							<div className="flex justify-between items-start mb-4">
								<div className="bg-white/20 p-2 rounded-xl">
									{selectedNotif.type === 'event' ? <Calendar size={24} /> : <Megaphone size={24} />}
								</div>
								<button onClick={() => setSelectedNotif(null)} className="hover:bg-white/20 p-1 rounded-full"><X size={20} /></button>
							</div>
							<h3 className="text-xl font-bold">{selectedNotif.title}</h3>
						</div>
						<div className="p-6">
							<p className="text-gray-600 text-sm leading-relaxed mb-6 whitespace-pre-line">{selectedNotif.message}</p>
							<div className="flex items-center gap-2 text-gray-400 text-[10px] font-bold uppercase tracking-wider">
								<Clock size={12} />
								{new Date(selectedNotif.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
							</div>
							<button 
								onClick={() => setSelectedNotif(null)}
								className="w-full mt-8 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold py-3 rounded-xl transition-all"
							>
								Tutup
							</button>
						</div>
					</div>
				</div>
			)}
		</nav>
	);
}
