// src/services/contractService.ts

import { createPublicClient, http, type WalletClient } from "viem";
import { base } from "viem/chains";
import contractAbi from "./contractAbi.json";
import { resolveEnsName } from "./nameResolver";
import { WarpcastService } from "./warpcastService";

const CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_PING_GATE_CONTRACT! as `0x${string}`;

// Public read‐only client
const publicClient = createPublicClient({
  chain: base,
  transport: http(
    "https://base.llamarpc.com"
  ),
});

function getContractConfig() {
  return {
    address: CONTRACT_ADDRESS,
    abi: contractAbi,
  } as const;
}

export interface Service {
  id: bigint;
  seller: `0x${string}`;
  title: string;
  description: string;
  price: bigint;
  duration: bigint;
  active: boolean;
}

export interface PurchaseRecord {
  serviceId: bigint;
  buyer: `0x${string}`;
  timestamp: bigint;
}

/**
 * Resolve hex, ENS or Farcaster name → 0x…
 */
export async function resolveRecipient(
  raw: string
): Promise<`0x${string}`> {
  const input = raw.trim();
  if (input.startsWith("0x")) return input as `0x${string}`;
  const name = input.replace(/^@/, "");
  if (name.toLowerCase().endsWith(".eth")) {
    return resolveEnsName(name);
  }
  const svc = new WarpcastService();
  const fid = await svc.getFidByName(name);
  const [res] = await svc.getPrimaryAddresses([fid], "ethereum");
  if (!res.success || !res.address) {
    throw new Error(`No address for "${raw}"`);
  }
  return res.address.address as `0x${string}`;
}

// ───────────────────────────────────────────────────────────────
// READ (view) FUNCTIONS
// ───────────────────────────────────────────────────────────────

/** Fetch a single service by ID */
export async function getService(
  id: bigint
): Promise<Service> {
  return (await publicClient.readContract({
    ...getContractConfig(),
    functionName: "services",
    args: [id],
  })) as Service;
}

/** List all active services */
export async function getActiveServices(): Promise<Service[]> {
  return (await publicClient.readContract({
    ...getContractConfig(),
    functionName: "getActiveServices",
  })) as Service[];
}

/** Get service IDs by seller */
export async function getServicesBy(
  seller: `0x${string}`
): Promise<bigint[]> {
  return (await publicClient.readContract({
    ...getContractConfig(),
    functionName: "getServicesBy",
    args: [seller],
  })) as bigint[];
}

/** Get purchased service IDs by buyer */
export async function getPurchasesBy(
  buyer: `0x${string}`
): Promise<bigint[]> {
  return (await publicClient.readContract({
    ...getContractConfig(),
    functionName: "getPurchasesBy",
    args: [buyer],
  })) as bigint[];
}

/** Get full sales records received by a seller */
export async function getSalesBy(
  seller: `0x${string}`
): Promise<PurchaseRecord[]> {
  return (await publicClient.readContract({
    ...getContractConfig(),
    functionName: "getSalesBy",
    args: [seller],
  })) as PurchaseRecord[];
}

/** Check if user purchased a given service */
export async function hasPurchased(
  serviceId: number,
  user: `0x${string}`
): Promise<boolean> {
  return (await publicClient.readContract({
    ...getContractConfig(),
    functionName: "hasPurchased",
    args: [BigInt(serviceId), user],
  })) as boolean;
}

/** Fetch average rating (0–5) for a service */
export async function getAverageRating(
  serviceId: bigint
): Promise<number> {
  const r = await publicClient.readContract({
    ...getContractConfig(),
    functionName: "averageRating",
    args: [serviceId],
  });
  return Number(r as bigint);
}

/** Fetch a single review for a service by buyer */
export async function getReview(
  serviceId: bigint,
  buyer: `0x${string}`
): Promise<{
  quality: number;
  communication: number;
  timeliness: number;
  comment: string;
  timestamp: bigint;
}> {
  const res = (await publicClient.readContract({
    ...getContractConfig(),
    functionName: "reviews",
    args: [serviceId, buyer],
  })) as [bigint, bigint, bigint, string, bigint];
  const [quality, communication, timeliness, comment, timestamp] = res;
  return {
    quality: Number(quality),
    communication: Number(communication),
    timeliness: Number(timeliness),
    comment,
    timestamp,
  };
}

// ───────────────────────────────────────────────────────────────
// WRITE (transaction) FUNCTIONS
// ───────────────────────────────────────────────────────────────

/** Create a new service (pay creationFee) */
export async function createService(
  walletClient: WalletClient,
  title: string,
  description: string,
  price: bigint,
  duration: number,
  fee: bigint
) {
  return walletClient.writeContract({
    account: walletClient.account ?? null,
    chain: base,               // ← forzamos Base aquí
    ...getContractConfig(),
    functionName: "createService",
    args: [title, description, price, BigInt(duration)],
    value: fee,
  });
}

/** Edit an existing service (pay editFee) */
export async function editService(
  walletClient: WalletClient,
  id: bigint,
  title: string,
  description: string,
  price: bigint
) {
  return walletClient.writeContract({
    account: walletClient.account ?? null,
    chain: base,
    ...getContractConfig(),
    functionName: "editService",
    args: [id, title, description, price],
  });
}

/** Pause a service */
export async function pauseService(
  walletClient: WalletClient,
  id: bigint
) {
  return walletClient.writeContract({
    account: walletClient.account ?? null,
    chain: base,
    ...getContractConfig(),
    functionName: "pauseService",
    args: [id],
  });
}

/** Purchase a service (unlock contact) */
export async function purchaseService(
  walletClient: WalletClient,
  id: bigint,
  value: bigint
) {
  return walletClient.writeContract({
    account: walletClient.account ?? null,
    chain: base,
    ...getContractConfig(),
    functionName: "purchaseService",
    args: [id],
    value,
  });
}

/** Submit or update a review (scores + comment) */
export async function submitReview(
  walletClient: WalletClient,
  serviceId: bigint,
  quality: number,
  communication: number,
  timeliness: number,
  comment: string
) {
  return walletClient.writeContract({
    account: walletClient.account ?? null,
    chain: base,
    ...getContractConfig(),
    functionName: "submitReview",
    args: [
      serviceId,
      quality,
      communication,
      timeliness,
      comment,
    ],
  });
}

/**
 * Fetch the on-chain creation fee (in wei)
 */
export async function getCreationFee(): Promise<bigint> {
  return publicClient.readContract({
    ...getContractConfig(),
    functionName: "creationFee",
  }) as Promise<bigint>;
}

/**
 * Fetch the on-chain edit fee (in wei)
 */
export async function getEditFee(): Promise<bigint> {
  return publicClient.readContract({
    ...getContractConfig(),
    functionName: "editFee",
  }) as Promise<bigint>;
}

