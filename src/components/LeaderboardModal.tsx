"use client";

import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/lib/api";
import { X, Trophy, Medal, MapPin, CheckCircle, Crown, Star } from "lucide-react";
import { Language } from "@/lib/translations";

interface LeaderboardModalProps {
	isOpen: boolean;
	onClose: () => void;
	lang: Language;
	t: any;
}

export default function LeaderboardModal({ isOpen, onClose, lang, t }: LeaderboardModalProps) {
	const { data: leaderboard, isLoading } = useQuery({
		queryKey: ["leaderboard"],
		queryFn: async () => {
			const res = await fetch(API_ENDPOINTS.LEADERBOARD);
			if (!res.ok) throw new Error(t.loading);
			return res.json();
		},
		enabled: isOpen,
	});

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-[8000] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in duration-200">
			<div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-0 overflow-hidden animate-in slide-in-from-bottom duration-300 h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col">
				<div className="p-6 bg-gradient-to-br from-yellow-400 to-orange-500 text-white shrink-0">
					<div className="flex justify-between items-center mb-4">
						<h2 className="text-2xl font-bold flex items-center gap-2">
							<Trophy size={28} /> {t.leaderboard}
						</h2>
						<button onClick={onClose} className="text-white/80 hover:text-white bg-white/20 p-2 rounded-full">
							<X size={20} />
						</button>
					</div>
					<p className="text-white/90 text-sm">Top 10 Penjelajah Sinjai</p>
				</div>

				<div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
					{isLoading ? (
						<div className="flex flex-col items-center justify-center py-12 text-gray-400">
							<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mb-2"></div>
							{t.loading}
						</div>
					) : leaderboard && leaderboard.length > 0 ? (
						leaderboard.map((user: any, index: number) => (
							<div key={user.id} className={`relative flex items-center gap-4 p-4 rounded-2xl shadow-sm border ${
								index === 0 ? "bg-gradient-to-r from-yellow-50 to-white border-yellow-200" : "bg-white border-gray-100"
							}`}>
								<div className="flex-shrink-0 w-8 text-center font-bold text-gray-400 text-lg">
									{index + 1}
								</div>
								
								<div className="flex-shrink-0 relative">
									<div className={`h-12 w-12 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-md ${
										index === 0 ? "bg-yellow-500" : index === 1 ? "bg-gray-400" : index === 2 ? "bg-orange-700" : "bg-blue-100 text-blue-600"
									}`}>
										{index < 3 ? <Crown size={20} /> : user.nama?.charAt(0).toUpperCase() || "U"}
									</div>
									{/* Badges Logic */}
									<div className="absolute -bottom-1 -right-1 flex gap-0.5">
										{/* Check-in Explorer Badge (Top 5 Checkins logic implied by rank for now) */}
										{index < 5 && (
											<div className="bg-green-500 text-white p-0.5 rounded-full border border-white" title="Check-in Explorer">
												<CheckCircle size={10} />
											</div>
										)}
										{/* Location Explorer Badge (Top 5 Contributors) */}
										{user.locationCount > 0 && index < 5 && (
											<div className="bg-purple-500 text-white p-0.5 rounded-full border border-white" title="Location Explorer">
												<MapPin size={10} />
											</div>
										)}
									</div>
								</div>

								<div className="flex-1 min-w-0">
									<h3 className="font-bold text-gray-900 truncate">
										{user.nama || `User ${user.suiAddress.slice(0, 6)}`}
									</h3>
									<div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
										<span className="flex items-center gap-1">
											<CheckCircle size={12} className="text-green-500" /> {user.totalCheckIn} {t.checkin}
										</span>
										<span className="flex items-center gap-1">
											<MapPin size={12} className="text-purple-500" /> {user.locationCount || 0} {t.add_location}
										</span>
									</div>
								</div>

								<div className="flex-shrink-0 text-right">
									<span className="block text-lg font-bold text-orange-500">{user.points}</span>
									<span className="text-[10px] text-gray-400 uppercase font-bold">{t.points}</span>
								</div>
							</div>
						))
					) : (
						<div className="text-center py-12 text-gray-400">No leaderboard data yet.</div>
					)}
				</div>

				<div className="p-4 bg-white border-t text-[10px] text-gray-500 text-center">
					*Poin dihitung dari akumulasi Cekin (1 poin) dan Tambah Lokasi (5 poin).
				</div>
			</div>
		</div>
	);
}
