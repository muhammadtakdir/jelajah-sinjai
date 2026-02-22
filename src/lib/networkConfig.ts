import { createNetworkConfig } from "@mysten/dapp-kit";

const testnetUrl = process.env.NEXT_PUBLIC_SUI_TESTNET_URL || "https://fullnode.testnet.sui.io:443";
const mainnetUrl = process.env.NEXT_PUBLIC_SUI_MAINNET_URL || "https://fullnode.mainnet.sui.io:443";

const { networkConfig, useNetworkVariable, useNetworkVariables } =
	createNetworkConfig({
		testnet: { 
			url: testnetUrl,
			network: "testnet" 
		},
		mainnet: { 
			url: mainnetUrl,
			network: "mainnet" 
		},
	});

export { networkConfig, useNetworkVariable, useNetworkVariables };
