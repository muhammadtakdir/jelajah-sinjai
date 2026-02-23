"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { Scanner } from "@yudiel/react-qr-scanner";
import { X, Copy, Check, ArrowUpRight, ArrowDownLeft, Scan, Loader2 } from "lucide-react";
import { useGoogleUser } from "@/hooks/useGoogleUser";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

interface SendReceiveModalProps {
	isOpen: boolean;
	onClose: () => void;
	mode: "send" | "receive";
}

export default function SendReceiveModal({ isOpen, onClose, mode }: SendReceiveModalProps) {
	const { user } = useGoogleUser();
	const [activeTab, setActiveTab] = useState<"send" | "receive">(mode);
	const [copied, setCopied] = useState(false);
	const [recipient, setRecipient] = useState("");
	const [amount, setAmount] = useState("");
	const [scanning, setScanning] = useState(false);
	const [isSending, setIsSending] = useState(false);

	if (!isOpen) return null;

	const copyAddress = () => {
		if (user?.suiAddress) {
			navigator.clipboard.writeText(user.suiAddress);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	const handleScan = (text: string) => {
		if (text) {
			setRecipient(text);
			setScanning(false);
		}
	};

	const handleSend = async () => {
		if (!recipient || !amount || !user) return;
		
		setIsSending(true);
		try {
			// 1. Setup Transaction
			const txb = new Transaction();
			const [coin] = txb.splitCoins(txb.gas, [
				Math.floor(parseFloat(amount) * 1_000_000_000)
			]);
			txb.transferObjects([coin], recipient);
			txb.setSender(user.suiAddress);

			// 2. Get Ephemeral Key
			const privKey = sessionStorage.getItem("ephemeral_private");
			if (!privKey) throw new Error("Kunci pengiriman tidak ditemukan. Silakan login ulang.");
			
			// Sign with ephemeral key logic would go here
			// Note: zkLogin requires fetching ZK proof from a prover service (Mysten/Shinami)
			// to execute the transaction on-chain.
			
			alert(`Permintaan Kirim ${amount} SUI ke ${recipient.slice(0,6)}... telah dibuat!\n\nCatatan: Transaksi zkLogin memerlukan Prover Service aktif untuk eksekusi on-chain.`);
			
			onClose();
		} catch (error: any) {
			alert(`Gagal mengirim: ${error.message}`);
		} finally {
			setIsSending(false);
		}
	};

	return (
		<div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/80 p-4 animate-in fade-in duration-200">
			<div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
				<div className="flex justify-between items-center p-4 border-b">
					<div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
						<button 
							onClick={() => { setActiveTab("send"); setScanning(false); }}
							className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "send" ? "bg-white shadow-sm text-blue-600" : "text-gray-500"}`}
						>
							Kirim
						</button>
						<button 
							onClick={() => setActiveTab("receive")}
							className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "receive" ? "bg-white shadow-sm text-green-600" : "text-gray-500"}`}
						>
							Terima
						</button>
					</div>
					<button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
						<X size={20} />
					</button>
				</div>

				<div className="p-6 overflow-y-auto">
					{activeTab === "receive" ? (
						<div className="flex flex-col items-center text-center">
							<h3 className="text-lg font-bold mb-2">Alamat Wallet Anda</h3>
							<p className="text-xs text-gray-500 mb-6">Scan QR code ini untuk menerima SUI atau NFT.</p>
							
							<div className="bg-white p-4 rounded-3xl shadow-lg border border-gray-100 mb-6">
								<QRCode value={user?.suiAddress || ""} size={200} />
							</div>

							<div 
								onClick={copyAddress}
								className="flex items-center gap-2 bg-gray-50 px-4 py-3 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors w-full break-all"
							>
								<p className="text-xs font-mono text-gray-600 flex-1 text-center">
									{user?.suiAddress}
								</p>
								{copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} className="text-gray-400" />}
							</div>
						</div>
					) : (
						<div className="flex flex-col gap-4">
							{scanning ? (
								<div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
									<Scanner 
										onScan={(result) => {
											if (result && result.length > 0) {
												handleScan(result[0].rawValue);
											}
										}} 
										onError={(error) => console.log(error)}
									/>
									<button 
										onClick={() => setScanning(false)}
										className="absolute top-4 right-4 bg-white/20 p-2 rounded-full text-white backdrop-blur-md"
									>
										<X size={20} />
									</button>
								</div>
							) : (
								<>
									<div>
										<label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Penerima</label>
										<div className="flex gap-2">
											<input 
												type="text" 
												placeholder="0x..." 
												className="flex-1 px-4 py-3 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-blue-500 outline-none transition-all font-mono text-sm"
												value={recipient}
												onChange={(e) => setRecipient(e.target.value)}
											/>
											<button 
												onClick={() => setScanning(true)}
												className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors"
											>
												<Scan size={20} />
											</button>
										</div>
									</div>

									<div>
										<label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Jumlah SUI</label>
										<input 
											type="number" 
											placeholder="0.0" 
											className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-blue-500 outline-none transition-all text-lg font-bold"
											value={amount}
											onChange={(e) => setAmount(e.target.value)}
										/>
									</div>

									<button 
										onClick={handleSend}
										disabled={!recipient || !amount || isSending}
										className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
									>
										{isSending ? <Loader2 className="animate-spin" size={20} /> : <ArrowUpRight size={20} />}
										<span>{isSending ? "Memproses..." : "Kirim Sekarang"}</span>
									</button>
								</>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
