export interface Lokasi {
	id: number;
	nama: string;
	kategori: string;
	deskripsi: string;
	latitude: number;
	longitude: number;
	foto?: string;
	status?: number | string;
	suiAddress?: string;
	created_at?: string;
	updated_at?: string;
}

export interface CheckInPayload {
	suiAddress: string;
	lokasiId: number;
	foto?: string;
	komentar?: string;
}
