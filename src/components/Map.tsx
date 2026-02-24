"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Lokasi } from "@/lib/types";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/lib/api";
import { useAdmin } from "@/hooks/useAdmin";

// Custom Marker Generator
const getCategoryIcon = (kategori: string) => {
	let color = "#3b82f6"; // Default Blue
	let iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;

	const cat = kategori?.toLowerCase() || "";

	if (cat.includes("alam")) {
		color = "#10b981"; // Green
		iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-5"></path><path d="M9 12l3-3 3 3"></path><path d="M7 17l5-5 5 5"></path><path d="M5 22l7-7 7 7"></path></svg>`;
	} else if (cat.includes("sejarah") || cat.includes("budaya")) {
		color = "#f59e0b"; // Orange/Gold
		iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M3 7v1a3 3 0 0 0 6 0V7"></path><path d="M9 7v1a3 3 0 0 0 6 0V7"></path><path d="M15 7v1a3 3 0 0 0 6 0V7"></path><path d="M19 21v-4a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v4"></path><path d="M9 7h6"></path><path d="M12 3v4"></path></svg>`;
	} else if (cat.includes("kuliner") || cat.includes("kafe")) {
		color = "#ef4444"; // Red
		iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1"></path><path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"></path><line x1="6" y1="2" x2="6" y2="4"></line><line x1="10" y1="2" x2="10" y2="4"></line><line x1="14" y1="2" x2="14" y2="4"></line></svg>`;
	} else if (cat.includes("penginapan") || cat.includes("hotel")) {
		color = "#3b82f6"; // Blue
		iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"></path><path d="M2 8h18a2 2 0 0 1 2 2v10"></path><path d="M2 17h20"></path><path d="M6 8v9"></path></svg>`;
	} else if (cat.includes("fasilitas") || cat.includes("masjid") || cat.includes("publik")) {
		color = "#6366f1"; // Indigo
		iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M13 21V11l4-2v12"></path><path d="M7 15h2"></path><path d="M7 11h2"></path></svg>`;
	}

	return L.divIcon({
		className: "custom-marker",
		html: `
			<div style="
				background-color: ${color};
				width: 36px;
				height: 36px;
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 50% 50% 50% 0;
				transform: rotate(-45deg);
				border: 3px solid white;
				box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
				color: white;
			">
				<div style="transform: rotate(45deg); display: flex;">
					${iconSvg}
				</div>
			</div>
		`,
		iconSize: [36, 36],
		iconAnchor: [18, 36],
		popupAnchor: [0, -36],
	});
};

interface MapProps {
	onCheckIn: (lokasiId: number, lat: number, lng: number) => void;
}

export default function Map({ onCheckIn }: MapProps) {
	const center: [number, number] = [-5.2255, 120.2647];
	const zoom = 12;
	const { isAdmin } = useAdmin();
	const [userPos, setUserPos] = useState<[number, number] | null>(null);

	// Track User Position Live
	useEffect(() => {
		if ("geolocation" in navigator) {
			const watchId = navigator.geolocation.watchPosition(
				(pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
				(err) => console.error(err),
				{ enableHighAccuracy: true }
			);
			return () => navigator.geolocation.clearWatch(watchId);
		}
	}, []);

	const { data: lokasiData, isLoading, error } = useQuery<any[]>({
		queryKey: ["lokasi"],
		queryFn: async () => {
			try {
				const res = await fetch(API_ENDPOINTS.LOKASI);
				if (!res.ok) throw new Error("Failed to fetch locations");
				const data = await res.json();
				
				// Map backend data to frontend model (Consistent with page.tsx)
				const mappedData = data.map((item: any) => {
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
						status: status,
						foto: item.fotoUtama || item.foto
					};
				});

				return mappedData;
			} catch (err) {
				console.error("Map: Failed to fetch locations:", err);
				return [];
			}
		},
	});

	// Filter data: Only show verified (status 1) locations on the map
	const filteredData = (lokasiData || []).filter(item => 
		item.status === 1 || item.status === "approved"
	);

	if (isLoading) return <div className="flex h-[600px] w-full items-center justify-center bg-gray-100 rounded-xl">Memuat peta...</div>;
	if (error) return <div className="flex h-[600px] w-full items-center justify-center bg-red-100 rounded-xl">Terjadi kesalahan saat memuat data lokasi.</div>;

	return (
		<div className="h-[600px] w-full rounded-xl overflow-hidden shadow-lg border-4 border-white">
			<MapContainer center={center} zoom={zoom} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
				/>

				{/* Live User Position */}
				{userPos && (
					<Marker 
						position={userPos} 
						icon={L.divIcon({
							className: "user-marker",
							html: `
								<div style="position: relative;">
									<div style="width: 16px; height: 16px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.3);"></div>
									<div style="position: absolute; top: 0; left: 0; width: 16px; height: 16px; background: #3b82f6; border-radius: 50%; animation: pulse 2s infinite; z-index: -1;"></div>
								</div>
								<style>
									@keyframes pulse {
										0% { transform: scale(1); opacity: 0.8; }
										100% { transform: scale(3); opacity: 0; }
									}
								</style>
							`,
							iconSize: [16, 16],
							iconAnchor: [8, 8]
						})}
					/>
				)}

				{filteredData.map((lokasi) => (
					<Marker 
						key={lokasi.id} 
						position={[lokasi.latitude, lokasi.longitude]}
						icon={getCategoryIcon(lokasi.kategori)}
					>
						<Popup>
							<div className="p-2">
								<h3 className="font-bold text-lg mb-1">{lokasi.nama}</h3>
								<span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mb-2">
									{lokasi.kategori}
								</span>
								<p className="text-sm text-gray-600 mb-4">{lokasi.deskripsi}</p>
								<button
									onClick={() => onCheckIn(lokasi.id, lokasi.latitude, lokasi.longitude)}
									className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors"
								>
									Check-In
								</button>
							</div>
						</Popup>
					</Marker>
				))}
			</MapContainer>
		</div>
	);
}
