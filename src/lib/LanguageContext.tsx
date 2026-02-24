"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Language, translations } from "./translations";

interface LanguageContextType {
	lang: Language;
	t: any;
	changeLanguage: (newLang: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
	const [lang, setLang] = useState<Language>("id");

	useEffect(() => {
		const savedLang = localStorage.getItem("app_lang") as Language;
		if (savedLang) setLang(savedLang);
	}, []);

	const changeLanguage = (newLang: Language) => {
		setLang(newLang);
		localStorage.setItem("app_lang", newLang);
	};

	const t = translations[lang];

	return (
		<LanguageContext.Provider value={{ lang, t, changeLanguage }}>
			{children}
		</LanguageContext.Provider>
	);
}

export function useLanguage() {
	const context = useContext(LanguageContext);
	if (context === undefined) {
		throw new Error("useLanguage must be used within a LanguageProvider");
	}
	return context;
}
