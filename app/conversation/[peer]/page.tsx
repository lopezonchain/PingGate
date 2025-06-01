// app/conversation/[peer]/page.tsx
import dynamic from "next/dynamic";
import type { Metadata } from "next";

const ClientConversation = dynamic<{ peerAddress: string }>(
  () => import("./ClientConversation"),
  { ssr: false }
);

interface GenerateMetaProps {
  params: { peer: string | string[] };
}

export async function generateMetadata({
  params,
}: GenerateMetaProps): Promise<Metadata> {
  // Nos aseguramos de obtener un string, incluso si params.peer es arreglo
  const raw = params.peer;
  const peer = Array.isArray(raw) && raw.length > 0 ? raw[0] : raw;
  const fullUrl = `https://pinggate.lopezonchain.xyz/conversation/${peer}`;

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
            name: `Conversation • ${peer}`,
            splashImageUrl: "https://pinggate.lopezonchain.xyz/PingGateLogo.png",
            splashBackgroundColor: "#17101f",
          },
        },
      }),
    },
  };
}

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
