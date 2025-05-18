
import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import contractAbi from './contractAbi.json';
import { resolveRecipient } from './nameResolver';
import { WalletClient } from 'wagmi';
import { publicClient } from '../viemClient';

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_PING_GATE_CONTRACT as `0x${string}`;

export function getContractConfig() {
  return {
    address: CONTRACT_ADDRESS,
    abi: contractAbi,
  };
}

export async function createService(
  walletClient: WalletClient,
  title: string,
  description: string,
  price: bigint,
  duration: number,
  fee: bigint
) {
  return walletClient.writeContract({
    ...getContractConfig(),
    functionName: 'createService',
    args: [title, description, price, BigInt(duration)],
    value: fee,
  });
}

export async function editService(
  walletClient: WalletClient,
  id: number,
  title: string,
  description: string,
  price: bigint,
  fee: bigint
) {
  return walletClient.writeContract({
    ...getContractConfig(),
    functionName: 'editService',
    args: [BigInt(id), title, description, price],
    value: fee,
  });
}

export async function pauseService(walletClient: WalletClient, id: number) {
  return walletClient.writeContract({
    ...getContractConfig(),
    functionName: 'pauseService',
    args: [BigInt(id)],
  });
}

export async function purchaseService(walletClient: WalletClient, id: number, value: bigint) {
  return walletClient.writeContract({
    ...getContractConfig(),
    functionName: 'purchaseService',
    args: [BigInt(id)],
    value,
  });
}

export async function submitReview(
  walletClient: WalletClient,
  serviceId: number,
  quality: number,
  communication: number,
  timeliness: number,
  comment: string
) {
  return walletClient.writeContract({
    ...getContractConfig(),
    functionName: 'submitReview',
    args: [BigInt(serviceId), quality, communication, timeliness, comment],
  });
}

export async function getActiveServices() {
  return publicClient.readContract({
    ...getContractConfig(),
    functionName: 'getActiveServices',
  });
}

export async function getServicesBy(seller: `0x${string}`) {
  return publicClient.readContract({
    ...getContractConfig(),
    functionName: 'getServicesBy',
    args: [seller],
  });
}

export async function getPurchasesBy(buyer: `0x${string}`) {
  return publicClient.readContract({
    ...getContractConfig(),
    functionName: 'getPurchasesBy',
    args: [buyer],
  });
}

export async function getSalesBy(seller: `0x${string}`) {
  return publicClient.readContract({
    ...getContractConfig(),
    functionName: 'getSalesBy',
    args: [seller],
  });
}

export async function hasPurchased(serviceId: number, user: `0x${string}`) {
  return publicClient.readContract({
    ...getContractConfig(),
    functionName: 'hasPurchased',
    args: [BigInt(serviceId), user],
  });
}
