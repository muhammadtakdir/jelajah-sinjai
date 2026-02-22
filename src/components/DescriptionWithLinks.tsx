"use client";

import React from "react";

interface DescriptionWithLinksProps {
	text: string;
	className?: string;
}

export default function DescriptionWithLinks({ text, className }: DescriptionWithLinksProps) {
	if (!text) return null;

	// Regex to find phone numbers starting with 08, 628, or +628
	// Min 10 digits, max 14 digits
	const phoneRegex = /(?:\+62|62|0)8[0-9]{8,12}\b/g;

	const parts = text.split(phoneRegex);
	const matches = text.match(phoneRegex);

	if (!matches) {
		return <p className={className}>{text}</p>;
	}

	return (
		<p className={className}>
			{parts.map((part, index) => (
				<React.Fragment key={index}>
					{part}
					{matches[index] && (
						<a
							href={`https://wa.me/${matches[index].replace(/^0/, "62").replace(/^\+/, "")}`}
							target="_blank"
							rel="noopener noreferrer"
							className="text-green-600 font-bold hover:underline inline-flex items-center gap-1 mx-1"
							title="Chat via WhatsApp"
						>
							<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
								<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.96 1.0-3.648-.235-.381A9.873 9.873 0 013.26 9.81c0-5.431 4.411-9.85 9.869-9.85 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.429-4.415 9.849-9.858 9.849" />
							</svg>
							{matches[index]}
						</a>
					)}
				</React.Fragment>
			))}
		</p>
	);
}
