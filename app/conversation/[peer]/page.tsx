// app/conversation/[peer]/page.tsx
import dynamic from "next/dynamic";
import type { Metadata } from "next";
import React from "react";

interface GenerateMetaProps {
  params: { peer: string | string[] };
}

export async function generateMetadata({
  params,
}: GenerateMetaProps): Promise<Metadata> {
  const raw = params.peer;
  const peerWallet =
    Array.isArray(raw) && raw.length > 0 ? raw[0] : (raw as string);
  const fullUrl = `https://pinggate.lopezonchain.xyz/conversation/${peerWallet}`;

  // Resolver nombre con Web3.bio (o fallback truncado)
  let displayName: string;
  try {
    const { WarpcastService } = await import("../../services/warpcastService");
    const svc = new WarpcastService();
    const [bio] = await svc.getWeb3BioProfiles([`farcaster,${peerWallet}`]);
    displayName = bio?.displayName || `${peerWallet.slice(0, 6)}…${peerWallet.slice(-4)}`;
  } catch {
    displayName = `${peerWallet.slice(0, 6)}…${peerWallet.slice(-4)}`;
  }

  // Construir etiqueta "PING {name} 💬" con máximo 32 caracteres
  let label = `PING ${displayName} 💬`;
  if (label.length > 32) {
    // recortamos para que queden 29 chars + "..."
    const maxNameLen = 32 - "PING  💬".length - 3; // 3 puntos
    const truncated = displayName.slice(0, maxNameLen);
    label = `PING ${truncated}... 💬`;
  }

  return {
    title: `PingGate 💬`,
    description: `Wallet to wallet chat with ${displayName}`,
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: "https://pinggate.lopezonchain.xyz/PingGateLogo.png",
        button: {
          title: label,
          action: {
            type: "launch_frame",
            url: fullUrl,
            name: label,
            splashImageUrl: "https://pinggate.lopezonchain.xyz/PingGateLogo.png",
            splashBackgroundColor: "#17101f",
          },
        },
      }),
    },
  };
}

// Fallback para mostrar mientras React carga el bundle
function LoadingConversation() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[#0f0d14] text-white">
      <p className="text-gray-400">Loading Conversation…</p>
    </div>
  );
}

const ClientConversation = dynamic<{ peerAddress: string }>(
  () => import("./ClientConversation"),
  {
    ssr: false,
    loading: () => <LoadingConversation />,
  }
);

export default function ConversationPage({
  params,
}: {
  params: { peer: string | string[] };
}) {
  const raw = params.peer;
  const peer =
    Array.isArray(raw) && raw.length > 0 ? raw[0] : (raw as string);
  if (!peer) return null;

  return <ClientConversation peerAddress={peer} />;
}
