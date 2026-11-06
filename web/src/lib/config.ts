import { defineChain, type Address } from "viem";

const NETWORKS = {
  677: { name: "BOT Chain", rpc: "https://rpc.botchain.ai", explorer: "https://scan.botchain.ai" },
  968: { name: "BOT Chain Testnet", rpc: "https://rpc.bohr.life", explorer: "https://scan.bohr.life" },
} as const;

const env = import.meta.env;
export const chainId = Number(env.VITE_CHAIN_ID ?? 968);
const network = NETWORKS[chainId as keyof typeof NETWORKS];

export const networkName = network?.name ?? `Local chain ${chainId}`;
export const explorerUrl: string | null = network?.explorer ?? null;
export const rpcUrl: string = env.VITE_RPC_URL || network?.rpc || "http://127.0.0.1:8545";
export const apiUrl: string = env.VITE_API_URL ?? "http://localhost:8787";
export const contactEmail: string | undefined = env.VITE_CONTACT_EMAIL || undefined;
export const registryAddress = (env.VITE_REGISTRY_ADDRESS || undefined) as Address | undefined;

export const chain = defineChain({
  id: chainId,
  name: networkName,
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
});
