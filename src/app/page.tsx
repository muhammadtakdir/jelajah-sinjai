"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import DynamicMap from "@/components/DynamicMap";
import AddLocationModal from "@/components/AddLocationModal";
import BottomNav from "@/components/BottomNav";
import { useGoogleUser } from "@/hooks/useGoogleUser";
import { useAdmin } from "@/hooks/useAdmin";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckInPayload, Lokasi } from "@/lib/types";
import { API_ENDPOINTS } from "@/lib/api";
import { Loader2, Navigation, CheckCircle, Package, User, Wallet, Award, Clock, MapPin, Plus, Camera, X } from "lucide-react";
import { calculateDistance, formatDistance } from "@/lib/geoUtils";

export default function Home() {
	const { user, isAuthenticated } = useGoogleUser();
	const { isAdmin } = useAdmin();
	const [activeTab, setActiveTab] = useState("home");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
	const [selectedLokasiId, setSelectedLokasiId] = useState<number | null>(null);
	const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
	
	const [checkInForm, setCheckInForm] = useState({
		foto: "",
		komentar: "",
	});
	const [uploadingCheckIn, setUploadingCheckIn] = useState(false);
	const [checkInPreview, setCheckInPreview] = useState("");
	const checkInFileRef = useRef<HTMLInputElement>(null);

	const handleCheckInPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setUploadingCheckIn(true);
		const reader = new FileReader();
		reader.onloadend = () => setCheckInPreview(reader.result as string);
		reader.readAsDataURL(file);

		const formData = new FormData();
		formData.append("file", file);

		try {
			const res = await fetch(API_ENDPOINTS.UPLOAD, { method: "POST", body: formData });
			const data = await res.json();
			if (data.url) setCheckInForm(prev => ({ ...prev, foto: data.url }));
		} catch (error) {
			alert("Gagal mengunggah foto cek-in");
		} finally {
			setUploadingCheckIn(false);
		}
	};

	// Automatically get location when switching to checkin tab
	useEffect(() => {
		if (activeTab === "checkin" && !currentCoords) {
			getGeolocation();
		}
	}, [activeTab]);

	// Fetch location data once for the app
	const { data: lokasiData, isLoading: isLoadingLokasi } = useQuery<Lokasi[]>({
		queryKey: ["lokasi"],
		queryFn: async () => {
			const res = await fetch(API_ENDPOINTS.LOKASI);
			if (!res.ok) throw new Error("Gagal mengambil data lokasi");
			return res.json();
		},
	});

	const checkInMutation = useMutation({
		mutationFn: async (payload: CheckInPayload) => {
			const response = await fetch(API_ENDPOINTS.CHECKIN, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (!response.ok) throw new Error("Gagal melakukan Check-In");
			return response.json();
		},
		onSuccess: () => {
			alert(`✅ Check-In Berhasil! Lokasi terverifikasi.`);
			setActiveTab("history");
		},
	});

	const getGeolocation = () => {
		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(pos) => setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
				(err) => alert("Gagal mengambil lokasi: " + err.message)
			);
		}
	};

	const handleCheckIn = (lokasiId: number) => {
		if (!isAuthenticated || !user) {
			alert("⚠️ Silakan login dengan Google terlebih dahulu!");
			return;
		}
		setSelectedLokasiId(lokasiId);
		setIsCheckInModalOpen(true);
	};

	const submitCheckIn = () => {
		if (selectedLokasiId === null) return;
		checkInMutation.mutate({
			suiAddress: user!.suiAddress,
			lokasiId: selectedLokasiId,
			foto: checkInForm.foto,
			komentar: checkInForm.komentar,
		});
		setIsCheckInModalOpen(false);
		setCheckInForm({ foto: "", komentar: "" });
		setCheckInPreview("");
	};

	const renderContent = () => {
		switch (activeTab) {
			case "home":
				return (
					<div className="space-y-6 animate-in fade-in duration-500">
						<div className="bg-white p-2 rounded-3xl shadow-2xl border border-gray-100 overflow-hidden relative z-0 h-[70vh] md:h-[600px]">
							<DynamicMap onCheckIn={handleCheckIn} />
						</div>
						<div className="grid grid-cols-2 gap-4 pb-24">
							<div className="bg-blue-50 p-4 rounded-2xl flex flex-col items-center text-center">
								<Navigation className="text-blue-600 mb-2" size={24} />
								<span className="text-sm font-bold text-blue-900">Wisata Populer</span>
								<span className="text-[10px] text-blue-600">Lihat selengkapnya</span>
							</div>
							<div className="bg-green-50 p-4 rounded-2xl flex flex-col items-center text-center">
								<CheckCircle className="text-green-600 mb-2" size={24} />
								<span className="text-sm font-bold text-green-900">Check-In Terkini</span>
								<span className="text-[10px] text-green-600">Jelajah Sinjai</span>
							</div>
						</div>
					</div>
				);
			case "history":
				return (
					<div className="space-y-4 pb-32 animate-in slide-in-from-right duration-300">
						<h2 className="text-2xl font-bold mb-4">Histori Penjelajahan</h2>
						<div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y">
							{/* Placeholder for real history data from API */}
							{[1, 2, 3].map((i) => (
								<div key={i} className="p-4 flex items-center gap-4">
									<div className="bg-gray-100 p-2 rounded-xl">
										<Clock size={20} className="text-gray-400" />
									</div>
									<div className="flex-1">
										<h4 className="font-semibold text-sm">Hutan Mangrove Tongke-Tongke</h4>
										<p className="text-[10px] text-gray-400">22 Feb 2026 • 14:30 WITA</p>
									</div>
									<div className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">Terverifikasi</div>
								</div>
							))}
							<div className="p-8 text-center text-gray-400 italic text-sm">Fitur histori sedang dalam pengembangan...</div>
						</div>
					</div>
				);
			case "checkin":
				const nearestLocations = lokasiData 
					? [...lokasiData]
						.map(loc => ({
							...loc,
							dist: currentCoords ? calculateDistance(currentCoords.lat, currentCoords.lng, loc.latitude, loc.longitude) : 999999
						}))
						.sort((a, b) => a.dist - b.dist)
						.slice(0, 10)
					: [];

				return (
					<div className="space-y-6 pb-32 animate-in zoom-in duration-300">
						<div className="bg-blue-600 p-8 rounded-3xl text-white shadow-xl relative overflow-hidden">
							<div className="absolute top-0 right-0 p-4 opacity-10">
								<Navigation size={120} />
							</div>
							<h2 className="text-2xl font-bold mb-2 text-white">Cekin Cepat</h2>
							<p className="text-blue-100 text-sm mb-6">Mendeteksi lokasi terdekat berdasarkan posisi GPS Anda saat ini.</p>
							
							<div className="flex items-center gap-3">
								<button 
									onClick={getGeolocation}
									className="bg-white text-blue-600 font-bold px-5 py-2.5 rounded-xl shadow-lg active:scale-95 transition-all text-sm"
								>
									Update GPS
								</button>
								{currentCoords && (
									<div className="bg-blue-700/50 px-3 py-2 rounded-lg text-[10px] font-mono border border-blue-400/30">
										📍 {currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}
									</div>
								)}
							</div>
						</div>
						
						<div className="flex items-center justify-between px-2">
							<h3 className="font-bold text-lg text-gray-800">Saran Lokasi Terdekat</h3>
							<span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full uppercase tracking-wider">Top 10</span>
						</div>

						{nearestLocations.length > 0 ? (
							<div className="grid grid-cols-1 gap-3">
								{nearestLocations.map(lokasi => (
									<div key={lokasi.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between hover:border-blue-200 transition-all group">
										<div className="flex items-center gap-3">
											<div className="bg-slate-50 p-2.5 rounded-xl text-blue-600">
												<MapPin size={20} />
											</div>
											<div>
												<h4 className="font-bold text-gray-900 leading-tight">{lokasi.nama}</h4>
												<div className="flex items-center gap-2 mt-1">
													<span className="text-[10px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded italic">{lokasi.kategori}</span>
													{currentCoords && (
														<span className="text-[10px] font-bold text-blue-500 flex items-center gap-0.5">
															<Navigation size={8} /> {formatDistance(lokasi.dist)}
														</span>
													)}
												</div>
											</div>
										</div>
										<button 
											onClick={() => handleCheckIn(lokasi.id)}
											disabled={checkInMutation.isPending}
											className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-2xl shadow-md disabled:bg-gray-200 transition-all active:scale-90"
											title="Cekin di sini"
										>
											{checkInMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
										</button>
									</div>
								))}
								
								<div className="pt-4 px-2">
									<div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center">
										<p className="text-sm text-gray-500 mb-4 font-medium">Tempat yang Anda cari tidak ada?</p>
										<button 
											onClick={() => setActiveTab("add")}
											className="inline-flex items-center gap-2 text-blue-600 font-bold bg-white px-4 py-2 rounded-xl shadow-sm border hover:bg-gray-50 transition-all"
										>
											<Plus size={18} /> Tambah Lokasi Baru
										</button>
									</div>
								</div>
							</div>
						) : (
							<div className="flex flex-col items-center justify-center py-12 text-center px-6">
								<div className="bg-gray-100 p-4 rounded-full mb-4">
									<MapPin size={32} className="text-gray-300" />
								</div>
								<h4 className="font-bold text-gray-800 mb-1 text-base">Belum Ada Lokasi</h4>
								<p className="text-xs text-gray-400 mb-6">Jadilah yang pertama menambahkan lokasi wisata di sekitar Anda!</p>
								<button 
									onClick={() => setActiveTab("add")}
									className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg text-sm"
								>
									Tambah Lokasi Sekarang
								</button>
							</div>
						)}
					</div>
				);
			case "add":
				return (
					<div className="space-y-6 pb-32 animate-in slide-in-from-bottom duration-300">
						<div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-8 rounded-3xl text-white shadow-xl">
							<h2 className="text-2xl font-bold mb-2">Kontribusi Destinasi</h2>
							<p className="text-indigo-100 text-sm mb-6">Bantu kami mengembangkan data pariwisata Sinjai.</p>
							<button 
								onClick={() => setIsModalOpen(true)}
								className="bg-white text-purple-700 font-bold px-8 py-4 rounded-2xl shadow-xl w-full text-lg active:scale-95 transition-all"
							>
								Tambah Lokasi Baru
							</button>
						</div>

						{isAdmin && (
							<div className="bg-yellow-50 border-2 border-yellow-100 p-6 rounded-3xl">
								<div className="flex items-center gap-2 mb-4 text-yellow-800">
									<Award size={24} />
									<h3 className="font-bold">Panel Admin</h3>
								</div>
								<p className="text-xs text-yellow-700 mb-4">Sebagai Admin, Anda dapat menyetujui usulan tempat baru yang masuk ke sistem.</p>
								<button className="bg-yellow-600 text-white font-bold w-full py-3 rounded-xl shadow-md">
									Lihat Semua Usulan (Pending)
								</button>
							</div>
						)}

						<div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
							<h3 className="font-bold mb-3">Punya Usaha/Tempat?</h3>
							<p className="text-sm text-gray-500 mb-4">Klaim kepemilikan tempat Anda untuk mengelola informasi dan mendapatkan badge verifikasi.</p>
							<button className="text-blue-600 text-sm font-bold border-b-2 border-blue-600 pb-1 hover:text-blue-700 transition-colors">
								Pelajari cara Klaim Tempat →
							</button>
						</div>
					</div>
				);
			case "profile":
				return (
					<div className="space-y-6 pb-32 animate-in slide-in-from-left duration-300">
						<div className="flex flex-col items-center pt-4">
							<div className="relative mb-4">
								<div className="h-24 w-24 rounded-full border-4 border-white shadow-xl overflow-hidden">
									<img src={user?.picture} alt={user?.name} className="h-full w-full object-cover" />
								</div>
								<div className="absolute bottom-0 right-0 bg-blue-600 text-white p-1.5 rounded-full shadow-lg">
									<Award size={16} />
								</div>
							</div>
							<h2 className="text-2xl font-bold text-gray-900">{user?.name}</h2>
							<p className="text-gray-400 text-sm mb-6">{user?.email}</p>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="bg-white p-4 rounded-3xl shadow-sm border text-center">
								<Award className="text-yellow-500 mx-auto mb-2" />
								<span className="block text-xl font-bold">120</span>
								<span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Poin Travel</span>
							</div>
							<div className="bg-white p-4 rounded-3xl shadow-sm border text-center">
								<Package className="text-blue-500 mx-auto mb-2" />
								<span className="block text-xl font-bold">4</span>
								<span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Badge Koleksi</span>
							</div>
						</div>

						<div className="bg-white rounded-3xl shadow-sm border border-gray-100 divide-y overflow-hidden">
							<div className="p-5 flex items-center justify-between">
								<div className="flex items-center gap-3">
									<Wallet size={20} className="text-gray-400" />
									<span className="text-sm font-medium">Alamat SUI (Virtual)</span>
								</div>
								<span className="text-xs font-mono text-gray-400">{user?.suiAddress.slice(0, 8)}...</span>
							</div>
							<div className="p-5 flex items-center justify-between">
								<div className="flex items-center gap-3">
									<Award size={20} className="text-gray-400" />
									<span className="text-sm font-medium">Level Traveler</span>
								</div>
								<span className="text-xs font-bold text-blue-600">Pioneer Sinjai</span>
							</div>
						</div>

						<div className="bg-slate-900 p-6 rounded-3xl text-white shadow-xl">
							<div className="flex justify-between items-start mb-6">
								<div>
									<h4 className="text-xs font-bold text-slate-500 mb-1 uppercase tracking-widest">SUI WALLET BALANCE</h4>
									<div className="text-3xl font-bold">0.00 SUI</div>
								</div>
								<div className="bg-white/10 p-2 rounded-xl">
									<Wallet size={24} />
								</div>
							</div>
							<div className="flex gap-2">
								<button className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl text-xs font-bold transition-all">ISI SALDO</button>
								<button className="flex-1 bg-blue-600 hover:bg-blue-700 py-3 rounded-xl text-xs font-bold transition-all">RIWAYAT</button>
							</div>
						</div>
					</div>
				);
			default:
				return null;
		}
	};

	return (
		<main className="min-h-screen bg-slate-50 flex flex-col">
			<Navbar />

			<div className="flex-1 container mx-auto px-4 py-8">
				{renderContent()}
			</div>

			<BottomNav activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab)} />
			<AddLocationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

			{/* Check-In Modal with Photo & Comment */}
			{isCheckInModalOpen && (
				<div className="fixed inset-0 z-[6000] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 animate-in fade-in duration-200">
					<div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-6 overflow-hidden animate-in slide-in-from-bottom duration-300">
						<div className="flex justify-between items-center mb-4">
							<h3 className="text-xl font-bold text-gray-900">Konfirmasi Cekin</h3>
							<button onClick={() => setIsCheckInModalOpen(false)} className="text-gray-400 hover:text-gray-600">
								<X size={24} />
							</button>
						</div>

						<div className="space-y-4">
							<div 
								onClick={() => checkInFileRef.current?.click()}
								className="relative w-full h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-all overflow-hidden"
							>
								{checkInPreview ? (
									<>
										<img src={checkInPreview} alt="Preview" className="w-full h-full object-cover" />
										<div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
											<Camera className="text-white" size={32} />
										</div>
									</>
								) : (
									<>
										{uploadingCheckIn ? <Loader2 className="animate-spin text-blue-600" /> : <Camera className="text-gray-400 mb-2" size={32} />}
										<p className="text-sm text-gray-500 font-medium">{uploadingCheckIn ? "Mengunggah..." : "Ambil Foto di Lokasi"}</p>
										<p className="text-[10px] text-gray-400 mt-1 italic">Wajib untuk verifikasi kunjungan</p>
									</>
								)}
							</div>
							<input type="file" ref={checkInFileRef} onChange={handleCheckInPhoto} accept="image/*" className="hidden" />

							<div>
								<label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Komentar / Kesan</label>
								<textarea 
									className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-24 resize-none text-sm"
									placeholder="Bagaimana pengalaman Anda di sini?"
									value={checkInForm.komentar}
									onChange={(e) => setCheckInForm({...checkInForm, komentar: e.target.value})}
								/>
							</div>

							<button 
								onClick={submitCheckIn}
								disabled={uploadingCheckIn || checkInMutation.isPending}
								className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-100 transition-all active:scale-95 flex items-center justify-center gap-2"
							>
								{checkInMutation.isPending ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle size={20} />}
								<span>Kirim Cekin Sekarang</span>
							</button>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}
