"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

interface DynamicMapProps {
	onCheckIn: (lokasiId: number, lat: number, lng: number) => void;
}

export default function DynamicMap({ onCheckIn }: DynamicMapProps) {
	const Map = useMemo(
		() =>
			dynamic(() => import("@/components/Map"), {
				loading: () => <div className="h-[600px] w-full bg-gray-100 animate-pulse flex items-center justify-center rounded-xl">Memuat Map...</div>,
				ssr: false,
			}),
		[]
	);

	return <Map onCheckIn={onCheckIn} />;
}
