"use client";

import { Home, History, MapPin, Search, User } from "lucide-react";

interface BottomNavProps {
	activeTab: string;
	onTabChange: (tab: string) => void;
}

export default function BottomNav({ activeTab, onTabChange }: BottomNavProps) {
	const tabs = [
		{ id: "home", label: "Beranda", icon: Home },
		{ id: "history", label: "Histori", icon: History },
		{ id: "checkin", label: "Cekin", icon: MapPin, primary: true },
		{ id: "browse", label: "Lihat", icon: Search },
		{ id: "profile", label: "Profil", icon: User },
	];

	return (
		<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[5000] w-[92%] max-w-lg">
			<div className="bg-white/90 backdrop-blur-xl border border-gray-200 rounded-2xl shadow-2xl flex items-center justify-between px-2 py-3">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						onClick={() => onTabChange(tab.id)}
						className={`flex flex-col items-center justify-center transition-all ${
							tab.primary 
								? "bg-blue-600 text-white p-3 -mt-10 rounded-full shadow-lg shadow-blue-200" 
								: "flex-1 text-gray-400 hover:text-blue-500"
						} ${activeTab === tab.id && !tab.primary ? "text-blue-600 scale-110" : ""}`}
					>
						<tab.icon size={tab.primary ? 28 : 22} />
						{!tab.primary && (
							<span className="text-[10px] mt-1 font-medium">{tab.label}</span>
						)}
					</button>
				))}
			</div>
		</div>
	);
}
