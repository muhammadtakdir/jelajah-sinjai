"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import DynamicMap from "@/components/DynamicMap";
import AddLocationModal from "@/components/AddLocationModal";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useMutation } from "@tanstack/react-query";
import { CheckInPayload } from "@/lib/types";
import { API_ENDPOINTS } from "@/lib/api";

export default function Home() {
	const currentAccount = useCurrentAccount();
	const [isModalOpen, setIsModalOpen] = useState(false);

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
		onSuccess: (data) => {
			alert(`✅ Check-In Berhasil! Terima kasih telah berkunjung. Status: ${JSON.stringify(data)}`);
		},
		onError: (error) => {
			alert(`❌ Gagal Check-In: ${error.message}`);
		},
	});

	const handleCheckIn = (lokasiId: number) => {
		if (!currentAccount) {
			alert("⚠️ Silakan hubungkan dompet Sui Anda terlebih dahulu!");
			return;
		}

		checkInMutation.mutate({
			suiAddress: currentAccount.address,
			lokasiId: lokasiId,
		});
	};

	return (
		<main className="min-h-screen bg-slate-50 flex flex-col">
			<Navbar />

			<div className="flex-1 container mx-auto px-4 py-8">
				<div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div>
						<h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl mb-2">
							Jelajah <span className="text-blue-600">Sinjai</span>
						</h1>
						<p className="text-lg text-gray-600 max-w-2xl">
							Temukan destinasi wisata terbaik di Kabupaten Sinjai. 
							Check-in menggunakan wallet Sui Anda untuk mendapatkan reward pariwisata!
						</p>
					</div>

					<button
						onClick={() => setIsModalOpen(true)}
						className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-lg font-bold text-white shadow-lg hover:bg-blue-700 transition-all active:scale-95"
					>
						<svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
						</svg>
						Tambah Lokasi
					</button>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					<div className="lg:col-span-3">
						<div className="bg-white p-2 rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
							<DynamicMap onCheckIn={handleCheckIn} />
						</div>
					</div>
					
					<div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 flex flex-col justify-center">
						<div className="text-center">
							<div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
								<svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
								</svg>
							</div>
							<h3 className="text-xl font-bold mb-2">Ekosistem Web3 Sinjai</h3>
							<p className="text-gray-500 text-sm">
								Platform pariwisata berbasis blockchain pertama di Sulawesi Selatan yang terintegrasi dengan jaringan Sui.
							</p>
						</div>
					</div>

					<div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 flex flex-col justify-center">
						<div className="text-center">
							<div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
								<svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							<h3 className="text-xl font-bold mb-2">Verifikasi Transparan</h3>
							<p className="text-gray-500 text-sm">
								Setiap check-in tercatat di blockchain untuk memastikan kunjungan Anda valid dan mendukung statistik pariwisata daerah.
							</p>
						</div>
					</div>

					<div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100 flex flex-col justify-center">
						<div className="text-center">
							<div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
								<svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
								</svg>
							</div>
							<h3 className="text-xl font-bold mb-2">Check-In & Reward</h3>
							<p className="text-gray-500 text-sm">
								Hubungkan dompet Anda, kunjungi lokasinya, dan lakukan check-in untuk mengumpulkan poin reward yang bisa ditukarkan.
							</p>
						</div>
					</div>
				</div>
			</div>

			<footer className="bg-white border-t py-8 text-center text-gray-500 text-sm mt-auto">
				<p>© 2026 Pemerintah Kabupaten Sinjai - Dinas Pariwisata & Kebudayaan. Diberdayakan oleh Sui Network.</p>
			</footer>

			<AddLocationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
		</main>
	);
}
