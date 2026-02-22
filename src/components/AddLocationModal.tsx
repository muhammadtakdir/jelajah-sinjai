"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/lib/api";
import { useAdmin } from "@/hooks/useAdmin";
import { useGoogleUser } from "@/hooks/useGoogleUser";
import { useCategories } from "@/hooks/useCategories";
import { Camera, X, Loader2, MapPin } from "lucide-react";
import { Lokasi } from "@/lib/types";
import { validateContent } from "@/lib/moderation";

interface AddLocationModalProps {
	isOpen: boolean;
	onClose: () => void;
	initialData?: Lokasi | null; // Optional prop for editing
	existingLocations?: Lokasi[];
}

export default function AddLocationModal({ isOpen, onClose, initialData, existingLocations }: AddLocationModalProps) {
	const queryClient = useQueryClient();
	const { isAdmin } = useAdmin();
	const { user } = useGoogleUser();
	const { data: categories, isLoading: isCategoriesLoading } = useCategories();
	const fileInputRef = useRef<HTMLInputElement>(null);
	
	const [step, setStep] = useState<"check" | "form">("check");
	const [nameCheck, setNameCheck] = useState("");
	const [similarLocations, setSimilarLocations] = useState<Lokasi[]>([]);

	const [formData, setFormData] = useState({
		nama: "",
		kategori: "Wisata Alam",
		deskripsi: "",
		latitude: -5.2255,
		longitude: 120.2647,
		is_claim: false,
		status: 0, 
		foto: "",
		suiAddress: "",
	});

	// Reset or Populate form when modal opens
	useEffect(() => {
		if (isOpen) {
			if (initialData) {
				console.log("Edit Mode Initial Data:", initialData); // Debug log
				// Fallback to fotoUtama if foto is missing
				// @ts-ignore
				const photoUrl = initialData.foto || initialData.fotoUtama || "";
				
				// Edit Mode: Populate with existing data
				setFormData({
					nama: initialData.nama,
					kategori: initialData.kategori,
					deskripsi: initialData.deskripsi || "",
					latitude: initialData.latitude,
					longitude: initialData.longitude,
					is_claim: false,
					status: typeof initialData.status === 'number' ? initialData.status : 0,
					foto: photoUrl,
					suiAddress: initialData.suiAddress || user?.suiAddress || "",
				});
				setPreview(photoUrl);
				setStep("form"); // Skip check for edit
			} else {
				// Add Mode: Reset
				getGPS();
				setFormData(prev => ({
					...prev,
					nama: "",
					deskripsi: "",
					foto: "",
					suiAddress: user?.suiAddress || ""
				}));
				setPreview("");
				setStep("check"); // Start with check
				setNameCheck("");
				setSimilarLocations([]);
			}
		}
	}, [isOpen, initialData, user]);

	const checkName = () => {
		if (!nameCheck.trim()) return;
		
		const matches = existingLocations?.filter(loc => 
			loc.nama.toLowerCase().includes(nameCheck.toLowerCase())
		) || [];
		
		if (matches.length > 0) {
			setSimilarLocations(matches);
		} else {
			proceedToForm();
		}
	};

	const proceedToForm = () => {
		setFormData(prev => ({ ...prev, nama: nameCheck }));
		setStep("form");
	};

	const [gpsError, setGpsError] = useState("");

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
					setGpsError("Gagal mengambil lokasi GPS. Pastikan GPS aktif.");
					console.error(err);
				},
				{ enableHighAccuracy: true }
			);
		} else {
			setGpsError("Browser tidak mendukung GPS.");
		}
	};

	// Auto-get GPS when modal opens
	useEffect(() => {
		if (isOpen) {
			getGPS();
		}
	}, [isOpen]);
	
	const [uploading, setUploading] = useState(false);
	const [preview, setPreview] = useState("");

	const mutation = useMutation({
		mutationFn: async (data: any) => {
			const isEdit = !!initialData;
			const url = isEdit ? API_ENDPOINTS.LOKASI_UPDATE(initialData.id) : API_ENDPOINTS.LOKASI;
			const method = isEdit ? "PATCH" : "POST";

			// For Prisma backend update, map fields correctly
			const payload = {
				nama: data.nama,
				kategori: data.kategori,
				deskripsi: data.deskripsi,
				latitude: data.latitude,
				longitude: data.longitude,
				fotoUtama: data.foto, 
				// Only update verified status if explicitly changed or new
				...(isEdit ? {} : { isVerified: isAdmin, suiAddress: user?.suiAddress || "" })
			};

			console.log(`[${method}] Sending payload to ${url}:`, payload); // Debug Log

			const response = await fetch(url, {
				method: method,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Gagal menyimpan lokasi: ${response.status} ${errorText}`);
			}
			return response.json();
		},
		onSuccess: (data, variables) => {
			alert(initialData ? "Lokasi berhasil diperbarui!" : "Lokasi berhasil ditambahkan!");
			queryClient.invalidateQueries({ queryKey: ["lokasi"] });
			onClose();
		},
		onError: (error) => {
			alert(`Error: ${error.message}`);
		},
	});

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setUploading(true);
		const reader = new FileReader();
		reader.onloadend = () => setPreview(reader.result as string);
		reader.readAsDataURL(file);

		const uploadData = new FormData();
		uploadData.append("foto", file);

		try {
			const res = await fetch(API_ENDPOINTS.UPLOAD, {
				method: "POST",
				body: uploadData,
			});
			const data = await res.json();
			if (data.url) {
				setFormData(prev => ({ ...prev, foto: data.url }));
			}
		} catch (error) {
			alert("Gagal mengunggah foto");
		} finally {
			setUploading(false);
		}
	};

	// Set default category once loaded
	useEffect(() => {
		if (categories && categories.length > 0) {
			setFormData(prev => ({ ...prev, kategori: categories[0] }));
		}
	}, [categories]);

	if (!isOpen) return null;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		// Validate Content
		const nameValid = validateContent(formData.nama);
		if (!nameValid.valid) {
			alert(`Nama Gagal: ${nameValid.reason}`);
			return;
		}

		const descValid = validateContent(formData.deskripsi);
		if (!descValid.valid) {
			alert(`Deskripsi Gagal: ${descValid.reason}`);
			return;
		}

		mutation.mutate(formData);
	};

	return (
		<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 overflow-hidden animate-in fade-in zoom-in duration-200">
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-2xl font-bold text-gray-800">
						{initialData ? "Edit Lokasi" : (step === "check" ? "Cek Lokasi" : "Tambah Lokasi")}
					</h2>
					<button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
						<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				{step === "check" ? (
					<div className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Nama Tempat</label>
							<div className="flex gap-2">
								<input
									type="text"
									className="flex-1 px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
									value={nameCheck}
									onChange={(e) => setNameCheck(e.target.value)}
									placeholder="Nama Tempat atau Event..."
									onKeyDown={(e) => e.key === "Enter" && checkName()}
									autoFocus
								/>
								<button 
									onClick={checkName}
									className="bg-blue-600 text-white px-6 rounded-xl font-bold hover:bg-blue-700 transition-all"
								>
									Cek
								</button>
							</div>
							<p className="text-xs text-gray-500 mt-2">
								Kami akan mengecek apakah lokasi ini sudah pernah ditambahkan sebelumnya.
							</p>
						</div>

						{similarLocations.length > 0 && (
							<div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
								<h3 className="text-sm font-bold text-yellow-800 mb-2">Lokasi Serupa Ditemukan:</h3>
								<div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
									{similarLocations.map(loc => (
										<div key={loc.id} className="bg-white p-2 rounded-lg border border-yellow-100 flex justify-between items-center">
											<span className="text-xs font-medium">{loc.nama}</span>
											<span className="text-[10px] bg-gray-100 px-2 py-1 rounded text-gray-500">{loc.kategori}</span>
										</div>
									))}
								</div>
								<p className="text-xs text-yellow-700 mb-3">
									Apakah maksud Anda salah satu di atas? Jika ya, Anda tidak perlu menambahkannya lagi.
								</p>
								<button 
									onClick={proceedToForm}
									className="w-full bg-white border border-yellow-300 text-yellow-800 font-bold py-2 rounded-lg hover:bg-yellow-100 transition-all text-sm"
								>
									Tetap Lanjut (Bukan Lokasi Di Atas)
								</button>
							</div>
						)}
					</div>
				) : (
					<form onSubmit={handleSubmit} className="space-y-4 animate-in fade-in slide-in-from-right duration-300">
						{/* Back button for add mode */}
						{!initialData && (
							<button 
								type="button" 
								onClick={() => setStep("check")}
								className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
							>
								← Kembali cek nama
							</button>
						)}

						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Nama Lokasi</label>
							<input
								type="text"
								required
								className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
								value={formData.nama}
								onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
								placeholder="Nama Wisata..."
							/>
						</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Kategori</label>
						<select
							className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
							value={formData.kategori}
							disabled={isCategoriesLoading}
							onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
						>
							{isCategoriesLoading ? (
								<option>Memuat kategori...</option>
							) : (
								categories?.map((cat) => (
									<option key={cat} value={cat}>
										{cat}
									</option>
								))
							)}
						</select>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi</label>
						<textarea
							required
							className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all h-24 resize-none"
							value={formData.deskripsi}
							onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })}
							placeholder="Jelaskan sedikit tentang tempat ini..."
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Latitude</label>
							<input
								type="number"
								step="any"
								required
								readOnly={!isAdmin}
								className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
									!isAdmin ? "bg-gray-100 cursor-not-allowed text-gray-500" : ""
								}`}
								value={formData.latitude}
								onChange={(e) => isAdmin && setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
							<input
								type="number"
								step="any"
								required
								readOnly={!isAdmin}
								className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
									!isAdmin ? "bg-gray-100 cursor-not-allowed text-gray-500" : ""
								}`}
								value={formData.longitude}
								onChange={(e) => isAdmin && setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
							/>
						</div>
					</div>

					<div className="flex items-center justify-between text-xs">
						{gpsError ? (
							<span className="text-red-500 font-medium">{gpsError}</span>
						) : (
							<span className="text-green-600 font-medium flex items-center gap-1">
								<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
								GPS Otomatis Terisi
							</span>
						)}
						<button 
							type="button" 
							onClick={getGPS}
							className="text-blue-600 hover:text-blue-800 font-bold underline decoration-dotted"
						>
							Refresh GPS
						</button>
					</div>

					<div>
						<label className="block text-sm font-medium text-gray-700 mb-1">Foto Lokasi</label>
						<div 
							onClick={() => fileInputRef.current?.click()}
							className="relative w-full h-32 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-all overflow-hidden"
						>
							{preview ? (
								<>
									<img src={preview} alt="Preview" className="w-full h-full object-cover" />
									<div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
										<Camera className="text-white" size={24} />
									</div>
								</>
							) : (
								<>
									{uploading ? <Loader2 className="animate-spin text-blue-600" /> : <Camera className="text-gray-400 mb-1" />}
									<span className="text-xs text-gray-400">{uploading ? "Mengunggah..." : "Ambil/Pilih Foto"}</span>
								</>
							)}
						</div>
						<input 
							type="file" 
							ref={fileInputRef} 
							onChange={handleFileChange} 
							accept="image/*" 
							className="hidden" 
						/>
					</div>

					<div className="pt-4 flex gap-3">
						<button
							type="button"
							onClick={onClose}
							className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors font-medium"
						>
							Batal
						</button>
						<button
							type="submit"
							disabled={mutation.isPending}
							className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors shadow-md disabled:opacity-50"
						>
							{mutation.isPending ? "Menyimpan..." : (initialData ? "Simpan Perubahan" : "Simpan Lokasi")}
						</button>
					</div>
				</form>
				)}
			</div>
		</div>
	);
}
