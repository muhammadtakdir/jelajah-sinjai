"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { Language } from "@/lib/translations";
import { useLanguage } from "@/lib/LanguageContext";

interface DynamicMapProps {
	onCheckIn: (lokasiId: number, lat: number, lng: number) => void;
}

export default function DynamicMap({ onCheckIn }: DynamicMapProps) {
	const { lang, t } = useLanguage();
	const Map = useMemo(
		() =>
			dynamic(() => import("@/components/Map"), {
				loading: () => <div className="h-[600px] w-full bg-gray-100 animate-pulse flex items-center justify-center rounded-xl">{t.loading} Map...</div>,
				ssr: false,
			}),
		[t.loading]
	);

	return <Map onCheckIn={onCheckIn} />;
}
