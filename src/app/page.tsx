"use client";

import { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import DynamicMap from "@/components/DynamicMap";
import AddLocationModal from "@/components/AddLocationModal";
import BottomNav from "@/components/BottomNav";
import { useGoogleUser } from "@/hooks/useGoogleUser";
import { useAdmin } from "@/hooks/useAdmin";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckInPayload, Lokasi } from "@/lib/types";
import { API_ENDPOINTS } from "@/lib/api";
import { Loader2, Navigation, CheckCircle, Package, User, Wallet, Award, Clock, MapPin, Plus, Camera, X, Search } from "lucide-react";
import { calculateDistance, formatDistance } from "@/lib/geoUtils";
import { useCategories } from "@/hooks/useCategories";
import { Language, translations } from "@/lib/translations";
import { Settings, Globe, Trash2, Check, XCircle, AlertTriangle, ShieldCheck, Edit, Trash } from "lucide-react";

export default function Home() {
	const { user, isAuthenticated, logout } = useGoogleUser();
	const { isAdmin } = useAdmin();
	const { data: categories } = useCategories();
	const [activeTab, setActiveTab] = useState("home");
	const [lang, setLang] = useState<Language>("id");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingLocation, setEditingLocation] = useState<Lokasi | null>(null);
	const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
	const [selectedLokasiId, setSelectedLokasiId] = useState<number | null>(null);
	const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
	
	const t = translations[lang];

	useEffect(() => {
		const savedLang = localStorage.getItem("app_lang") as Language;
		if (savedLang) setLang(savedLang);
	}, []);

	const changeLanguage = (newLang: Language) => {
		setLang(newLang);
		localStorage.setItem("app_lang", newLang);
	};

	const queryClient = useQueryClient();

	const adminActionMutation = useMutation({
		mutationFn: async ({ id, status, method }: { id: number, status?: number, method: "PATCH" | "DELETE" }) => {
			const url = method === "DELETE" ? API_ENDPOINTS.LOKASI_DELETE(id) : API_ENDPOINTS.LOKASI_UPDATE(id);
			const response = await fetch(url, {
				method: method,
				headers: { "Content-Type": "application/json" },
				body: method === "PATCH" ? JSON.stringify({ status }) : undefined,
			});
			if (!response.ok) throw new Error("Gagal melakukan aksi admin");
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lokasi"] });
			alert("Aksi berhasil diperbarui.");
		},
	});

	// Browse States
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [viewingLokasi, setViewingLokasi] = useState<Lokasi | null>(null);
	
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
		formData.append("foto", file);

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
			try {
				const res = await fetch(API_ENDPOINTS.LOKASI);
				if (!res.ok) throw new Error("Gagal mengambil data lokasi");
				const data = await res.json();
				console.log("Fetched Locations:", data); // Debug log
				
				// Map backend `fotoUtama` to frontend `foto`
				const mappedData = data.map((item: any) => ({
					...item,
					foto: item.fotoUtama || item.foto // Handle both cases
				}));

				// Fallback Mock Data if empty (for demo purposes)
				if (!mappedData || mappedData.length === 0) {
					console.warn("API returned empty, using mock data for demo.");
					return [
						{
							id: 1,
							nama: "Hutan Mangrove Tongke-Tongke",
							kategori: "Wisata Alam",
							deskripsi: "Kawasan hutan bakau yang asri dengan jembatan kayu panjang.",
							latitude: -5.1866,
							longitude: 120.2289,
							foto: "https://db.sinjaikab.go.id/wisata/storage/photos/mangrove.jpg",
							status: 1
						},
						{
							id: 2,
							nama: "Taman Purbakala Batu Pake Gojeng",
							kategori: "Wisata Sejarah/Budaya",
							deskripsi: "Situs bersejarah dengan pemandangan kota Sinjai dari ketinggian.",
							latitude: -5.1297,
							longitude: 120.2444,
							status: 1
						},
						{
							id: 3,
							nama: "Pulau Sembilan",
							kategori: "Wisata Alam",
							deskripsi: "Gugusan pulau indah dengan potensi wisata bahari yang memukau.",
							latitude: -5.1000,
							longitude: 120.3000,
							status: 1
						}
					];
				}
				return data;
			} catch (err) {
				console.error("Failed to fetch locations:", err);
				return [];
			}
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

	const handleCheckIn = (lokasiId: number, lat: number, lng: number) => {
		if (!isAuthenticated || !user) {
			alert("⚠️ Silakan login dengan Google terlebih dahulu!");
			return;
		}

		if (!currentCoords) {
			alert("⚠️ Menunggu data GPS... Pastikan GPS aktif.");
			getGeolocation();
			return;
		}

		const distance = calculateDistance(currentCoords.lat, currentCoords.lng, lat, lng) * 1000; // in meters
		const MAX_CHECKIN_DISTANCE = 20; // 20 meters

		if (distance > MAX_CHECKIN_DISTANCE) {
			alert(`⚠️ Anda terlalu jauh dari lokasi (${distance.toFixed(0)}m). Harap mendekat hingga < ${MAX_CHECKIN_DISTANCE}m untuk check-in.`);
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
			fotoUser: checkInForm.foto, // Match Prisma: foto -> fotoUser
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
							<DynamicMap onCheckIn={(id, lat, lng) => handleCheckIn(id, lat, lng)} />
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
											onClick={() => handleCheckIn(lokasi.id, lokasi.latitude, lokasi.longitude)}
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
																	onClick={() => setActiveTab("browse")}
																	className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg text-sm"
																>
																	Tambah Lokasi Sekarang
																</button>
															</div>
														)}
													</div>
												);
											case "browse":
												// Logic to filter data
												const filteredBySearch = lokasiData?.filter(loc => 
													loc.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
													loc.deskripsi.toLowerCase().includes(searchQuery.toLowerCase())
												);
								
												const filteredByCat = selectedCategory 
													? filteredBySearch?.filter(loc => loc.kategori === selectedCategory)
													: filteredBySearch;
								
												if (viewingLokasi) {
													return (
														<div className="space-y-6 pb-32 animate-in fade-in duration-300">
															<button 
																onClick={() => setViewingLokasi(null)}
																className="flex items-center gap-2 text-gray-500 font-bold mb-4"
															>
																<X size={20} /> Kembali ke Daftar
															</button>
								
															<div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
																<div className="relative h-64 md:h-80 w-full bg-gray-200">
																	{viewingLokasi.foto ? (
																		<img src={viewingLokasi.foto} alt={viewingLokasi.nama} className="w-full h-full object-cover" />
																	) : (
																		<div className="flex flex-col items-center justify-center h-full text-gray-400">
																			<MapPin size={48} className="mb-2" />
																			<span className="text-sm">Belum ada foto</span>
																		</div>
																	)}
																										<div className="absolute top-4 left-4">
																											<span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
																												{viewingLokasi.kategori}
																											</span>
																										</div>
																										{isAdmin && (
																											<div className="absolute top-4 right-4 flex gap-2">
																												<button 
																													onClick={() => {
																														setEditingLocation(viewingLokasi);
																														setIsModalOpen(true);
																													}}
																													className="bg-white/90 p-2 rounded-full text-blue-600 shadow-md hover:bg-white transition-all"
																													title="Edit Lokasi"
																												>
																													<Edit size={18} />
																												</button>
																												<button 
																													onClick={() => {
																														if(confirm("Yakin ingin menghapus lokasi ini?")) {
																															adminActionMutation.mutate({ id: viewingLokasi.id, method: "DELETE" });
																															setViewingLokasi(null);
																														}
																													}}
																													className="bg-white/90 p-2 rounded-full text-red-600 shadow-md hover:bg-white transition-all"
																													title="Hapus Lokasi"
																												>
																													<Trash size={18} />
																												</button>
																											</div>
																										)}
																									</div>
																									
																									<div className="p-6">
																	
																	<h2 className="text-2xl font-bold text-gray-900 mb-2">{viewingLokasi.nama}</h2>
																										<div className="flex items-center gap-1 text-blue-600 mb-4">
																											<MapPin size={16} />
																											<span className="text-xs font-mono mr-2">
																												{viewingLokasi.latitude.toFixed(4)}, {viewingLokasi.longitude.toFixed(4)}
																											</span>
																											{currentCoords && (
																												<span className="text-xs font-bold bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1">
																													<Navigation size={12} />
																													{formatDistance(calculateDistance(currentCoords.lat, currentCoords.lng, viewingLokasi.latitude, viewingLokasi.longitude))}
																												</span>
																											)}
																										</div>
																										<a 
																											href={`https://www.google.com/maps/dir/?api=1&destination=${viewingLokasi.latitude},${viewingLokasi.longitude}`}
																											target="_blank"
																											rel="noopener noreferrer"
																											className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 underline mb-4"
																										>
																											<Navigation size={14} /> Petunjuk Arah (Google Maps)
																										</a>
																										<p className="text-gray-600 text-sm leading-relaxed mb-8">
																	
																		{viewingLokasi.deskripsi}
																	</p>
								
																	<div className="border-t pt-6">
																		<h3 className="font-bold text-gray-900 mb-4">Cekin Terkini</h3>
																		<div className="space-y-3">
																			{/* Placeholder for real check-in history of this specific location */}
																			<div className="bg-gray-50 p-4 rounded-2xl flex items-center gap-3">
																				<div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
																					<User size={20} />
																				</div>
																				<div className="flex-1">
																					<div className="flex items-center justify-between">
																						<span className="text-xs font-bold text-gray-800">Traveler Anonim</span>
																						<span className="text-[10px] text-gray-400">Baru saja</span>
																					</div>
																					<p className="text-[10px] text-gray-500 mt-0.5">"Tempatnya sangat asri dan sejuk!"</p>
																				</div>
																			</div>
																			<p className="text-center text-[10px] text-gray-400 italic py-4">Belum ada histori cekin lainnya.</p>
																		</div>
																	</div>
								
																										<button 
																											onClick={() => {
																												setViewingLokasi(null);
																												handleCheckIn(viewingLokasi.id, viewingLokasi.latitude, viewingLokasi.longitude);
																											}}
																											className="w-full mt-6 bg-blue-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-blue-100 active:scale-95 transition-all flex items-center justify-center gap-2"
																										>
																	
																		<CheckCircle size={20} />
																		Cekin di Sini
																	</button>
																</div>
															</div>
														</div>
													);
												}
								
												return (
													<div className="space-y-6 pb-32 animate-in fade-in duration-300">
														<div className="flex flex-col gap-4">
															<div className="flex items-center justify-between">
																<h2 className="text-2xl font-bold text-gray-900">Jelajahi Lokasi</h2>
																<button 
																	onClick={() => setIsModalOpen(true)}
																	className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg active:scale-90 transition-all"
																	title="Tambah Lokasi Baru"
																>
																	<Plus size={24} />
																</button>
															</div>
								
															<div className="relative">
																<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
																<input 
																	type="text"
																	placeholder="Cari tempat wisata, kafe, atau hotel..."
																	className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
																	value={searchQuery}
																	onChange={(e) => setSearchQuery(e.target.value)}
																/>
															</div>
														</div>
								
														{/* Categories List */}
														<div className="space-y-4">
															<div className="flex items-center justify-between px-2">
																<h3 className="font-bold text-gray-800">Kategori</h3>
																{selectedCategory && (
																	<button 
																		onClick={() => setSelectedCategory(null)}
																		className="text-[10px] font-bold text-red-500 uppercase"
																	>
																		Reset
																	</button>
																)}
															</div>
															<div className="grid grid-cols-2 gap-3">
																{categories?.map((cat) => (
																	<button
																		key={cat}
																		onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
																		className={`p-4 rounded-2xl border text-left transition-all ${
																			selectedCategory === cat 
																				? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-100" 
																				: "bg-white border-gray-100 text-gray-700 hover:border-blue-200"
																		}`}
																	>
																		<div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${
																			selectedCategory === cat ? "bg-white/20" : "bg-blue-50 text-blue-600"
																		}`}>
																			<Package size={18} />
																		</div>
																		<span className="text-xs font-bold leading-tight block">{cat}</span>
																	</button>
																))}
															</div>
														</div>
								
														{/* Results based on search or category */}
														{(searchQuery || selectedCategory) && (
															<div className="space-y-4 animate-in slide-in-from-bottom duration-300">
																<h3 className="font-bold text-gray-800 px-2">Hasil Pencarian</h3>
																<div className="grid grid-cols-1 gap-3">
																	{filteredByCat && filteredByCat.length > 0 ? (
																		filteredByCat.map(lokasi => (
																			<div 
																				key={lokasi.id} 
																				onClick={() => setViewingLokasi(lokasi)}
																				className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-blue-200"
																			>
																				<div className="h-16 w-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
																					{lokasi.foto ? (
																						<img src={lokasi.foto} alt={lokasi.nama} className="w-full h-full object-cover" />
																					) : (
																						<div className="w-full h-full flex items-center justify-center text-gray-300">
																							<MapPin size={24} />
																						</div>
																					)}
																				</div>
																				<div className="flex-1">
																					<h4 className="font-bold text-gray-900 leading-tight">{lokasi.nama}</h4>
																					<p className="text-[10px] text-gray-400 mt-1 line-clamp-1">{lokasi.deskripsi}</p>
																					<div className="flex items-center gap-2 mt-2">
																						<span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
																							{lokasi.kategori}
																						</span>
																					</div>
																				</div>
																			</div>
																		))
																	) : (
																		<div className="text-center py-12 text-gray-400 italic text-sm">Tidak ada lokasi yang cocok.</div>
																	)}
																</div>
															</div>
														)}
													</div>
												);
								
			case "profile":
				const mySubmissions = lokasiData?.filter(loc => loc.suiAddress === user?.suiAddress);
				const pendingSubmissions = lokasiData?.filter(loc => loc.status === 0 || loc.status === "pending");

				return (
					<div className="space-y-6 pb-32 animate-in slide-in-from-left duration-300">
						<div className="flex flex-col items-center pt-4">
							<div className="relative mb-4">
								<div className="h-24 w-24 rounded-full border-4 border-white shadow-xl overflow-hidden">
									<img src={user?.picture} alt={user?.name} className="h-full w-full object-cover" />
								</div>
								{isAdmin && (
									<div className="absolute bottom-0 right-0 bg-red-600 text-white p-1.5 rounded-full shadow-lg" title="Admin">
										<ShieldCheck size={16} />
									</div>
								)}
							</div>
							<h2 className="text-2xl font-bold text-gray-900">{user?.name}</h2>
							<p className="text-gray-400 text-sm mb-6">{user?.email}</p>
						</div>

						{/* Settings Section */}
						<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
							<div className="flex items-center gap-2 mb-4 text-gray-800">
								<Settings size={20} />
								<h3 className="font-bold">{t.settings}</h3>
							</div>
							<div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
								<div className="flex items-center gap-3">
									<Globe size={18} className="text-gray-400" />
									<span className="text-sm font-medium">{t.language}</span>
								</div>
								<div className="flex gap-1 bg-white p-1 rounded-xl shadow-sm">
									<button 
										onClick={() => changeLanguage("id")}
										className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${lang === "id" ? "bg-blue-600 text-white" : "text-gray-400"}`}
									>
										ID
									</button>
									<button 
										onClick={() => changeLanguage("en")}
										className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${lang === "en" ? "bg-blue-600 text-white" : "text-gray-400"}`}
									>
										EN
									</button>
								</div>
							</div>
						</div>

						{/* Admin Panel */}
						{isAdmin && (
							<div className="bg-red-50 p-6 rounded-3xl border border-red-100">
								<div className="flex items-center justify-between mb-4">
									<div className="flex items-center gap-2 text-red-800">
										<ShieldCheck size={20} />
										<h3 className="font-bold">{t.admin_panel}</h3>
									</div>
									<span className="bg-red-200 text-red-800 text-[10px] font-bold px-2 py-1 rounded-full">
										{pendingSubmissions?.length || 0} Pending
									</span>
								</div>
								
								<div className="space-y-3">
									{pendingSubmissions && pendingSubmissions.length > 0 ? (
										pendingSubmissions.map(loc => (
											<div key={loc.id} className="bg-white p-3 rounded-2xl shadow-sm border border-red-100 flex items-center justify-between">
												<div className="flex items-center gap-3">
													<div className="h-10 w-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
														{loc.foto && <img src={loc.foto} className="w-full h-full object-cover" />}
													</div>
													<div>
														<h4 className="text-xs font-bold text-gray-800">{loc.nama}</h4>
														<p className="text-[10px] text-gray-400">{loc.kategori}</p>
													</div>
												</div>
												<div className="flex gap-1">
													<button 
														onClick={() => adminActionMutation.mutate({ id: loc.id, status: 1, method: "PATCH" })}
														className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
														title={t.approve}
													>
														<Check size={18} />
													</button>
													<button 
														onClick={() => adminActionMutation.mutate({ id: loc.id, method: "DELETE" })}
														className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
														title={t.delete}
													>
														<Trash2 size={18} />
													</button>
												</div>
											</div>
										))
									) : (
										<p className="text-center text-[10px] text-gray-400 italic py-2">{t.admin_no_pending}</p>
									)}
								</div>
							</div>
						)}

						{/* User Submissions */}
						<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
							<h3 className="font-bold mb-4 text-gray-800">{t.my_submissions}</h3>
							<div className="space-y-3">
								{mySubmissions && mySubmissions.length > 0 ? (
									mySubmissions.map(loc => (
										<div key={loc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
											<div className="flex items-center gap-3">
												<div className="h-10 w-10 bg-white rounded-xl overflow-hidden shadow-sm">
													{loc.foto && <img src={loc.foto} className="w-full h-full object-cover" />}
												</div>
												<div>
													<h4 className="text-xs font-bold text-gray-800">{loc.nama}</h4>
													<span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest ${
														loc.status === 1 || loc.status === "approved" ? "bg-green-100 text-green-700" :
														loc.status === 2 || loc.status === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"
													}`}>
														{loc.status === 1 || loc.status === "approved" ? t.status_approved :
														 loc.status === 2 || loc.status === "rejected" ? t.status_rejected : t.status_pending}
													</span>
												</div>
											</div>
										</div>
									))
								) : (
									<p className="text-center text-[10px] text-gray-400 italic py-4">{t.no_submissions}</p>
								)}
							</div>
						</div>

						{/* Asset Stats (Placeholder) */}
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
								<button className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wider">Top Up</button>
								<button 
									onClick={logout}
									className="flex-1 bg-red-600 hover:bg-red-700 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wider"
								>
									{t.logout}
								</button>
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
			<AddLocationModal 
				isOpen={isModalOpen} 
				onClose={() => {
					setIsModalOpen(false);
					setEditingLocation(null);
				}} 
				initialData={editingLocation}
			/>

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
