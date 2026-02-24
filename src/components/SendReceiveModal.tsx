"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { Scanner } from "@yudiel/react-qr-scanner";
import { X, Copy, Check, ArrowUpRight, ArrowDownLeft, Scan, Loader2, Coins, Wallet as WalletIcon, Image as ImageIcon } from "lucide-react";
import { useGoogleUser } from "@/hooks/useGoogleUser";
import { Transaction } from "@mysten/sui/transactions";
import { useSuiClient } from "@mysten/dapp-kit";
import { API_ENDPOINTS } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Language } from "@/lib/translations";

interface SendReceiveModalProps {
	isOpen: boolean;
	onClose: () => void;
	mode: "send" | "receive";
	t: any;
	lang: Language;
}

type AssetType = "sui" | "token" | "nft";

export default function SendReceiveModal({ isOpen, onClose, mode, t, lang }: SendReceiveModalProps) {
	const { user, walletKeypair } = useGoogleUser();
	const suiClient = useSuiClient();
	const queryClient = useQueryClient();
	const [activeTab, setActiveTab] = useState<"send" | "receive">(mode);
	const [assetType, setAssetType] = useState<AssetType>("sui");
	const [copied, setCopied] = useState(false);
	const [recipient, setRecipient] = useState("");
	const [amount, setAmount] = useState("");
	const [objectId, setObjectId] = useState(""); // For Tokens (Coin Type) or NFT (Object ID)
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
		if (!recipient || !user) return;
		if (assetType !== "nft" && !amount) return;
		if (assetType !== "sui" && !objectId) return;
		
		setIsSending(true);
		try {
			if (!user.jwt) {
				throw new Error("JWT pengguna hilang, silakan login ulang.");
			}

			if (!walletKeypair) {
				throw new Error("Wallet belum terhubung. Silakan login ulang.");
			}

			// Minta Backend untuk Membuat & Sponsori Transaksi
			// Backend akan mengambil asset dari senderAddress dan gas dari admin wallet
			console.log("Meminta Backend untuk build & sponsor transaksi...");
			
			const sponsorRes = await fetch(API_ENDPOINTS.SPONSOR, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					senderAddress: user.suiAddress,
					recipient,
					amount,
					assetType,
					objectId // Coin Type atau NFT ID
				})
			});

			if (!sponsorRes.ok) {
				const errData = await sponsorRes.json();
				console.error("Sponsor API Error Details:", errData);
				throw new Error(`${t.claim_error}: ${errData.error || sponsorRes.statusText}`);
			}

			const { sponsoredTxBytes, sponsorSignature } = await sponsorRes.json();

			// 4. Sign transaction with wallet keypair
			const txToSign = Transaction.from(sponsoredTxBytes);
			const signedTx = await txToSign.sign({ client: suiClient, signer: walletKeypair });
			console.log("[DEBUG] User Signature Object:", signedTx);
			const userSignature = signedTx.signature;
			if (!userSignature) throw new Error(t.error_send);

			// 5. Execute transaction with both signatures
			console.log("Mengeksekusi transaksi dengan signature:", userSignature);
			const response = await suiClient.executeTransactionBlock({
				transactionBlock: sponsoredTxBytes,
				signature: [userSignature, sponsorSignature],
			});

			console.log("Transaction Success:", response);
			alert(`✅ ${t.success_send} ${assetType.toUpperCase()}!\nDigest: ${response.digest}`);
			queryClient.invalidateQueries({ queryKey: ["suiBalance"] });
			onClose();
		} catch (error: any) {
			console.error("Transaction Error:", error);
			alert(`❌ ${t.error_send}: ${error.message || ""}`);
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
							className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "send" ? "bg-white shadow-sm text-blue-600" : "text-gray-50"}`}
						>
							{t.send}
						</button>
						<button 
							onClick={() => setActiveTab("receive")}
							className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === "receive" ? "bg-white shadow-sm text-green-600" : "text-gray-50"}`}
						>
							{t.receive}
						</button>
					</div>
					<button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
						<X size={20} />
					</button>
				</div>

				<div className="p-6 overflow-y-auto">
					{activeTab === "receive" ? (
						<div className="flex flex-col items-center text-center">
							<h3 className="text-lg font-bold mb-2">{t.wallet_address}</h3>
							<p className="text-xs text-gray-500 mb-6">{t.scan_receive_info}</p>
							
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
									{/* Asset Type Selector */}
									<div className="grid grid-cols-3 gap-2 mb-2">
										<button 
											onClick={() => setAssetType("sui")}
											className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all ${assetType === "sui" ? "border-blue-600 bg-blue-50 text-blue-600" : "border-gray-100 text-gray-400"}`}
										>
											<Coins size={20} />
											<span className="text-[10px] font-bold">SUI</span>
										</button>
										<button 
											onClick={() => setAssetType("token")}
											className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all ${assetType === "token" ? "border-blue-600 bg-blue-50 text-blue-600" : "border-gray-100 text-gray-400"}`}
										>
											<WalletIcon size={20} />
											<span className="text-[10px] font-bold">TOKEN</span>
										</button>
										<button 
											onClick={() => setAssetType("nft")}
											className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all ${assetType === "nft" ? "border-blue-600 bg-blue-50 text-blue-600" : "border-gray-100 text-gray-400"}`}
										>
											<ImageIcon size={20} />
											<span className="text-[10px] font-bold">NFT</span>
										</button>
									</div>

									<div>
										<label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">{t.recipient}</label>
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

									{assetType !== "sui" && (
										<div>
											<label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
												{assetType === "token" ? "Coin Type (ID)" : "Object ID (NFT)"}
											</label>
											<input 
												type="text" 
												placeholder="0x..." 
												className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-blue-500 outline-none transition-all font-mono text-sm"
												value={objectId}
												onChange={(e) => setObjectId(e.target.value)}
											/>
										</div>
									)}

									{assetType !== "nft" && (
										<div>
											<label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">{t.amount}</label>
											<input 
												type="number" 
												placeholder="0.0" 
												className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-transparent focus:bg-white focus:border-blue-500 outline-none transition-all text-lg font-bold"
												value={amount}
												onChange={(e) => setAmount(e.target.value)}
											/>
										</div>
									)}

									<div className="bg-blue-50 p-3 rounded-xl flex items-start gap-2">
										<div className="bg-blue-600 text-white p-1 rounded-md mt-0.5">
											<Check size={12} />
										</div>
										<p className="text-[10px] text-blue-800 leading-tight">
											<strong>{t.gas_sponsored}</strong> {t.gas_sponsored_info}
										</p>
									</div>

									<button 
										onClick={handleSend}
										disabled={!recipient || (assetType !== 'nft' && !amount) || (assetType !== 'sui' && !objectId) || isSending}
										className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
									>
										{isSending ? <Loader2 className="animate-spin" size={20} /> : <ArrowUpRight size={20} />}
										<span>{isSending ? t.sending : t.send_now}</span>
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
