const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://db.sinjaikab.go.id/wisata/api";

export const API_ENDPOINTS = {
	LOKASI: `${API_BASE_URL}/lokasi`,
	CHECKIN: `${API_BASE_URL}/checkin`,
	UPLOAD: `${API_BASE_URL}/upload`,
};
