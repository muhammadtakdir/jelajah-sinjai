"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";

interface LocationImageProps {
	src?: string;
	alt: string;
	className?: string;
}

export default function LocationImage({ src, alt, className }: LocationImageProps) {
	const [error, setError] = useState(false);

	// Fix relative paths for uploads
	let finalSrc = src;
	if (src && src.startsWith("/uploads/")) {
		const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace("/api", "") || "https://db.sinjaikab.go.id/wisata";
		finalSrc = `${baseUrl}${src}`;
	}

	if (!finalSrc || error) {
		return (
			<div className={`flex flex-col items-center justify-center bg-gray-200 text-gray-400 ${className}`}>
				<MapPin size={24} className="mb-1" />
				<span className="text-[10px]">No Image</span>
			</div>
		);
	}

	return (
		<img 
			src={finalSrc} 
			alt={alt} 
			className={className} 
			onError={() => {
				console.error("Failed to load image:", finalSrc);
				setError(true);
			}}
		/>
	);
}
