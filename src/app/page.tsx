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
import { Settings, Globe, Trash2, Check, XCircle, AlertTriangle, ShieldCheck, Edit, Trash, Trophy, Heart, MessageCircle, Share2, Send } from "lucide-react";
import LocationImage from "@/components/LocationImage";
import DescriptionWithLinks from "@/components/DescriptionWithLinks";
import LeaderboardModal from "@/components/LeaderboardModal";
import SendReceiveModal from "@/components/SendReceiveModal";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";

export default function Home() {
	const { user, isAuthenticated, logout } = useGoogleUser();
	const { isAdmin } = useAdmin();
	const { data: categories } = useCategories();
	const [activeTab, setActiveTab] = useState("home");
	const [lang, setLang] = useState<Language>("id");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
	const [sendReceiveMode, setSendReceiveMode] = useState<"send" | "receive" | null>(null);
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
	const [commentText, setCommentText] = useState("");

	const likeMutation = useMutation({
		mutationFn: async ({ id, type }: { id: number, type: 'lokasi' | 'checkin' }) => {
			if (!user) throw new Error("Login required");
			const url = type === 'lokasi' ? API_ENDPOINTS.LOKASI_LIKE(id) : API_ENDPOINTS.CHECKIN_LIKE(id);
			const res = await fetch(url, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ suiAddress: user.suiAddress }),
			});
			if (!res.ok) throw new Error("Gagal memproses like");
			return res.json();
		},
		onSuccess: (_, variables) => {
			if (variables.type === 'lokasi') {
				queryClient.invalidateQueries({ queryKey: ["lokasiDetail", variables.id] });
			} else {
				queryClient.invalidateQueries({ queryKey: ["lokasiDetail"] });
			}
		}
	});

	const commentMutation = useMutation({
		mutationFn: async ({ id, text }: { id: number, text: string }) => {
			if (!user) throw new Error("Login required");
			const res = await fetch(API_ENDPOINTS.LOKASI_COMMENT(id), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ suiAddress: user.suiAddress, text }),
			});
			if (!res.ok) throw new Error("Gagal mengirim komentar");
			return res.json();
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["lokasiDetail", variables.id] });
			setCommentText("");
		}
	});

	const { data: userHistory } = useQuery({
		queryKey: ["history", user?.suiAddress],
		queryFn: async () => {
			if (!user?.suiAddress) return null;
			const res = await fetch(API_ENDPOINTS.USER_HISTORY(user.suiAddress));
			if (!res.ok) return null;
			return res.json();
		},
		enabled: !!user?.suiAddress,
	});

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

	const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null);

	const { data: detailLokasi, isLoading: isLoadingDetail } = useQuery({
		queryKey: ["lokasiDetail", viewingLokasi?.id],
		queryFn: async () => {
			if (!viewingLokasi?.id) return null;
			const res = await fetch(API_ENDPOINTS.LOKASI_DETAIL(viewingLokasi.id));
			if (!res.ok) return null;
			const data = await res.json();
			console.log("Detail Lokasi Fetched:", data);
			return data;
		},
		enabled: !!viewingLokasi?.id,
	});
	
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
				
				// Map backend data to frontend model
				const mappedData = data.map((item: any) => {
					// Robust status mapping:
					// 1. If isVerified is explicitly true, status is 1 (Approved).
					// 2. Else if status is present and valid number, use it.
					// 3. Default to 0 (Pending).
					let status = 0;
					if (item.isVerified === true) {
						status = 1;
					} else if (typeof item.status === 'number') {
						status = item.status;
					}

					const mapped = {
						...item,
						foto: item.fotoUtama || item.foto,
						status: status
					};
					// Log items with photos to debug
					if (mapped.foto) console.log(`Mapped Photo for ID ${item.id}:`, mapped.foto);
					return mapped;
				});

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
				return mappedData;
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
		onSuccess: (_, variables) => {
			alert(`✅ Check-In Berhasil! Lokasi terverifikasi.`);
			queryClient.invalidateQueries({ queryKey: ["history"] });
			queryClient.invalidateQueries({ queryKey: ["lokasiDetail", variables.lokasiId] });
			setActiveTab("history");
		},
		onError: (error) => {
			alert(`Gagal Check-In: ${error.message}`);
			console.error("Check-In Error:", error);
		}
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
					<div className="animate-in fade-in duration-500 w-full h-[calc(100vh-64px)] absolute top-[64px] left-0 right-0 bottom-0 z-0">
						<DynamicMap onCheckIn={(id, lat, lng) => handleCheckIn(id, lat, lng)} />
					</div>
				);
			case "history":
				if (!isAuthenticated) {
					return (
						<div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6 animate-in fade-in">
							<div className="bg-gray-100 p-6 rounded-full mb-6">
								<User size={48} className="text-gray-400" />
							</div>
							<h2 className="text-xl font-bold text-gray-900 mb-2">Login Diperlukan</h2>
							<p className="text-sm text-gray-500 mb-6">Silakan login untuk melihat histori penjelajahan Anda.</p>
						</div>
					);
				}

				const mySubmissionsHistory = lokasiData?.filter(loc => loc.suiAddress === user?.suiAddress);

				return (
					<div className="space-y-6 pb-32 animate-in slide-in-from-right duration-300">
						<h2 className="text-2xl font-bold text-gray-900">Histori Aktivitas</h2>
						
						{/* User Submissions Status */}
						<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
							<h3 className="font-bold mb-4 text-gray-800">Status Usulan Lokasi</h3>
							<div className="space-y-3">
								{mySubmissionsHistory && mySubmissionsHistory.length > 0 ? (
									mySubmissionsHistory.map(loc => (
										<div key={loc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
											<div className="flex items-center gap-3">
												<div className="h-10 w-10 bg-white rounded-xl overflow-hidden shadow-sm flex-shrink-0">
													{loc.foto || (loc as any).fotoUtama ? (
														<img src={loc.foto || (loc as any).fotoUtama} className="w-full h-full object-cover" />
													) : (
														<div className="w-full h-full flex items-center justify-center text-gray-300"><MapPin size={16}/></div>
													)}
												</div>
												<div>
													<h4 className="text-xs font-bold text-gray-800 line-clamp-1">{loc.nama}</h4>
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

						<h3 className="font-bold text-gray-800 mt-6 mb-4">Riwayat Cekin</h3>
						<div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y">
							{userHistory?.checkIns && userHistory.checkIns.length > 0 ? (
								userHistory.checkIns.map((checkin: any) => (
									<div key={checkin.id} className="p-4 flex items-start gap-4">
										<div className="bg-blue-50 p-2 rounded-xl text-blue-600 shrink-0">
											<MapPin size={20} />
										</div>
										<div className="flex-1">
											<h4 className="font-bold text-sm text-gray-900">{checkin.lokasi.nama}</h4>
											<p className="text-[10px] text-gray-400 mb-2">
												{new Date(checkin.waktu).toLocaleDateString('id-ID', { 
													weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
												})}
											</p>
											{checkin.komentar && (
												<div className="bg-gray-50 p-2 rounded-lg text-xs text-gray-600 italic">
													"{checkin.komentar}"
												</div>
											)}
											{checkin.fotoUser && (
												<div className="mt-2 h-20 w-20 rounded-lg overflow-hidden border border-gray-200">
													<img src={checkin.fotoUser} className="w-full h-full object-cover" />
												</div>
											)}
										</div>
									</div>
								))
							) : (
								<div className="p-8 text-center text-gray-400 italic text-sm">Belum ada riwayat cekin.</div>
							)}
						</div>
					</div>
				);
			case "checkin":
				const nearestLocations = lokasiData 
					? [...lokasiData]
						.filter(loc => loc.status === 1 || loc.status === "approved") // Only show approved locations
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
											onClick={() => setActiveTab("browse")}
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
													(loc.nama.toLowerCase().includes(searchQuery.toLowerCase()) || 
													loc.deskripsi.toLowerCase().includes(searchQuery.toLowerCase())) &&
													// Only show approved locations (status 1) to public
													// Admins see all, Users see approved + their own pending
													(isAdmin || loc.status === 1 || loc.status === "approved" || loc.suiAddress === user?.suiAddress)
												);
								
																								const filteredByCat = selectedCategory 
																									? filteredBySearch?.filter(loc => loc.kategori?.toLowerCase() === selectedCategory.toLowerCase())
																									: filteredBySearch;
																				
																								if (viewingLokasi) {
												
																									// Debug log to check data integrity
																									console.log("Viewing Lokasi Data:", viewingLokasi);
																									const displayPhoto = viewingLokasi.foto || (viewingLokasi as any).fotoUtama;
												
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
																													{displayPhoto ? (
																														<img 
																															src={displayPhoto} 
																															alt={viewingLokasi.nama} 
																															className="w-full h-full object-cover"
																															onError={(e) => {
																																e.currentTarget.src = "https://via.placeholder.com/400x300?text=No+Image";
																																e.currentTarget.onerror = null; // Prevent infinite loop
																															}}
																														/>
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
																																			<DescriptionWithLinks 
																																				text={viewingLokasi.deskripsi} 
																																				className="text-gray-600 text-sm leading-relaxed mb-6 whitespace-pre-line"
																																			/>

																																			{/* Social Interaction Bar */}
																																			<div className="flex items-center gap-6 py-4 border-y border-gray-50 mb-6">
																																				<button 
																																					onClick={() => likeMutation.mutate({ id: viewingLokasi.id, type: 'lokasi' })}
																																					className={`flex items-center gap-1.5 text-sm font-bold transition-all ${
																																						detailLokasi?.likes?.some((l: any) => l.user?.suiAddress === user?.suiAddress)
																																							? "text-red-500 scale-110" : "text-gray-400 hover:text-red-500"
																																					}`}
																																				>
																																					<Heart size={20} fill={detailLokasi?.likes?.some((l: any) => l.user?.suiAddress === user?.suiAddress) ? "currentColor" : "none"} />
																																					<span>{detailLokasi?._count?.likes || 0}</span>
																																				</button>
																																				<div className="flex items-center gap-1.5 text-sm font-bold text-gray-400">
																																					<MessageCircle size={20} />
																																					<span>{detailLokasi?._count?.comments || 0}</span>
																																				</div>
																																				<button 
																																					onClick={() => {
																																						navigator.clipboard.writeText(window.location.href);
																																						alert("Link lokasi telah tersalin!");
																																					}}
																																					className="flex items-center gap-1.5 text-sm font-bold text-gray-400 hover:text-blue-600 transition-all"
																																				>
																																					<Share2 size={20} />
																																					<span>Share</span>
																																				</button>
																																			</div>

																																			{/* Comments/Questions Section */}
																																			<div className="space-y-4 mb-8">
																																				<h3 className="font-bold text-gray-900 flex items-center gap-2">
																																					<MessageCircle size={18} className="text-blue-600" /> Diskusi & Pertanyaan
																																				</h3>
																																				
																																				{/* Comment Input */}
																																				{isAuthenticated ? (
																																					<div className="flex gap-2">
																																						<input 
																																							type="text"
																																							placeholder="Tulis komentar atau pertanyaan..."
																																							className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
																																							value={commentText}
																																							onChange={(e) => setCommentText(e.target.value)}
																																							onKeyDown={(e) => e.key === 'Enter' && commentText.trim() && commentMutation.mutate({ id: viewingLokasi.id, text: commentText })}
																																						/>
																																						<button 
																																							disabled={!commentText.trim() || commentMutation.isPending}
																																							onClick={() => commentMutation.mutate({ id: viewingLokasi.id, text: commentText })}
																																							className="bg-blue-600 text-white p-3 rounded-xl disabled:bg-gray-300 shadow-lg shadow-blue-100"
																																						>
																																							<Send size={18} />
																																						</button>
																																					</div>
																																				) : (
																																					<p className="text-[10px] text-gray-400 bg-gray-50 p-3 rounded-xl border border-dashed text-center">Login untuk ikut berdiskusi</p>
																																				)}

																																				{/* Comments List */}
																																				<div className="space-y-3">
																																					{detailLokasi?.comments && detailLokasi.comments.length > 0 ? (
																																						detailLokasi.comments.map((cm: any) => (
																																							<div key={cm.id} className="flex flex-col bg-white p-3 rounded-2xl border border-gray-50 shadow-sm">
																																								<div className="flex justify-between items-center mb-1">
																																									<span className="text-[11px] font-bold text-gray-800">{cm.user?.nama || "Traveler"}</span>
																																									<span className="text-[9px] text-gray-400">{new Date(cm.waktu).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
																																								</div>
																																								<p className="text-xs text-gray-600 leading-snug">{cm.text}</p>
																																							</div>
																																						))
																																					) : (
																																						<p className="text-center text-[10px] text-gray-400 italic py-2">Belum ada diskusi di sini.</p>
																																					)}
																																				</div>
																																			</div>
																										
																																												<div className="border-t pt-6">
																																													<h3 className="font-bold text-gray-900 mb-4">Cekin Terkini</h3>
																																													<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
																																														{isLoadingDetail ? (
																																															<div className="flex justify-center p-4 col-span-full"><Loader2 className="animate-spin text-blue-600" /></div>
																																														) : detailLokasi?.checkIns ? (
																																															detailLokasi.checkIns.length > 0 ? (
																																																detailLokasi.checkIns.map((ci: any) => (
																																																	<div key={ci.id} className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex flex-col gap-2">
																																																		<div className="flex items-center gap-2">
																																																			<div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 overflow-hidden">
																																																				<User size={16} />
																																																			</div>
																																																			<div className="flex-1 min-w-0">
																																																				<div className="flex items-center justify-between">
																																																					<span className="text-xs font-bold text-gray-800 truncate">{ci.user?.nama || "Traveler"}</span>
																																																					<button 
																																																						onClick={(e) => {
																																																							e.stopPropagation();
																																																							likeMutation.mutate({ id: ci.id, type: 'checkin' });
																																																						}}
																																																						className={`flex items-center gap-0.5 text-[10px] font-bold ${
																																																							ci.likes?.some((l: any) => l.user?.suiAddress === user?.suiAddress)
																																																								? "text-red-500" : "text-gray-400"
																																																						}`}
																																																					>
																																																						<Heart size={12} fill={ci.likes?.some((l: any) => l.user?.suiAddress === user?.suiAddress) ? "currentColor" : "none"} />
																																																						{ci._count?.likes || 0}
																																																					</button>
																																																				</div>
																																																				<span className="text-[9px] text-gray-400">
																																																					{new Date(ci.waktu).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
																																																				</span>
																																																			</div>
																																																		</div>
																																																		
																																																		{ci.komentar && <p className="text-[11px] text-gray-600 italic leading-snug">"{ci.komentar}"</p>}
																																																		
																																																																	{ci.fotoUser && (
																																																																		<div 
																																																																			onClick={() => setViewPhotoUrl(ci.fotoUser)}
																																																																			className="mt-1 w-full h-24 rounded-xl overflow-hidden cursor-pointer border border-gray-200 hover:opacity-90 transition-opacity"
																																																																		>
																																																																			<LocationImage src={ci.fotoUser} alt="Bukti Cekin" className="w-full h-full object-cover" />
																																																																		</div>
																																																																	)}
																																																		
																																																	</div>
																																																))
																																															) : (
																																																<p className="text-center text-[10px] text-gray-400 italic py-4 col-span-full">Belum ada aktivitas cekin publik.</p>
																																															)
																																														) : (
																																															<div className="text-center py-4 text-xs text-gray-400 bg-gray-50 rounded-xl col-span-full">
																																																<p>Belum ada aktivitas cekin publik.</p>
																																															</div>
																																														)}
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
														{/* Search and Category Filter */}
						<div className="flex flex-col gap-4 sticky top-0 bg-slate-50 z-10 py-2">
							<div className="flex items-center justify-between">
								<h2 className="text-2xl font-bold text-gray-900">Jelajahi Lokasi</h2>
								<button 
									onClick={() => {
										if (!isAuthenticated) {
											alert("Silakan login terlebih dahulu untuk menambahkan lokasi.");
											return;
										}
										setIsModalOpen(true);
									}}
									className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg active:scale-90 transition-all"
									title="Tambah Lokasi Baru"
								>
									<Plus size={24} />
								</button>
							</div>

							<div className="flex gap-2">
								<div className="relative flex-1">
									<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
									<input 
										type="text"
										placeholder="Cari nama tempat..."
										className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
									/>
								</div>
							</div>

							{/* Horizontal Category Chips */}
							<div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
								<button
									onClick={() => setSelectedCategory(null)}
									className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border ${
										!selectedCategory 
											? "bg-blue-600 text-white border-blue-600 shadow-md" 
											: "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
									}`}
								>
									Semua
								</button>
								{categories?.map((cat) => (
									<button
										key={cat}
										onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
										className={`flex-shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all border ${
											selectedCategory === cat
												? "bg-blue-600 text-white border-blue-600 shadow-md"
												: "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
										}`}
									>
										{cat}
									</button>
								))}
							</div>
						</div>

						{/* Results List */}
						<div className="space-y-4 animate-in slide-in-from-bottom duration-300">
							<div className="grid grid-cols-1 gap-3">
								{(filteredByCat && filteredByCat.length > 0) ? (
									filteredByCat.map(lokasi => (
										<div 
											key={lokasi.id} 
											onClick={() => setViewingLokasi(lokasi)}
											className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-blue-200"
										>
											<div className="h-16 w-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
												<LocationImage src={lokasi.foto} alt={lokasi.nama} className="w-full h-full object-cover" />
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
					</div>
				);
								
			case "profile":
				if (!isAuthenticated) {
					return (
						<div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6 animate-in fade-in pb-32">
							<div className="bg-blue-50 p-8 rounded-full mb-6 shadow-sm">
								<User size={64} className="text-blue-400" />
							</div>
							<h2 className="text-2xl font-bold text-gray-900 mb-2">Profil Pengguna</h2>
							<p className="text-gray-500 mb-8 max-w-xs mx-auto">Login untuk mengelola profil, melihat poin, dan riwayat perjalanan Anda.</p>
							
							<div className="w-full max-w-sm bg-white p-6 rounded-3xl shadow-lg border border-gray-100">
								<div className="flex items-center justify-between mb-4">
									<div className="flex items-center gap-2 text-gray-700">
										<Settings size={20} />
										<span className="font-bold">{t.settings}</span>
									</div>
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
						</div>
					);
				}

				const pendingSubmissions = lokasiData?.filter(loc => loc.status === 0 || loc.status === "pending");
				
				// Calculate Stats
				const myApprovedLocs = lokasiData?.filter(loc => loc.suiAddress === user?.suiAddress && (loc.status === 1 || loc.status === "approved")) || [];
				const myCheckinsCount = userHistory?.checkIns?.length || 0;
				const myPoints = myCheckinsCount + (myApprovedLocs.length * 5);
				
				// Calculate Badges
				let myBadgesCount = 0;
				if (myCheckinsCount >= 1) myBadgesCount++; // Novice
				if (myCheckinsCount >= 5) myBadgesCount++; // Explorer
				if (myApprovedLocs.length >= 1) myBadgesCount++; // Contributor
				if (myApprovedLocs.length >= 5) myBadgesCount++; // Pioneer

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

						{/* Asset Stats (Calculated) */}
						<div className="grid grid-cols-2 gap-4">
							<div className="bg-white p-4 rounded-3xl shadow-sm border text-center">
								<Award className="text-yellow-500 mx-auto mb-2" />
								<span className="block text-xl font-bold">{myPoints}</span>
								<span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Poin Travel</span>
							</div>
							<div className="bg-white p-4 rounded-3xl shadow-sm border text-center">
								<Package className="text-blue-500 mx-auto mb-2" />
								<span className="block text-xl font-bold">{myBadgesCount}</span>
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
							<div className="flex gap-2 mb-3">
								<button 
									onClick={() => setSendReceiveMode("receive")}
									className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-2"
								>
									<ArrowDownLeft size={16} /> Terima
								</button>
								<button 
									onClick={() => setSendReceiveMode("send")}
									className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-2"
								>
									<ArrowUpRight size={16} /> Kirim
								</button>
							</div>
							<div className="flex gap-2">
								<button 
									onClick={() => setIsLeaderboardOpen(true)}
									className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-2"
								>
									<Trophy size={16} /> Leaderboard
								</button>
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
		<main className="min-h-screen bg-slate-50 flex flex-col relative overflow-hidden">
			<Navbar />

			<div className={`flex-1 container mx-auto ${activeTab === 'home' ? 'p-0 max-w-none' : 'px-4 py-8'}`}>
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
			
			<LeaderboardModal 
				isOpen={isLeaderboardOpen} 
				onClose={() => setIsLeaderboardOpen(false)} 
			/>

			<SendReceiveModal 
				isOpen={!!sendReceiveMode} 
				onClose={() => setSendReceiveMode(null)} 
				mode={sendReceiveMode || "receive"}
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

			{/* Full Screen Photo Viewer */}
			{viewPhotoUrl && (
				<div 
					className="fixed inset-0 z-[7000] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
					onClick={() => setViewPhotoUrl(null)}
				>
					<div className="relative max-w-full max-h-full">
						<img src={viewPhotoUrl} alt="Preview Full" className="max-w-full max-h-[90vh] object-contain rounded-xl" />
						<button 
							onClick={() => setViewPhotoUrl(null)}
							className="absolute -top-12 right-0 text-white p-2 hover:bg-white/20 rounded-full"
						>
							<X size={24} />
						</button>
					</div>
				</div>
			)}
		</main>
	);
}
