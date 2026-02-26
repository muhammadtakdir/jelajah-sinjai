"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/lib/api";
import { useAdmin } from "@/hooks/useAdmin";
import { useGoogleUser } from "@/hooks/useGoogleUser";
import { useCategories } from "@/hooks/useCategories";
import { Camera, X, Loader2, MapPin, Plus } from "lucide-react";
import { Lokasi } from "@/lib/types";
import { validateContent } from "@/lib/moderation";
import { useLanguage } from "@/lib/LanguageContext";
import LocationImage from "./LocationImage";

interface AddLocationModalProps {
	isOpen: boolean;
	onClose: () => void;
	initialData?: Lokasi | null;
	existingLocations?: Lokasi[];
}

export default function AddLocationModal({ isOpen, onClose, initialData }: AddLocationModalProps) {
	const { t, lang } = useLanguage();
	const queryClient = useQueryClient();
	const { isAdmin } = useAdmin();
	const { user } = useGoogleUser();
	const { data: categories, isLoading: isCategoriesLoading } = useCategories();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const galleryInputRef = useRef<HTMLInputElement>(null);
	
	const [step, setStep] = useState<"check" | "form">("check");
	const [nameCheck, setNameCheck] = useState("");
	const [similarLocations, setSimilarLocations] = useState<Lokasi[]>([]);

	const [formData, setFormData] = useState({
		nama: "",
		kategori: "Wisata Alam",
		deskripsi: "",
		latitude: -5.2255,
		longitude: 120.2647,
		foto: "",
		galeri: [] as string[],
		suiAddress: "",
	});

	const [uploading, setUploading] = useState(false);
	const [uploadingGallery, setUploadingGallery] = useState(false);
	const [preview, setPreview] = useState("");
	const [gpsError, setGpsError] = useState("");

	useEffect(() => {
		if (isOpen) {
			if (initialData) {
				let photoUrl = initialData.foto || (initialData as any).fotoUtama || "";
				if (photoUrl && photoUrl.startsWith("/uploads/")) {
					const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api", "") || "https://db.sinjaikab.go.id/wisata";
					photoUrl = `${baseUrl}${photoUrl}`;
				}
				
				setFormData({
					nama: initialData.nama,
					kategori: initialData.kategori,
					deskripsi: initialData.deskripsi || "",
					latitude: initialData.latitude,
					longitude: initialData.longitude,
					foto: photoUrl,
					galeri: (initialData as any).galeri || [],
					suiAddress: initialData.suiAddress || user?.suiAddress || "",
				});
				setPreview(photoUrl);
				setStep("form");
			} else {
				getGPS();
				setFormData({
					nama: "",
					kategori: categories?.[0] || "Wisata Alam",
					deskripsi: "",
					latitude: -5.2255,
					longitude: 120.2647,
					foto: "",
					galeri: [],
					suiAddress: user?.suiAddress || ""
				});
				setPreview("");
				setStep("check");
				setNameCheck("");
				setSimilarLocations([]);
			}
		}
	}, [isOpen, initialData, user, categories]);

	const getGPS = () => {
		if ("geolocation" in navigator) {
			setGpsError("");
			navigator.geolocation.getCurrentPosition(
				(pos) => {
					setFormData(prev => ({
						...prev,
						latitude: pos.coords.latitude,
						longitude: pos.coords.longitude
					}));
				},
				(err) => {
					setGpsError(t.gps_error);
				},
				{ enableHighAccuracy: true }
			);
		} else {
			setGpsError(t.gps_error);
		}
	};

	const checkName = async () => {
		if (!nameCheck.trim()) return;
		try {
			const params = new URLSearchParams({ search: nameCheck, limit: "5" });
			const res = await fetch(`${API_ENDPOINTS.LOKASI}?${params.toString()}`);
			if (!res.ok) throw new Error("Search failed");
			const matches: Lokasi[] = await res.json();
			if (matches.length > 0) {
				setSimilarLocations(matches);
			} else {
				proceedToForm();
			}
		} catch (error) {
			proceedToForm();
		}
	};

	const proceedToForm = () => {
		setFormData(prev => ({ ...prev, nama: nameCheck }));
		setStep("form");
	};

	const mutation = useMutation({
		mutationFn: async (data: any) => {
			const isEdit = !!initialData;
			const url = isEdit ? API_ENDPOINTS.LOKASI_UPDATE(initialData.id) : API_ENDPOINTS.LOKASI;
			const method = isEdit ? "PATCH" : "POST";

			const payload = {
				nama: data.nama,
				kategori: data.kategori,
				deskripsi: data.deskripsi,
				latitude: data.latitude,
				longitude: data.longitude,
				fotoUtama: data.foto, 
				foto: data.foto,      
				galeri: data.galeri,
				adminAddress: user?.suiAddress || "",
				...(isEdit ? {} : { isVerified: isAdmin, suiAddress: user?.suiAddress || "" })
			};

			const response = await fetch(url, {
				method: method,
				headers: { 
					"Content-Type": "application/json",
					"Authorization": `Bearer ${user?.jwt}`
				},
				body: JSON.stringify(payload),
			});

			if (!response.ok) throw new Error(`${t.error_save}: ${response.status}`);
			return response.json();
		},
		onSuccess: () => {
			alert(initialData ? t.success_update : t.success_add);
			queryClient.invalidateQueries({ queryKey: ["lokasi"] });
			onClose();
		},
		onError: (error: any) => {
			alert(`Error: ${error.message}`);
		},
	});

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, isGallery = false) => {
		const file = e.target.files?.[0];
		if (!file) return;

		if (!isGallery) {
			setUploading(true);
			const reader = new FileReader();
			reader.onloadend = () => setPreview(reader.result as string);
			reader.readAsDataURL(file);
		} else {
			setUploadingGallery(true);
		}

		const uploadData = new FormData();
		uploadData.append("foto", file);

		try {
			const res = await fetch(API_ENDPOINTS.UPLOAD, {
				method: "POST",
				body: uploadData,
			});
			const data = await res.json();
			if (data.url) {
				if (isGallery) {
					setFormData(prev => ({ ...prev, galeri: [...prev.galeri, data.url] }));
				} else {
					setFormData(prev => ({ ...prev, foto: data.url }));
				}
			}
		} catch (error) {
			alert(t.checkin_error);
		} finally {
			setUploading(false);
			setUploadingGallery(false);
		}
	};

	const removeGalleryItem = (idx: number) => {
		setFormData(prev => ({
			...prev,
			galeri: prev.galeri.filter((_, i) => i !== idx)
		}));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const nameValid = validateContent(formData.nama);
		if (!nameValid.valid) return alert(`${t.location_name}: ${nameValid.reason}`);
		const descValid = validateContent(formData.deskripsi);
		if (!descValid.valid) return alert(`${t.description}: ${descValid.reason}`);
		mutation.mutate(formData);
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-2xl font-bold text-gray-800">
						{initialData ? t.edit_location : (step === "check" ? t.check_location : t.add_location)}
					</h2>
					<button onClick={onClose} className="text-gray-400 hover:text-gray-600">
						<X size={24} />
					</button>
				</div>

				{step === "check" ? (
					<div className="space-y-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">{t.location_name}</label>
							<div className="flex gap-2">
								<input
									type="text"
									className="flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
									value={nameCheck}
									onChange={(e) => setNameCheck(e.target.value)}
									placeholder={t.location_name_placeholder}
									onKeyDown={(e) => e.key === "Enter" && checkName()}
									autoFocus
								/>
								<button onClick={checkName} className="bg-blue-600 text-white px-6 rounded-xl font-bold">{t.check}</button>
							</div>
							<p className="text-xs text-gray-500 mt-2">{t.check_info}</p>
						</div>
						{similarLocations.length > 0 && (
							<div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
								<h3 className="text-sm font-bold text-yellow-800 mb-2">{t.similar_found}</h3>
								<div className="space-y-2 mb-4">
									{similarLocations.map(loc => (
										<div key={loc.id} className="bg-white p-2 rounded-lg border border-yellow-100 flex justify-between items-center">
											<span className="text-xs font-medium">{loc.nama}</span>
											<span className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500">{loc.kategori}</span>
										</div>
									))}
								</div>
								<button onClick={proceedToForm} className="w-full bg-white border border-yellow-300 text-yellow-800 font-bold py-2 rounded-lg text-sm">{t.stay_continue}</button>
							</div>
						)}
					</div>
				) : (
					<form onSubmit={handleSubmit} className="space-y-4">
						{!initialData && (
							<button type="button" onClick={() => setStep("check")} className="text-xs text-gray-500 flex items-center gap-1 mb-2">← {t.back_to_check}</button>
						)}
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">{t.location_name}</label>
							<input
								type="text" required
								className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
								value={formData.nama}
								onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">{t.categories}</label>
							<select
								className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
								value={formData.kategori}
								onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
							>
								{categories?.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
							</select>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">{t.description}</label>
							<textarea
								required className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none"
								value={formData.deskripsi}
								onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
							/>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">{t.latitude}</label>
								<input
									type="number" step="any" required readOnly={!isAdmin}
									className={`w-full px-4 py-2 border rounded-lg ${!isAdmin ? "bg-gray-100" : ""}`}
									value={formData.latitude}
									onChange={(e) => isAdmin && setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">{t.longitude}</label>
								<input
									type="number" step="any" required readOnly={!isAdmin}
									className={`w-full px-4 py-2 border rounded-lg ${!isAdmin ? "bg-gray-100" : ""}`}
									value={formData.longitude}
									onChange={(e) => isAdmin && setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
								/>
							</div>
						</div>
						<div className="flex items-center justify-between text-xs">
							{gpsError ? <span className="text-red-500">{t.gps_error}</span> : <span className="text-green-600">✓ {t.gps_auto}</span>}
							<button type="button" onClick={getGPS} className="text-blue-600 font-bold underline">{t.refresh_gps}</button>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">{t.location_photo}</label>
							<div onClick={() => fileInputRef.current?.click()} className="relative w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer overflow-hidden">
								{preview ? <img src={preview} className="w-full h-full object-cover" /> : <Camera className="text-gray-400" />}
								{uploading && <Loader2 className="absolute animate-spin text-blue-600" />}
							</div>
							<input type="file" ref={fileInputRef} onChange={(e) => handleFileChange(e, false)} accept="image/*" className="hidden" />
						</div>

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								{lang === 'id' ? "Galeri Foto Tambahan" : "Additional Photo Gallery"}
							</label>
							<div className="grid grid-cols-4 gap-2">
								{formData.galeri.map((url, idx) => (
									<div key={idx} className="relative aspect-square rounded-lg overflow-hidden border">
										<LocationImage src={url} alt="Gallery Item" className="w-full h-full object-cover" />
										<button type="button" onClick={() => removeGalleryItem(idx)} className="absolute top-0.5 right-0.5 bg-red-600 text-white rounded-full p-1"><X size={10} /></button>
									</div>
								))}
								<button type="button" disabled={uploadingGallery} onClick={() => galleryInputRef.current?.click()} className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-gray-400">
									{uploadingGallery ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus size={16} />}
								</button>
							</div>
							<input type="file" ref={galleryInputRef} onChange={(e) => handleFileChange(e, true)} accept="image/*" className="hidden" />
						</div>

						<div className="pt-4 flex gap-3">
							<button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg font-medium">{t.cancel}</button>
							<button type="submit" disabled={mutation.isPending} className="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg disabled:opacity-50">
								{mutation.isPending ? t.loading : (initialData ? t.save_changes : t.save_location)}
							</button>
						</div>
					</form>
				)}
			</div>
		</div>
	);
}