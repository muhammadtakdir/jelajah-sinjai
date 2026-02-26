"use client";

import React, { useState, useEffect, useRef } from "react";
import Navbar from "@/components/Navbar";
import DynamicMap from "@/components/DynamicMap";
import AddLocationModal from "@/components/AddLocationModal";
import BottomNav from "@/components/BottomNav";
import { useGoogleUser } from "@/hooks/useGoogleUser";
import { useAdmin } from "@/hooks/useAdmin";
import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { CheckInPayload, Lokasi } from "@/lib/types";
import { API_ENDPOINTS } from "@/lib/api";
import { Loader2, Navigation, CheckCircle, Package, User, Wallet, Award, Clock, MapPin, Plus, Camera, X, Search, EyeOff, Eye, CornerDownRight, Megaphone, UserCheck, ShieldAlert, Image as ImageIcon } from "lucide-react";
import { calculateDistance, formatDistance } from "@/lib/geoUtils";
import { useCategories } from "@/hooks/useCategories";
import { useLanguage } from "@/lib/LanguageContext";
import { Settings, Globe, Trash2, Check, XCircle, AlertTriangle, ShieldCheck, Edit, Trash, Trophy, Heart, MessageCircle, Share2, Send } from "lucide-react";
import LocationImage from "@/components/LocationImage";
import DescriptionWithLinks from "@/components/DescriptionWithLinks";
import LeaderboardModal from "@/components/LeaderboardModal";
import SendReceiveModal from "@/components/SendReceiveModal";
import { ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { validateContent } from "@/lib/moderation";

export default function Home() {
	const { user, isAuthenticated, logout } = useGoogleUser();
	const { isAdmin } = useAdmin();
	const { data: categories } = useCategories();
	const { lang, t, changeLanguage } = useLanguage();
	const [activeTab, setActiveTab] = useState("home");
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
	const [sendReceiveMode, setSendReceiveMode] = useState<"send" | "receive" | null>(null);
	const [editingLocation, setEditingLocation] = useState<Lokasi | null>(null);
	const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
	const [selectedLokasiId, setSelectedLokasiId] = useState<number | null>(null);
	const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
	
	const [commentText, setCommentText] = useState("");
	const [replyTo, setReplyTo] = useState<{ id: number, name: string } | null>(null);
	const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null);

	const queryClient = useQueryClient();

	const claimMutation = useMutation({
		mutationFn: async (id: number) => {
			if (!user) throw new Error("Login required");
			const res = await fetch(API_ENDPOINTS.LOKASI_CLAIM(id), {
				method: "POST",
				headers: { 
					"Content-Type": "application/json",
					"Authorization": `Bearer ${user?.jwt}`
				},
				body: JSON.stringify({ suiAddress: user.suiAddress }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || t.claim_error);
			return data;
		},
		onSuccess: () => {
			alert(t.claim_success);
			queryClient.invalidateQueries({ queryKey: ["lokasiDetail"] });
		},
		onError: (err: any) => alert(err.message)
	});

	const adminClaimMutation = useMutation({
		mutationFn: async ({ id, status }: { id: number, status: 'approved' | 'rejected' }) => {
			const res = await fetch(API_ENDPOINTS.ADMIN_CLAIM_UPDATE(id), {
				method: "PATCH",
				headers: { 
					"Content-Type": "application/json",
					"Authorization": `Bearer ${user?.jwt}`
				},
				body: JSON.stringify({ 
					status, 
				}),
			});
			if (!res.ok) throw new Error("Gagal memproses klaim");
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["adminClaims"] });
			queryClient.invalidateQueries({ queryKey: ["lokasi"] });
			alert(t.status_klaim_diperbarui);
		}
	});

	const unclaimMutation = useMutation({
		mutationFn: async (id: number) => {
			if (!user) throw new Error("Login required");
			const res = await fetch(API_ENDPOINTS.LOKASI_UNCLAIM(id), {
				method: "POST",
				headers: { 
					"Content-Type": "application/json",
					"Authorization": `Bearer ${user?.jwt}`
				}
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || "Gagal melepas klaim");
			return data;
		},
		onSuccess: () => {
			alert(t.unclaim_success);
			queryClient.invalidateQueries({ queryKey: ["lokasiDetail"] });
			queryClient.invalidateQueries({ queryKey: ["lokasi"] });
		},
		onError: (err: any) => alert(err.message)
	});

	const { data: adminClaims } = useQuery({
		queryKey: ["adminClaims"],
		queryFn: async () => {
			console.log("Fetching admin claims from:", API_ENDPOINTS.ADMIN_CLAIMS);
			const res = await fetch(API_ENDPOINTS.ADMIN_CLAIMS, {
				headers: {
					"Authorization": `Bearer ${user?.jwt}`
				}
			});
			if (!res.ok) {
				const err = await res.json();
				console.error("Fetch Claims Error:", err);
				return [];
			}
			return res.json();
		},
		enabled: isAdmin && !!user?.jwt,
	});

	const likeMutation = useMutation({
		mutationFn: async ({ id, type }: { id: number, type: 'lokasi' | 'checkin' }) => {
			if (!user) throw new Error("Login required");
			const url = type === 'lokasi' ? API_ENDPOINTS.LOKASI_LIKE(id) : API_ENDPOINTS.CHECKIN_LIKE(id);
			const res = await fetch(url, {
				method: "POST",
				headers: { 
					"Content-Type": "application/json",
					"Authorization": `Bearer ${user?.jwt}`
				},
				body: JSON.stringify({ suiAddress: user.suiAddress }),
			});
			if (!res.ok) throw new Error("Error processing like");
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
		mutationFn: async ({ id, text, parentId }: { id: number, text: string, parentId?: number | null }) => {
			if (!user) throw new Error("Login required");

			// 1. Validate Content
			const result = validateContent(text);
			if (!result.valid) throw new Error(result.reason);

			const res = await fetch(API_ENDPOINTS.LOKASI_COMMENT(id), {
				method: "POST",
				headers: { 
					"Content-Type": "application/json",
					"Authorization": `Bearer ${user?.jwt}`
				},
				body: JSON.stringify({ suiAddress: user.suiAddress, text, parentId }),
			});
			if (!res.ok) throw new Error("Error sending comment");
			return res.json();
		},
		onSuccess: (_, variables) => {
			queryClient.invalidateQueries({ queryKey: ["lokasiDetail", variables.id] });
			setCommentText("");
			setReplyTo(null);
		},
		onError: (error) => {
			alert(error.message);
		}
	});

	const moderationMutation = useMutation({
		mutationFn: async ({ id, type, isHidden, method }: { id: number, type: 'comment' | 'checkin', isHidden?: boolean, method: 'PATCH' | 'DELETE' }) => {
			const url = type === 'comment' ? API_ENDPOINTS.COMMENT_HIDE(id) : API_ENDPOINTS.CHECKIN_HIDE(id);
			const res = await fetch(url, {
				method: method,
				headers: { 
					"Content-Type": "application/json",
					"Authorization": `Bearer ${user?.jwt}`
				},
				body: JSON.stringify({ 
					isHidden, 
					adminAddress: user?.suiAddress 
				}),
			});
			if (!res.ok) throw new Error(t.gagal_moderasi);
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lokasiDetail"] });
			alert(t.konten_dimoderasi);
		}
	});

	const { data: userHistory, refetch: refetchHistory } = useQuery({
		queryKey: ["history", user?.sub, isAuthenticated, user?.jwt],
		queryFn: async () => {
			if (!isAuthenticated || !user?.jwt) {
				console.warn("[DEBUG] History fetch skipped: No JWT or Not Authenticated");
				return null;
			}
			const addressParam = user?.suiAddress || "me";
			console.log("[DEBUG] Fetching check-in history for:", addressParam);
			const res = await fetch(API_ENDPOINTS.USER_HISTORY(addressParam), {
				headers: { "Authorization": `Bearer ${user?.jwt}` }
			});
			if (!res.ok) {
				if (res.status === 401) console.error("[DEBUG] History fetch failed: 401 Unauthorized");
				return null;
			}
			return res.json();
		},
		enabled: !!user?.jwt,
		retry: 3,
		staleTime: 30000,
	});

	// Fetch Real SUI Balance
	const { data: suiBalance } = useQuery({
		queryKey: ["suiBalance", user?.suiAddress],
		queryFn: async () => {
			if (!user?.suiAddress) return "0.00";
			try {
				const res = await fetch("https://fullnode.testnet.sui.io:443", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						jsonrpc: "2.0",
						id: 1,
						method: "suix_getBalance",
						params: [user.suiAddress]
					})
				});
				const json = await res.json();
				const balance = json.result?.totalBalance || 0;
				return (Number(balance) / 1_000_000_000).toFixed(2);
			} catch (e) {
				return "0.00";
			}
		},
		enabled: !!user?.suiAddress,
		refetchInterval: 10000, // Refresh every 10s
	});

	// Fetch Tokens and NFTs
	const { data: userAssets } = useQuery({
		queryKey: ["userAssets", user?.suiAddress],
		queryFn: async () => {
			if (!user?.suiAddress) return { tokens: [], nfts: [] };
			try {
				const res = await fetch("https://fullnode.testnet.sui.io:443", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify([
						{
							jsonrpc: "2.0",
							id: 1,
							method: "suix_getCoins",
							params: [user.suiAddress]
						},
						{
							jsonrpc: "2.0",
							id: 2,
							method: "suix_getOwnedObjects",
							params: [
								user.suiAddress,
								{
									filter: { MatchNone: [{ StructType: "0x2::coin::Coin" }] },
									options: { showContent: true, showDisplay: true }
								}
							]
						}
					])
				});
				const json = await res.json();
				const tokens = json[0]?.result?.data || [];
				const nfts = json[1]?.result?.data || [];
				return { tokens, nfts };
			} catch (e) {
				return { tokens: [], nfts: [] };
			}
		},
		enabled: !!user?.suiAddress,
		refetchInterval: 20000,
	});

	const adminActionMutation = useMutation({
		mutationFn: async ({ id, status, method }: { id: number, status?: number, method: "PATCH" | "DELETE" }) => {
			const url = method === "DELETE" ? API_ENDPOINTS.LOKASI_DELETE(id) : API_ENDPOINTS.LOKASI_UPDATE(id);
			const response = await fetch(url, {
				method: method,
				headers: { 
					"Content-Type": "application/json",
					"Authorization": `Bearer ${user?.jwt}`
				},
				body: JSON.stringify({ 
					status, 
				}),
			});
			if (!response.ok) throw new Error(t.gagal_admin_aksi);
			return response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["lokasi"] });
			alert(t.aksi_admin_berhasil);
		},
	});

	// Browse States
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
	const [viewingLokasi, setViewingLokasi] = useState<Lokasi | null>(null);

	const observerTarget = useRef<HTMLDivElement>(null);

	// Infinite Query for Browse Tab
	const {
		data: browseData,
		fetchNextPage,
		hasNextPage,
		isFetchingNextPage,
		isLoading: isLoadingBrowse,
	} = useInfiniteQuery({
		queryKey: ["lokasiBrowse", selectedCategory, searchQuery],
		queryFn: async ({ pageParam = 1 }) => {
			// Jika kategori "Semua" (null) dan pencarian kosong, jangan ambil data
			if (!selectedCategory && !searchQuery) return { data: [], nextCursor: null };

			const params = new URLSearchParams({
				page: pageParam.toString(),
				limit: "10",
			});
			if (selectedCategory) params.append("category", selectedCategory);
			if (searchQuery) params.append("search", searchQuery);

			const res = await fetch(`${API_ENDPOINTS.LOKASI}?${params.toString()}`);
			if (!res.ok) throw new Error("Gagal mengambil data");
			const data = await res.json();
			
			// Jika data kurang dari limit, berarti sudah habis
			return {
				data: data,
				nextCursor: data.length === 10 ? (pageParam as number) + 1 : null,
			};
		},
		initialPageParam: 1,
		getNextPageParam: (lastPage) => lastPage.nextCursor,
		enabled: activeTab === "browse",
	});

	// Trigger fetchNextPage when observerTarget is visible
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
					fetchNextPage();
				}
			},
			{ threshold: 0.1 }
		);

		if (observerTarget.current) {
			observer.observe(observerTarget.current);
		}

		return () => observer.disconnect();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
			alert(t.checkin_error);
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
				if (!res.ok) throw new Error("Failed to fetch locations");
				const data = await res.json();
				console.log("[LOKASI] Raw Data from API:", data);
				
				// Map backend data to frontend model
				const mappedData = data.map((item: any) => {
					// Robust status mapping:
					// 1. If isVerified is explicitly true (or truthy), status is 1 (Approved).
					// 2. Else if status is present and valid number, use it.
					// 3. Handle string "approved"
					let status = 0;
					if (item.isVerified) {
						status = 1;
					} else if (item.status === 1 || item.status === "approved") {
						status = 1;
					} else if (typeof item.status === 'number') {
						status = item.status;
					}

					return {
						...item,
						foto: item.fotoUtama || item.foto, // Prioritaskan fotoUtama dari DB
						status: status
					};
				});

				console.log("[LOKASI] Mapped Data:", mappedData);

				return mappedData;
			} catch (err) {
				console.error("Failed to fetch locations:", err);
				return [];
			}
		},
	});

	// DEBUG STATUS
	useEffect(() => {
		console.log(`[DEBUG] isAdmin: ${isAdmin}, Locations Count: ${lokasiData?.length || 0}`);
	}, [isAdmin, lokasiData]);

	const checkInMutation = useMutation({
		mutationFn: async (payload: CheckInPayload) => {
			// 1. Validate Comment if present
			if (payload.komentar) {
				const result = validateContent(payload.komentar);
				if (!result.valid) throw new Error(result.reason);
			}

			const response = await fetch(API_ENDPOINTS.CHECKIN, {
				method: "POST",
				headers: { 
					"Content-Type": "application/json",
					"Authorization": `Bearer ${user?.jwt}`
				},
				body: JSON.stringify(payload),
			});
			if (!response.ok) throw new Error(t.checkin_error);
			return response.json();
		},
		onSuccess: (_, variables) => {
			alert(`✅ ${t.checkin_success}`);
			queryClient.invalidateQueries({ queryKey: ["history"] });
			queryClient.invalidateQueries({ queryKey: ["lokasiDetail", variables.lokasiId] });
			setActiveTab("history");
		},
		onError: (error) => {
			alert(`${t.checkin_error}: ${error.message}`);
			console.error("Check-In Error:", error);
		}
	});

	const getGeolocation = () => {
		if ("geolocation" in navigator) {
			navigator.geolocation.getCurrentPosition(
				(pos) => setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
				(err) => alert(`${t.gps_error}: ` + err.message)
			);
		}
	};

	const handleCheckIn = (lokasiId: number, lat: number, lng: number) => {
		if (!isAuthenticated || !user) {
			alert(t.login_first);
			return;
		}

		if (!currentCoords) {
			alert(`⚠️ ${t.menunggu_gps}`);
			getGeolocation();
			return;
		}

		const distance = calculateDistance(currentCoords.lat, currentCoords.lng, lat, lng) * 1000; // in meters
		const MAX_CHECKIN_DISTANCE = 20; // 20 meters

		if (distance > MAX_CHECKIN_DISTANCE) {
			alert(`⚠️ ${t.terlalu_jauh} (${distance.toFixed(0)}m). ${t.dekati_lokasi}`);
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

	const notificationMutation = useMutation({
		mutationFn: async (payload: { title: string, message: string, type: string }) => {
			const res = await fetch(API_ENDPOINTS.NOTIFICATIONS, {
				method: "POST",
				headers: { 
					"Content-Type": "application/json",
					"Authorization": `Bearer ${user?.jwt}`
				},
				body: JSON.stringify(payload),
			});
			if (!res.ok) throw new Error("Failed to send notification");
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["notifications"] });
			alert(t.transaksi_berhasil);
		}
	});

	const [notifForm, setNotifForm] = useState({ title: "", message: "", type: "info" });

	const [historyDate, setHistoryDate] = useState("");
	const [adminSearchEmail, setAdminSearchEmail] = useState("");

	const { data: userActivity, isLoading: isLoadingActivity } = useQuery({
		queryKey: ["activity", user?.sub, historyDate, isAuthenticated, user?.jwt],
		queryFn: async () => {
			if (!isAuthenticated || !user?.jwt) return [];
			const addressParam = user?.suiAddress || "me";
			console.log("[DEBUG] Fetching activity for:", addressParam);
			let url = API_ENDPOINTS.USER_ACTIVITY(addressParam);
			if (historyDate) url += `?date=${historyDate}`;
			const res = await fetch(url, {
				headers: { "Authorization": `Bearer ${user?.jwt}` }
			});
			if (!res.ok) {
				console.error("[DEBUG] Activity fetch failed:", res.status);
				return [];
			}
			const data = await res.json();
			console.log("[DEBUG] Activity data received:", data.length);
			return data;
		},
		enabled: !!user?.jwt && activeTab === "history",
		retry: 2,
	});

	const adminSearchMutation = useMutation({
		mutationFn: async (email: string) => {
			const res = await fetch(API_ENDPOINTS.ADMIN_USER_ACTIVITY(email), {
				headers: { "Authorization": `Bearer ${user?.jwt}` }
			});
			if (!res.ok) throw new Error("User not found or access denied");
			return res.json();
		}
	});

	const logoutMutation = useMutation({
		mutationFn: async () => {
			await fetch(API_ENDPOINTS.LOGOUT, {
				method: "POST",
				headers: { "Authorization": `Bearer ${user?.jwt}` }
			});
		},
		onSuccess: () => {
			logout();
		}
	});

	const renderActivityIcon = (type: string) => {
		switch (type) {
			case "login": return <div className="p-2 bg-green-100 text-green-600 rounded-lg"><User size={16} /></div>;
			case "logout": return <div className="p-2 bg-gray-100 text-gray-600 rounded-lg"><X size={16} /></div>;
			case "add_location": return <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Plus size={16} /></div>;
			case "checkin": return <div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><MapPin size={16} /></div>;
			case "tx_blockchain": return <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Wallet size={16} /></div>;
			case "comment": return <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><MessageCircle size={16} /></div>;
			case "like_location": return <div className="p-2 bg-red-100 text-red-600 rounded-lg"><Heart size={16} /></div>;
			case "update_address": return <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg"><User size={16} /></div>;
			default: return <div className="p-2 bg-slate-100 text-slate-600 rounded-lg"><Clock size={16} /></div>;
		}
	};

	const getActivityLabel = (type: string) => {
		switch (type) {
			case "login": return t.type_login;
			case "logout": return t.type_logout;
			case "add_location": return t.type_add_location;
			case "checkin": return t.type_checkin;
			case "tx_blockchain": return t.type_tx;
			case "comment": return t.type_comment;
			case "like_location": return t.type_like;
			case "update_address": return t.type_update_address;
			case "claim_request": return t.type_claim;
			case "claim_approved": return t.status_approved;
			default: return type;
		}
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
							<h2 className="text-xl font-bold text-gray-900 mb-2">{t.login_to_add}</h2>
							<p className="text-sm text-gray-500 mb-6">{t.login_first}</p>
						</div>
					);
				}

				const mySubmissionsHistory = lokasiData?.filter(loc => loc.suiAddress === user?.suiAddress);

				return (
					<div className="space-y-6 pb-32 animate-in slide-in-from-right duration-300">
						<div className="flex items-center justify-between">
							<h2 className="text-2xl font-bold text-gray-900">{t.activity_history}</h2>
							<div className="flex items-center gap-2">
								<input 
									type="date"
									className="text-xs p-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
									value={historyDate}
									onChange={(e) => setHistoryDate(e.target.value)}
								/>
							</div>
						</div>

						{/* New Detailed Activity List */}
						<div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
							<div className="p-4 bg-gray-50 border-b flex justify-between items-center">
								<span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{t.all_activities}</span>
								{historyDate && (
									<button onClick={() => setHistoryDate("")} className="text-[10px] text-blue-600 font-bold underline">Reset</button>
								)}
							</div>
							<div className="divide-y divide-gray-50">
								{isLoadingActivity ? (
									<div className="p-12 text-center text-gray-400">
										<Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
										<p className="text-xs">{t.loading}</p>
									</div>
								) : userActivity && userActivity.length > 0 ? (
									userActivity.map((act: any) => (
										<div key={act.id} className="p-4 hover:bg-slate-50 transition-colors">
											<div className="flex gap-4">
												{renderActivityIcon(act.type)}
												<div className="flex-1 min-w-0">
													<div className="flex justify-between items-start">
														<h4 className="text-sm font-bold text-gray-800">{getActivityLabel(act.type)}</h4>
														<span className="text-[10px] text-gray-400 font-medium">
															{new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
														</span>
													</div>
													<div className="mt-1">
														{act.details && (
															<p className="text-xs text-gray-500 break-all">
																{(() => {
																	try {
																		const parsed = JSON.parse(act.details);
																		if (parsed && typeof parsed === 'object') {
																			return Object.entries(parsed).map(([k, v]) => `${k}: ${v}`).join(' | ');
																		}
																		return String(act.details);
																	} catch (e) {
																		return String(act.details);
																	}
																})()}
															</p>
														)}
														<span className="text-[10px] text-gray-400 block mt-1">
															{new Date(act.createdAt).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
														</span>
													</div>
												</div>
											</div>
										</div>
									))
								) : (
									<div className="p-12 text-center text-gray-400 italic text-sm">
										{t.no_activity}
									</div>
								)}
							</div>
						</div>

						{/* Admin Search Section */}
						{isAdmin && (
							<div className="bg-blue-50 p-6 rounded-3xl border border-blue-100">
								<h3 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
									<Search size={18} /> {t.admin_view_user}
								</h3>
								<div className="flex gap-2">
									<input 
										type="text"
										placeholder={t.enter_email}
										className="flex-1 px-4 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
										value={adminSearchEmail}
										onChange={(e) => setAdminSearchEmail(e.target.value)}
									/>
									<button 
										onClick={() => adminSearchMutation.mutate(adminSearchEmail)}
										className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold"
									>
										{t.search_user}
									</button>
								</div>

								{adminSearchMutation.data && (
									<div className="mt-6 bg-white p-4 rounded-2xl border border-blue-100 animate-in zoom-in duration-200">
										<div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-50">
											<div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
												{adminSearchMutation.data.user.nama?.charAt(0)}
											</div>
											<div>
												<h4 className="text-sm font-bold text-gray-800">{adminSearchMutation.data.user.nama}</h4>
												<p className="text-[10px] text-gray-400">{adminSearchMutation.data.user.email}</p>
											</div>
										</div>
										<div className="space-y-3 max-h-60 overflow-y-auto pr-2">
											{adminSearchMutation.data.activities.map((act: any) => (
												<div key={act.id} className="flex gap-3 text-[10px]">
													<span className="text-gray-400 shrink-0">{new Date(act.createdAt).toLocaleDateString()}</span>
													<span className="font-bold text-gray-700">{getActivityLabel(act.type)}</span>
													<span className="text-gray-500 truncate">{act.details}</span>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						)}
						
						{/* User Submissions Status */}
						<div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
							<h3 className="font-bold mb-4 text-gray-800">{t.my_submissions}</h3>
							<div className="space-y-3">
								{mySubmissionsHistory && mySubmissionsHistory.length > 0 ? (
									mySubmissionsHistory.map(loc => (
										<div key={loc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
											<div className="flex items-center gap-3">
												<div className="h-10 w-10 bg-white rounded-xl overflow-hidden shadow-sm flex-shrink-0">
													<LocationImage src={loc.foto || (loc as any).fotoUtama} alt={loc.nama} className="w-full h-full object-cover" />
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

						<h3 className="font-bold text-gray-800 mt-6 mb-4">{t.riwayat_cek_in}</h3>
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
												{new Date(checkin.waktu).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { 
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
													<LocationImage src={checkin.fotoUser} alt="Cekin" className="w-full h-full object-cover" />
												</div>
											)}
										</div>
									</div>
								))
							) : (
								<div className="p-8 text-center text-gray-400 italic text-sm">{t.belum_ada_riwayat}</div>
							)}
						</div>
					</div>
				);
			case "checkin":
				const nearestLocations = lokasiData 
					? [...lokasiData]
						.filter(loc => Number(loc.status) === 1 || loc.status === "approved") // Only show verified locations for check-in
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
							<h2 className="text-2xl font-bold mb-2 text-white">{t.checkin}</h2>
							<p className="text-blue-100 text-sm mb-6">{t.nearest_suggestions}</p>
							
							<div className="flex items-center gap-3">
								<button 
									onClick={getGeolocation}
									className="bg-white text-blue-600 font-bold px-5 py-2.5 rounded-xl shadow-lg active:scale-95 transition-all text-sm"
								>
									{t.update_gps}
								</button>
								{currentCoords && (
									<div className="bg-blue-700/50 px-3 py-2 rounded-lg text-[10px] font-mono border border-blue-400/30">
										📍 {currentCoords.lat.toFixed(4)}, {currentCoords.lng.toFixed(4)}
									</div>
								)}
							</div>
						</div>
						
						<div className="flex items-center justify-between px-2">
							<h3 className="font-bold text-lg text-gray-800">{t.jarak_terdekat}</h3>
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
								<h4 className="font-bold text-gray-800 mb-1 text-base">No Locations</h4>
								<p className="text-xs text-gray-400 mb-6">{t.admin_no_pending}</p>
																	<button 
																	onClick={() => setActiveTab("browse")}
																	className="bg-blue-600 text-white font-bold px-6 py-3 rounded-xl shadow-lg text-sm"
																>
																	{t.tambah_lokasi_sekarang}
																</button>
															</div>
														)}
													</div>
												);
											case "browse":
												if (viewingLokasi) {
												
																									// Debug log to check data integrity
																									console.log("Viewing Lokasi Data:", viewingLokasi);
																									const displayPhoto = viewingLokasi.foto || (viewingLokasi as any).fotoUtama;
																									const isOwner = detailLokasi?.owner?.suiAddress === user?.suiAddress;

																									return (
																										<div className="space-y-6 pb-32 animate-in fade-in duration-300">
																											<div className="flex justify-between items-center mb-4">
																												<button 
																													onClick={() => setViewingLokasi(null)}
																													className="flex items-center gap-2 text-gray-500 font-bold"
																												>
																													<X size={20} /> {t.back_to_list}
																												</button>
																												{detailLokasi?.owner && (
																													<span className="bg-green-100 text-green-700 text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1">
																														<UserCheck size={12} /> {t.verified_owner}
																													</span>
																												)}
																											</div>
																				
																											<div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-100">
																												<div className="relative h-64 md:h-80 w-full bg-gray-200">
																													{displayPhoto ? (
																														<img 
																															src={displayPhoto} 
																															alt={viewingLokasi.nama} 
																															className="w-full h-full object-cover"
																															onError={(e) => {
																																e.currentTarget.src = "https://placehold.co/400x300?text=No+Image";
																																e.currentTarget.onerror = null; 
																															}}
																														/>
																													) : (
												
																																<div className="flex flex-col items-center justify-center h-full text-gray-400">
																																	<MapPin size={48} className="mb-2" />
																																	<span className="text-sm">{t.no_photo}</span>
																																</div>
																															)}
																															<div className="absolute top-4 left-4">
																																																	<span className="bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">
																												{viewingLokasi.kategori}
																											</span>
																										</div>
																										{(isAdmin || isOwner) && (
																											<div className="absolute top-4 right-4 flex gap-2">
																												<button 
																													onClick={() => {
																														setEditingLocation(viewingLokasi);
																														setIsModalOpen(true);
																													}}
																													className="bg-white/90 p-2 rounded-full text-blue-600 shadow-md hover:bg-white transition-all"
																													title={t.edit_location}
																												>
																													<Edit size={18} />
																												</button>
																												{isAdmin && (
																													<button 
																														onClick={() => {
																															if(confirm(t.delete_confirm)) {
																																adminActionMutation.mutate({ id: viewingLokasi.id, method: "DELETE" });
																																setViewingLokasi(null);
																															}
																														}}
																														className="bg-white/90 p-2 rounded-full text-red-600 shadow-md hover:bg-white transition-all"
																														title={t.delete}
																													>
																														<Trash size={18} />
																													</button>
																												)}
																											</div>
																										)}
																									</div>

																									{/* Photo Gallery Grid */}
																									{(viewingLokasi as any).galeri && (viewingLokasi as any).galeri.length > 0 && (
																										<div className="flex gap-2 p-4 overflow-x-auto scrollbar-hide bg-gray-50/50">
																											{(viewingLokasi as any).galeri.map((url: string, idx: number) => (
																												<div 
																													key={idx} 
																													className="h-20 w-20 rounded-xl overflow-hidden flex-shrink-0 border-2 border-white shadow-sm cursor-pointer hover:scale-105 transition-transform"
																													onClick={() => setViewPhotoUrl(url)}
																												>
																													<LocationImage src={url} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
																												</div>
																											))}
																										</div>
																									)}
																									
																									<div className="p-6">
																	
																	<h2 className="text-2xl font-bold text-gray-900 mb-2">{viewingLokasi.nama}</h2>
																										<div className="flex items-center gap-1 text-blue-600 mb-4">
																											<MapPin size={16} />
																											<span className="text-xs font-mono mr-2">
																												{viewingLokasi.latitude?.toFixed(4) || "0.0000"}, {viewingLokasi.longitude?.toFixed(4) || "0.0000"}
																											</span>
																											{currentCoords && viewingLokasi.latitude && viewingLokasi.longitude && (
																												<span className="text-xs font-bold bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1">
																													<Navigation size={12} />
																													{formatDistance(calculateDistance(currentCoords.lat, currentCoords.lng, viewingLokasi.latitude, viewingLokasi.longitude))}
																												</span>
																											)}
																										</div>

																										{!detailLokasi?.owner && isAuthenticated && (
																											<button 
																												onClick={() => {
																													if(confirm(`${t.claim_confirm.replace('{name}', viewingLokasi.nama)}`)) {
																														claimMutation.mutate(viewingLokasi.id);
																													}
																												}}
																												className="w-full mb-6 bg-slate-100 text-slate-700 text-xs font-bold py-3 rounded-xl border border-dashed border-slate-300 hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
																											>
																												<ShieldAlert size={16} className="text-orange-500" /> {t.claim_ownership}
																											</button>
																										)}

																										{isOwner && (
																											<button 
																												onClick={() => {
																													if(confirm(`${t.unclaim_confirm.replace('{name}', viewingLokasi.nama)}`)) {
																														unclaimMutation.mutate(viewingLokasi.id);
																													}
																												}}
																												className="w-full mb-6 bg-red-50 text-red-700 text-[10px] font-bold py-2 rounded-xl border border-dashed border-red-200 hover:bg-red-100 transition-all flex items-center justify-center gap-2"
																											>
																												<ShieldAlert size={14} /> {t.release_claim}
																											</button>
																										)}
																																																				<a 
																																																					href={`https://www.google.com/maps/dir/?api=1&destination=${viewingLokasi.latitude},${viewingLokasi.longitude}`}
																																																					target="_blank"
																																																					rel="noopener noreferrer"
																																																					className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 underline mb-4"
																																																				>
																																																					<Navigation size={14} /> Google Maps
																																																				</a>
																																																				<DescriptionWithLinks 
																																																					text={viewingLokasi.deskripsi} 
																																																					className="text-gray-600 text-sm leading-relaxed mb-6 whitespace-pre-line"
																																																					t={t}
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
																																																										alert(t.copied);
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
																																																									<MessageCircle size={18} className="text-blue-600" /> {t.komentar}
																																																								</h3>
																																				
																																				
																																				{/* Comment Input */}
																																																								{isAuthenticated ? (
																																																									<div className="space-y-2">
																																																										{replyTo && (
																																																											<div className="flex items-center justify-between bg-blue-50 px-3 py-1.5 rounded-lg text-[10px] text-blue-700 animate-in slide-in-from-top">
																																																												<span>{t.replying_to} <strong>@{replyTo.name}</strong></span>
																																																												<button onClick={() => setReplyTo(null)} className="hover:text-blue-900"><X size={14} /></button>
																																																											</div>
																																																										)}
																																																										<div className="flex gap-2">
																																																											<input 
																																																												type="text"
																																																												placeholder={replyTo ? t.write_comment : t.write_comment}
																																																												className="flex-1 bg-gray-50 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
																																																												value={commentText}
																																																												onChange={(e) => setCommentText(e.target.value)}
																																																												onKeyDown={(e) => e.key === 'Enter' && commentText.trim() && commentMutation.mutate({ id: viewingLokasi.id, text: commentText, parentId: replyTo?.id })}
																																																											/>
																																																											<button 
																																																												disabled={!commentText.trim() || commentMutation.isPending}
																																																												onClick={() => commentMutation.mutate({ id: viewingLokasi.id, text: commentText, parentId: replyTo?.id })}
																																																												className="bg-blue-600 text-white p-3 rounded-xl disabled:bg-gray-300 shadow-lg shadow-blue-100"
																																																											>
																																																												<Send size={18} />
																																																											</button>
																																																										</div>
																																																									</div>
																																																								) : (
																																																									<p className="text-[10px] text-gray-400 bg-gray-50 p-3 rounded-xl border border-dashed text-center">{t.login_to_comment}</p>
																																																								)}
																																				
																																																								{/* Comments List */}
																																																								<div className="space-y-4">
																																																									{detailLokasi?.comments && detailLokasi.comments.length > 0 ? (
																																																										detailLokasi.comments.map((cm: any) => (
																																																											<div key={cm.id} className="space-y-2">
																																																												<div className="flex flex-col bg-white p-3 rounded-2xl border border-gray-50 shadow-sm">
																																																													<div className="flex justify-between items-center mb-1">
																																																														<div className="flex items-center gap-2">
																																																															<span className="text-[11px] font-bold text-gray-800">{cm.user?.nama || "Traveler"}</span>
																																																															<span className="text-[9px] text-gray-400">{new Date(cm.waktu).toLocaleDateString(lang === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short' })}</span>
																																																														</div>
																																																														{isAdmin && (
																																																															<button 
																																																																onClick={() => moderationMutation.mutate({ id: cm.id, type: 'comment', isHidden: true, method: 'PATCH' })}
																																																																className="text-red-400 hover:text-red-600"
																																																																title={t.sembunyikan}
																																																															>
																																																																<EyeOff size={14} />
																																																															</button>
																																																														)}
																																																													</div>
																																																													<p className="text-xs text-gray-600 leading-snug">{cm.text}</p>
																																																													<button 
																																																														onClick={() => {
																																																															setReplyTo({ id: cm.id, name: cm.user?.nama || "Traveler" });
																																																															window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top input
																																																														}}
																																																														className="text-[10px] text-blue-600 font-bold mt-2 hover:underline"
																																																													>
																																																														{t.balas}
																																																													</button>
																																																												</div>
																																																																												{/* Replies */}
																																								{cm.replies && cm.replies.length > 0 && (
																																									<div className="ml-6 space-y-2 border-l-2 border-blue-50 pl-4">
																																										{cm.replies.map((reply: any) => (
																																											<div key={reply.id} className="bg-gray-50/50 p-2.5 rounded-xl border border-gray-50">
																																												<div className="flex justify-between items-center mb-1">
																																													<div className="flex items-center gap-2">
																																														<CornerDownRight size={10} className="text-blue-300" />
																																														<span className="text-[10px] font-bold text-gray-700">{reply.user?.nama || "Traveler"}</span>
																																													</div>
																																													{isAdmin && (
																																														<button 
																																															onClick={() => moderationMutation.mutate({ id: reply.id, type: 'comment', isHidden: true, method: 'PATCH' })}
																																															className="text-red-400 hover:text-red-600"
																																														>
																																															<EyeOff size={12} />
																																														</button>
																																													)}
																																												</div>
																																												<p className="text-[11px] text-gray-500">{reply.text}</p>
																																											</div>
																																										))}
																																									</div>
																																								)}
																																							</div>
																																						))
																																					) : (
																																						<p className="text-center text-[10px] text-gray-400 italic py-2">No discussions yet.</p>
																																					)}
																																				</div>
																																			</div>
																										
																																												<div className="border-t pt-6">
																																													<h3 className="font-bold text-gray-900 mb-4">{t.public_checkin}</h3>
																																													<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
																																														{isLoadingDetail ? (
																																															<div className="flex justify-center p-4 col-span-full"><Loader2 className="animate-spin text-blue-600" /></div>
																																														) : detailLokasi?.checkIns ? (
																																															detailLokasi.checkIns.length > 0 ? (
																																																detailLokasi.checkIns.map((ci: any) => (
																																																	<div key={ci.id} className="bg-gray-50 p-3 rounded-2xl border border-gray-100 flex flex-col gap-2 relative group">
																																																		{isAdmin && (
																																																			<div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
																																																				<button 
																																																					onClick={() => moderationMutation.mutate({ id: ci.id, type: 'checkin', isHidden: true, method: 'PATCH' })}
																																																					className="bg-white/80 p-1.5 rounded-lg text-red-500 shadow-sm"
																																																					title={t.sembunyikan}
																																																				>
																																																					<EyeOff size={14} />
																																																				</button>
																																																			</div>
																																																		)}
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
																																																<p>{t.no_public_checkin}</p>
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
																		{t.checkin_here}
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
								<h2 className="text-2xl font-bold text-gray-900">{t.jelajahi_lokasi}</h2>
								<button 
									onClick={() => {
										if (!isAuthenticated) {
											alert(t.login_to_add);
											return;
										}
										setIsModalOpen(true);
									}}
									className="bg-blue-600 text-white p-2.5 rounded-xl shadow-lg active:scale-90 transition-all"
									title={t.add_location}
								>
									<Plus size={24} />
								</button>
							</div>

							<div className="flex gap-2">
								<div className="relative flex-1">
									<Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
									<input 
										type="text"
										placeholder={t.cari_nama_tempat}
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
									{t.semua}
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
								{!selectedCategory && !searchQuery ? (
									<div className="text-center py-20 px-6">
										<div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
											<Search size={32} className="text-blue-400" />
										</div>
										<h3 className="text-gray-900 font-bold text-lg mb-2">{t.cari_nama_tempat}</h3>
										<p className="text-gray-500 text-sm max-w-[240px] mx-auto leading-relaxed">
											Ketik nama tempat atau pilih kategori untuk mulai menjelajahi Kabupaten Sinjai.
										</p>
									</div>
								) : (
									<>
										{browseData?.pages.map((page, i) => (
											<React.Fragment key={i}>
												{page.data.map((lokasi: Lokasi) => {
													const displayPhoto = lokasi.foto || (lokasi as any).fotoUtama;
													return (
														<div 
															key={lokasi.id} 
															onClick={() => setViewingLokasi(lokasi)}
															className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4 cursor-pointer hover:border-blue-200 transition-all"
														>
															<div className="h-16 w-16 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
																<LocationImage src={displayPhoto} alt={lokasi.nama} className="w-full h-full object-cover" />
															</div>
															<div className="flex-1 min-w-0">
																<h4 className="font-bold text-gray-900 leading-tight truncate">{lokasi.nama}</h4>
																<p className="text-[10px] text-gray-400 mt-1 line-clamp-1">{lokasi.deskripsi}</p>
																<div className="flex items-center gap-2 mt-2">
																	<span className="text-[8px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded uppercase tracking-wider">
																		{lokasi.kategori}
																	</span>
																</div>
															</div>
														</div>
													);
												})}
											</React.Fragment>
										))}

										{/* Loading & Infinite Scroll Trigger */}
										<div ref={observerTarget} className="py-8 flex justify-center">
											{isFetchingNextPage ? (
												<Loader2 className="w-6 h-6 animate-spin text-blue-500" />
											) : hasNextPage ? (
												<span className="text-xs text-gray-400 italic">Memuat lebih banyak...</span>
											) : (
												browseData?.pages[0].data.length > 0 && (
													<span className="text-xs text-gray-400 italic">Semua data telah ditampilkan.</span>
												)
											)}
										</div>

										{isLoadingBrowse && (
											<div className="text-center py-12">
												<Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500 mb-2" />
												<p className="text-xs text-gray-400">{t.loading}</p>
											</div>
										)}

										{!isLoadingBrowse && browseData?.pages[0].data.length === 0 && (
											<div className="text-center py-12 text-gray-400 italic text-sm">Tidak ditemukan lokasi yang cocok.</div>
										)}
									</>
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
							<h2 className="text-2xl font-bold text-gray-900 mb-2">{t.profile}</h2>
							<p className="text-gray-500 mb-8 max-w-xs mx-auto">{t.login_first}</p>
							
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
								{/* Admin Panel: Location Verification */}
								<div className="flex items-center justify-between mb-4">
									<div className="flex items-center gap-2 text-red-800">
										<ShieldCheck size={20} />
										<h3 className="font-bold">Verifikasi Lokasi</h3>
									</div>
									<span className="bg-red-200 text-red-800 text-[10px] font-bold px-2 py-1 rounded-full">
										{pendingSubmissions?.length || 0} Pending
									</span>
								</div>
								
								<div className="space-y-3 mb-8">
									{pendingSubmissions && pendingSubmissions.length > 0 ? (
										pendingSubmissions.map(loc => (
											<div key={loc.id} className="bg-white p-3 rounded-2xl shadow-sm border border-red-100 flex items-center justify-between">
												<div className="flex items-center gap-3">
													<div className="h-10 w-10 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
														<LocationImage src={loc.foto || loc.fotoUtama} alt={loc.nama} className="w-full h-full object-cover" />
													</div>
													<div>
														<h4 className="text-xs font-bold text-gray-800">{loc.nama}</h4>
														<p className="text-[10px] text-gray-400">{loc.kategori}</p>
													</div>
												</div>
												<div className="flex gap-1">
													<button 
														onClick={() => {
															if (!loc.latitude || !loc.longitude || loc.latitude === 0 || loc.longitude === 0) {
																alert("⚠️ Koordinat belum diverifikasi! Silakan klik 'Edit' (ikon pensil) untuk mengisi koordinat yang benar sebelum menyetujui lokasi ini.");
																return;
															}
															adminActionMutation.mutate({ id: loc.id, status: 1, method: "PATCH" });
														}}
														className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
														title={t.approve}
													>
														<Check size={18} />
													</button>
													<button 
														onClick={() => {
															setEditingLocation(loc);
															setIsModalOpen(true);
														}}
														className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
														title={t.edit_location}
													>
														<Edit size={18} />
													</button>
													<button 
														onClick={() => {
															if (confirm(t.delete_confirm)) {
																adminActionMutation.mutate({ id: loc.id, method: "DELETE" });
															}
														}}
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

								{/* Admin Panel: Claim Verification */}
								<div className="flex items-center justify-between mb-4 pt-4 border-t border-red-100">
									<div className="flex items-center gap-2 text-red-800">
										<ShieldAlert size={20} />
										<h3 className="font-bold">{t.admin_claims}</h3>
									</div>
									<span className="bg-orange-200 text-orange-800 text-[10px] font-bold px-2 py-1 rounded-full">
										{adminClaims?.length || 0} Pending
									</span>
								</div>

								<div className="space-y-3">
									{adminClaims && adminClaims.length > 0 ? (
										adminClaims.map((claim: any) => (
											<div key={claim.id} className="bg-white p-3 rounded-2xl shadow-sm border border-orange-100 flex items-center justify-between">
												<div className="flex-1">
													<h4 className="text-xs font-bold text-gray-800">
														{claim.user?.nama || "Unknown User"} {t.claim_ownership} {claim.lokasi?.nama || "Unknown Location"}
													</h4>
													<p className="text-[10px] text-gray-400 truncate">{claim.user?.suiAddress || "No Address"}</p>
												</div>
												<div className="flex gap-1">
													<button 
														onClick={() => adminClaimMutation.mutate({ id: claim.id, status: 'approved' })}
														className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
													>
														<Check size={18} />
													</button>
													<button 
														onClick={() => adminClaimMutation.mutate({ id: claim.id, status: 'rejected' })}
														className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
													>
														<Trash2 size={18} />
													</button>
												</div>
											</div>
										))
									) : (
										<p className="text-center text-[10px] text-gray-400 italic py-2">{t.no_claims}</p>
									)}
								</div>

								{/* Broadcast Notification Form */}
								<div className="mt-8 border-t border-red-100 pt-6">
									<div className="flex items-center gap-2 mb-4 text-red-800">
										<Megaphone size={20} />
										<h3 className="font-bold">{t.notifications}</h3>
									</div>
									<div className="space-y-3">
										<input 
											type="text" 
											placeholder={lang === 'id' ? "Judul Pengumuman" : "Announcement Title"}
											className="w-full px-4 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
											value={notifForm.title}
											onChange={(e) => setNotifForm({...notifForm, title: e.target.value})}
										/>
										<select 
											className="w-full px-4 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-red-500 outline-none"
											value={notifForm.type}
											onChange={(e) => setNotifForm({...notifForm, type: e.target.value})}
										>
											<option value="info">{lang === 'id' ? "Informasi Umum" : "General Information"}</option>
											<option value="event">{lang === 'id' ? "Event Wisata" : "Tourism Event"}</option>
											<option value="megaphone">{lang === 'id' ? "Pesan Mendesak" : "Urgent Message"}</option>
										</select>
										<textarea 
											placeholder={lang === 'id' ? "Isi pesan notifikasi..." : "Notification message content..."}
											className="w-full px-4 py-2 text-sm border rounded-xl focus:ring-2 focus:ring-red-500 outline-none h-20 resize-none"
											value={notifForm.message}
											onChange={(e) => setNotifForm({...notifForm, message: e.target.value})}
										/>
										<button 
											disabled={!notifForm.title || !notifForm.message || notificationMutation.isPending}
											onClick={() => notificationMutation.mutate(notifForm)}
											className="w-full bg-red-600 text-white font-bold py-2 rounded-lg text-xs shadow-md disabled:bg-gray-300"
										>
											{notificationMutation.isPending ? t.loading : `${t.send} Broadcast`}
										</button>
									</div>
								</div>
							</div>
						)}

						{/* Asset Stats (Calculated) */}
						<div className="grid grid-cols-2 gap-4">
							<div className="bg-white p-4 rounded-3xl shadow-sm border text-center">
								<Award className="text-yellow-500 mx-auto mb-2" />
								<span className="block text-xl font-bold">{myPoints}</span>
								<span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t.points} Travel</span>
							</div>
							<div className="bg-white p-4 rounded-3xl shadow-sm border text-center">
								<Package className="text-blue-500 mx-auto mb-2" />
								<span className="block text-xl font-bold">{myBadgesCount}</span>
								<span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t.badges}</span>
							</div>
						</div>

						<div className="bg-white p-6 rounded-3xl text-gray-900 shadow-sm border border-gray-100">
							<div className="flex justify-between items-start mb-6">
								<div>
									<h4 className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">{t.saldo_sui}</h4>
									<div className="text-xl font-bold text-blue-600">{suiBalance || "0.00"} SUI</div>
								</div>
								<div className="bg-blue-50 p-2 rounded-xl text-blue-600">
									<Wallet size={20} />
								</div>
							</div>

							{/* User Assets (Tokens & NFTs) */}
							{(userAssets?.tokens?.length > 0 || userAssets?.nfts?.length > 0) && (
								<div className="mb-6 space-y-4">
									{(userAssets?.tokens?.length || 0) > 0 && (
										<div>
											<h5 className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tokens</h5>
											<div className="space-y-2">
												{userAssets?.tokens?.map((coin: any, idx: number) => (
													<div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
														<span className="text-[10px] font-mono text-gray-600 truncate max-w-[150px]">{coin.coinType.split('::').pop()}</span>
														<span className="text-[10px] font-bold text-gray-800">{(Number(coin.balance) / 1_000_000_000).toFixed(2)}</span>
													</div>
												))}
											</div>
										</div>
									)}
									{(userAssets?.nfts?.length || 0) > 0 && (
										<div>
											<h5 className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mb-2">NFTs</h5>
											<div className="grid grid-cols-2 gap-2">
												{userAssets?.nfts?.map((nft: any, idx: number) => (
													<div key={idx} className="bg-gray-50 p-2 rounded-lg border border-gray-100 text-center">
														{nft.data?.display?.data?.image_url ? (
															<img src={nft.data.display.data.image_url} className="w-8 h-8 mx-auto rounded mb-1 object-cover" />
														) : (
															<ImageIcon size={16} className="mx-auto mb-1 text-gray-300" />
														)}
														<p className="text-[8px] font-bold truncate">{nft.data?.display?.data?.name || "Unnamed NFT"}</p>
													</div>
												))}
											</div>
										</div>
									)}
								</div>
							)}

							<div className="flex gap-2 mb-3">
								<button 
									onClick={() => setSendReceiveMode("receive")}
									className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-2"
								>
									<ArrowDownLeft size={16} /> {t.receive}
								</button>
								<button 
									onClick={() => setSendReceiveMode("send")}
									className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-2"
								>
									<ArrowUpRight size={16} /> {t.send}
								</button>
							</div>
							<div className="flex gap-2">
								<button 
									onClick={() => setIsLeaderboardOpen(true)}
									className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 py-3 rounded-xl text-xs font-bold transition-all uppercase tracking-wider flex items-center justify-center gap-2"
								>
									<Trophy size={16} /> {t.leaderboard}
								</button>
								<button 
									onClick={() => logoutMutation.mutate()}
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
			<Navbar onLogout={() => logoutMutation.mutate()} />

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
				existingLocations={lokasiData}
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
							<h3 className="text-xl font-bold text-gray-900">{t.checkin}</h3>
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
										<p className="text-sm text-gray-500 font-medium">{uploadingCheckIn ? t.uploading : t.choose_photo}</p>
									</>
								)}
							</div>
							<input type="file" ref={checkInFileRef} onChange={handleCheckInPhoto} accept="image/*" className="hidden" />

							<div>
								<label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">{t.komentar}</label>
								<textarea 
									className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all h-24 resize-none text-sm"
									placeholder={t.write_comment}
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
								<span>{t.send_now}</span>
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
						<img 
							src={viewPhotoUrl?.startsWith("/uploads/") 
								? `${process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api", "") || "https://db.sinjaikab.go.id/wisata"}${viewPhotoUrl}`
								: viewPhotoUrl || ""
							} 
							alt="Preview Full" 
							className="max-w-full max-h-[90vh] object-contain rounded-xl" 
						/>
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
