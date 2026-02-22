"use client";

import { useQuery } from "@tanstack/react-query";

export function useCategories() {
	return useQuery<string[]>({
		queryKey: ["categories"],
		queryFn: async () => {
			const response = await fetch("/categories.txt");
			if (!response.ok) throw new Error("Gagal mengambil daftar kategori");
			const text = await response.text();
			
			// Split by newline (handles \n and \r\n) and remove empty lines
			return text
				.split(/\r?\n/)
				.map(line => line.trim())
				.filter(line => line.length > 0);
		},
		staleTime: 1000 * 60 * 60, // 1 hour
	});
}
