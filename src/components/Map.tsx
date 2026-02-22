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

// Fix Leaflet icon issue
const DefaultIcon = L.icon({
	iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
	shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
	iconSize: [25, 41],
	iconAnchor: [12, 41],
	popupAnchor: [1, -34],
	shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface MapProps {
	onCheckIn: (lokasiId: number) => void;
}

export default function Map({ onCheckIn }: MapProps) {
	const center: [number, number] = [-5.2255, 120.2647];
	const zoom = 12;
	const { isAdmin } = useAdmin();

	const { data: lokasiData, isLoading, error } = useQuery<any[]>({
		queryKey: ["lokasi"],
		queryFn: async () => {
			const res = await fetch(API_ENDPOINTS.LOKASI);
			if (!res.ok) throw new Error("Failed to fetch locations");
			return res.json();
		},
	});

	// Filter data based on role: User only sees approved (assuming status 1), Admin sees all
	const filteredData = (lokasiData || []).filter(item => isAdmin || item.status === 1 || item.status === "approved" || !item.status);

	if (isLoading) return <div className="flex h-[600px] w-full items-center justify-center bg-gray-100 rounded-xl">Memuat peta...</div>;
	if (error) return <div className="flex h-[600px] w-full items-center justify-center bg-red-100 rounded-xl">Terjadi kesalahan saat memuat data lokasi.</div>;

	return (
		<div className="h-[600px] w-full rounded-xl overflow-hidden shadow-lg border-4 border-white">
			<MapContainer center={center} zoom={zoom} scrollWheelZoom={true} style={{ height: "100%", width: "100%" }}>
				<TileLayer
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
				/>
				{filteredData.map((lokasi) => (
					<Marker key={lokasi.id} position={[lokasi.latitude, lokasi.longitude]}>
						<Popup>
							<div className="p-2">
								<h3 className="font-bold text-lg mb-1">{lokasi.nama}</h3>
								<span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mb-2">
									{lokasi.kategori}
								</span>
								<p className="text-sm text-gray-600 mb-4">{lokasi.deskripsi}</p>
								<button
									onClick={() => onCheckIn(lokasi.id)}
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
