// app/conversation/[peer]/page.tsx
import dynamic from "next/dynamic";
import type { Metadata } from "next";

interface GenerateMetaProps {
  params: { peer: string | string[] };
}

// 1) Este archivo NO lleva "use client"
export async function generateMetadata({
  params,
}: GenerateMetaProps): Promise<Metadata> {
  const raw = params.peer;
  const peerWallet = Array.isArray(raw) && raw.length > 0 ? raw[0] : (raw as string);
  const fullUrl = `https://pinggate.lopezonchain.xyz/conversation/${peerWallet}`;

  const peer = (async () => {
    const svc = new (require("../../../services/warpcastService").WarpcastService)();
    const [bio] = await svc.getWeb3BioProfiles([`farcaster,${peerWallet}`]);
    const name = bio?.displayName || `${peerWallet.slice(0, 6)}…${peerWallet.slice(-4)}`;
    return name.length > 29 ? name.slice(0, 29) + "..." : name;
  })();

  return {
    title: `Conversation • ${peer}`,
    description: `Encrypted chat with ${peer}`,
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: "https://pinggate.lopezonchain.xyz/PingGateLogo.png",
        button: {
          title: "Launch PingGate 💬",
          action: {
            type: "launch_frame",
            url: fullUrl,
            name: `Pîng ${peer}`,
            splashImageUrl: "https://pinggate.lopezonchain.xyz/PingGateLogo.png",
            splashBackgroundColor: "#17101f",
          },
        },
      }),
    },
  };
}

// 2) Componente de servidor que importa dinámicamente el cliente
const ClientConversation = dynamic<{ peerAddress: string }>(
  () => import("./ClientConversation"),
  { ssr: false }
);

export default function ConversationPage({
  params,
}: {
  params: { peer: string | string[] };
}) {
  const raw = params.peer;
  const peer = Array.isArray(raw) && raw.length > 0 ? raw[0] : (raw as string);
  if (!peer) return null;

  return <ClientConversation peerAddress={peer} />;
}
