// app/conversation/[peer]/page.tsx
import dynamic from "next/dynamic";
import type { Metadata } from "next";

interface GenerateMetaProps {
  params: { peer: string | string[] };
}

export async function generateMetadata({
  params,
}: GenerateMetaProps): Promise<Metadata> {
  const raw = params.peer;
  const peerWallet = Array.isArray(raw) && raw.length > 0 ? raw[0] : (raw as string);
  const fullUrl = `https://pinggate.lopezonchain.xyz/conversation/${peerWallet}`;

  // Intentamos obtener nombre de Farcaster, si falla (CORS o API 403) usamos wallet truncada
  let nameOrWallet: string;
  try {
    const { WarpcastService } = await import("../../services/warpcastService");
    const svc = new WarpcastService();
    const [bio] = await svc.getWeb3BioProfiles([`farcaster,${peerWallet}`]);
    nameOrWallet = bio?.displayName || `${peerWallet.slice(0, 6)}…${peerWallet.slice(-4)}`;
  } catch {
    nameOrWallet = `${peerWallet.slice(0, 6)}…${peerWallet.slice(-4)}`;
  }

  const peer = nameOrWallet.length > 24
    ? nameOrWallet.slice(0, 24) + "..."
    : nameOrWallet;

  return {
    title: `Conversation • ${peer}`,
    description: `Wallet to wallet chat with ${peer}`,
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: "https://pinggate.lopezonchain.xyz/PingGateLogo.png",
        button: {
          title: `Ping ${peer}`,
          action: {
            type: "launch_frame",
            url: fullUrl,
            name: `Ping ${peer}`,
            splashImageUrl: "https://pinggate.lopezonchain.xyz/PingGateLogo.png",
            splashBackgroundColor: "#17101f",
          },
        },
      }),
    },
  };
}

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
