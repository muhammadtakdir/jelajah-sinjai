"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { Language } from "@/lib/translations";

interface DynamicMapProps {
	onCheckIn: (lokasiId: number, lat: number, lng: number) => void;
	lang: Language;
	t: any;
}

export default function DynamicMap({ onCheckIn, lang, t }: DynamicMapProps) {
	const Map = useMemo(
		() =>
			dynamic(() => import("@/components/Map"), {
				loading: () => <div className="h-[600px] w-full bg-gray-100 animate-pulse flex items-center justify-center rounded-xl">{t.loading} Map...</div>,
				ssr: false,
			}),
		[t.loading]
	);

	return <Map onCheckIn={onCheckIn} lang={lang} t={t} />;
}
