"use client";

import { useGoogleUser } from "@/hooks/useGoogleUser";
import { useMemo } from "react";

export function useAdmin() {
	const { isAuthenticated, user } = useGoogleUser();
	
	const isAdmin = useMemo(() => {
		if (!isAuthenticated || !user) return false;
		
		const adminEmailsRaw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || "";
		const adminEmails = adminEmailsRaw
			.split(",")
			.map(email => email.trim().toLowerCase());
		
		return adminEmails.includes(user.email.toLowerCase());
	}, [isAuthenticated, user]);

	return {
		isAdmin,
		user
	};
}
