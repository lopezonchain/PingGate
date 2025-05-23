"use client";

import React, { ReactNode, Suspense, useEffect, useState } from "react";
import { WagmiProvider, createConfig, http } from "wagmi";
import {
  base,
  Chain,
  baseSepolia
} from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MiniKitProvider } from "@coinbase/onchainkit/minikit";
import { useWalletClient } from "wagmi";

type ChainType =
  | typeof base
  | typeof baseSepolia;


// 1️⃣ Crear QueryClient para React Query
const queryClient = new QueryClient();

// 2️⃣ Crear wagmi config con todas las chains importadas
const chains: [Chain, ...Chain[]] = [
  base
];


const transports = Object.fromEntries(
  chains.map((chain) => [
    chain.id,
    http(chain.rpcUrls.default.http[0]),
  ])
);

const config = createConfig({
  chains,
  transports,
  ssr: true,
});
export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <MiniKitWrapper>{children}</MiniKitWrapper>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

function MiniKitWrapper({ children }: { children: ReactNode }) {
  const { data: walletClient } = useWalletClient();
  const [selectedChain, setSelectedChain] = useState<ChainType>(base);

  const chainOptions: { label: string; chain: ChainType }[] = [
    { label: "Base", chain: base },
    { label: "Base Sepolia", chain: baseSepolia }
  ];

  useEffect(() => {
    if (walletClient) {
      const found = chainOptions.find((o) => o.chain.id === walletClient.chain.id);
      if (found) {
        setSelectedChain(found.chain);
      }
    }
  }, [walletClient]);

  return (
    <MiniKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={selectedChain}
      config={{
        appearance: {
          mode: "dark",
          theme: "defaul",
          name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME,
          logo: process.env.NEXT_PUBLIC_ICON_URL,
        },
      }}
    >
      <Suspense fallback={<div className="bg-[#0F1E14]">Loading...</div>}>{children}</Suspense>
    </MiniKitProvider>
  );
}
