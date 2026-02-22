"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/lib/api";
import { useAdmin } from "@/hooks/useAdmin";
import { useCategories } from "@/hooks/useCategories";
import { Camera, X, Loader2 } from "lucide-react";

interface AddLocationModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function AddLocationModal({ isOpen, onClose }: AddLocationModalProps) {
	const queryClient = useQueryClient();
	const { isAdmin } = useAdmin();
	const { data: categories, isLoading: isCategoriesLoading } = useCategories();
	const fileInputRef = useRef<HTMLInputElement>(null);
	
	const [formData, setFormData] = useState({
		nama: "",
		kategori: "Wisata Alam",
		deskripsi: "",
		latitude: -5.2255,
		longitude: 120.2647,
		is_claim: false,
		status: 0, 
		foto: "",
	});

	const [uploading, setUploading] = useState(false);
	const [preview, setPreview] = useState("");

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setUploading(true);
		const reader = new FileReader();
		reader.onloadend = () => setPreview(reader.result as string);
		reader.readAsDataURL(file);

		const uploadData = new FormData();
		uploadData.append("file", file);

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

	const mutation = useMutation({
		mutationFn: async (newLokasi: any) => {
			const response = await fetch(API_ENDPOINTS.LOKASI, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					...newLokasi,
					status: isAdmin ? 1 : 0 // Auto approved if admin
				}),
			});
			if (!response.ok) throw new Error("Gagal menambahkan lokasi");
			return response.json();
		},
		onSuccess: () => {
			alert("Lokasi berhasil ditambahkan!");
			queryClient.invalidateQueries({ queryKey: ["lokasi"] });
			onClose();
			setFormData({
				nama: "",
				kategori: "Wisata Alam",
				deskripsi: "",
				latitude: -5.2255,
				longitude: 120.2647,
				is_claim: false,
				status: 0,
				foto: "",
			});
			setPreview("");
		},
		onError: (error) => {
			alert(`Error: ${error.message}`);
		},
	});

	if (!isOpen) return null;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		mutation.mutate(formData);
	};

	return (
		<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4">
			<div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 overflow-hidden animate-in fade-in zoom-in duration-200">
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-2xl font-bold text-gray-800">Tambah Lokasi Wisata</h2>
					<button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
						<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
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
								className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
								value={formData.latitude}
								onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) })}
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">Longitude</label>
							<input
								type="number"
								step="any"
								required
								className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
								value={formData.longitude}
								onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) })}
							/>
						</div>
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
							{mutation.isPending ? "Menyimpan..." : "Simpan Lokasi"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
