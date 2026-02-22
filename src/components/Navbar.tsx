"use client";

import { ConnectButton } from "@mysten/dapp-kit";
import Link from "next/link";

export default function Navbar() {
	return (
		<nav className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-md">
			<div className="container mx-auto flex h-16 items-center justify-between px-4">
				<Link href="/" className="flex items-center gap-2">
					<span className="text-xl font-bold tracking-tight text-primary">
						Sinjai<span className="text-blue-600">Pass</span>
					</span>
				</Link>

				<div className="flex items-center gap-4">
					<ConnectButton />
				</div>
			</div>
		</nav>
	);
}
