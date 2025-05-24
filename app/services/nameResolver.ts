// src/services/ensResolver.ts

import { createPublicClient, http } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";
import { WarpcastService } from "./warpcastService";

// Create a dedicated ENS client on Ethereum Mainnet
export const ensClient = createPublicClient({
  chain: mainnet,
  transport: http(process.env.NEXT_PUBLIC_ETH_RPC_URL || "https://eth.llamarpc.com"),
});

/**
 * Resolve an ENS name to an Ethereum address using the ENS client.
 * @param name - ENS name (e.g. "alice.eth")
 * @throws if the name cannot be resolved
 */
export async function resolveEnsName(name: string): Promise<`0x${string}`> {
  const normalized = normalize(name);
  const address = await ensClient.getEnsAddress({ name: normalized });
  if (!address) {
    throw new Error(`Could not resolve ENS name: ${name}`);
  }
  return address as `0x${string}`;
}

/**
 * Helper: resuelve una cadena que puede ser:
 *   - dirección hex (“0x…”)
 *   - nombre ENS
 *   - fname de Farcaster
 */
export async function resolveRecipient(raw: string): Promise<`0x${string}`> {
  const input = raw.trim();
  // 1️⃣ Si ya es dirección hex, devolvemos tal cual
  if (input.startsWith("0x")) {
    return input as `0x${string}`;
  }

  // Limpiamos posible '@' y normalizamos
  const name = input.replace(/^@/, "");

  // 2️⃣ Si acaba en .eth → ENS
  if (name.toLowerCase().endsWith(".eth")) {
    return resolveEnsName(name);
  }

  // 3️⃣ En cualquier otro caso, asumimos fname de Farcaster
  const svc = new WarpcastService();
  const fid = await svc.getFidByName(name);
  const [res] = await svc.getPrimaryAddresses([fid], "ethereum");
  if (!res.success || !res.address) {
    throw new Error(`Not address found for "${raw}"`);
  }
  return res.address.address as `0x${string}`;
}