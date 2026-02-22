const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://db.sinjaikab.go.id/wisata/api";

export const API_ENDPOINTS = {
	LOKASI: `${API_BASE_URL}/lokasi`,
	LOKASI_DETAIL: (id: number) => `${API_BASE_URL}/lokasi/${id}`,
	LOKASI_UPDATE: (id: number) => `${API_BASE_URL}/lokasi/${id}`,
	LOKASI_DELETE: (id: number) => `${API_BASE_URL}/lokasi/${id}`,
	CHECKIN: `${API_BASE_URL}/checkin`,
	UPLOAD: `${API_BASE_URL}/upload`,
	USER_HISTORY: (suiAddress: string) => `${API_BASE_URL}/user/${suiAddress}/riwayat`,
	USER_REGISTER: `${API_BASE_URL}/user`,
	LEADERBOARD: `${API_BASE_URL}/leaderboard`,
};
