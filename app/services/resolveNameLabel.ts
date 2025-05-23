import { createPublicClient, http } from "viem";
import { WarpcastService } from "./warpcastService";
import { mainnet } from "viem/chains";

const warpcast = new WarpcastService();

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://eth.llamarpc.com"),
});

export async function resolveNameLabel(address: string): Promise<string> {
  const lower = address.toLowerCase();

// 2️⃣  ENS reverse
  try {
    const ensName = await publicClient.getEnsName({ address: lower as `0x${string}` });
    if (ensName) return ensName;
  } catch (e) {
    console.warn("ENS reverse lookup failed:", e);
  }


  return lower;
}

export function shortenAddress(addr: string): string {
  return addr.slice(0, 5) + "…" + addr.slice(-4);
}
