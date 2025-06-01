// app/conversation/[peer]/page.tsx

import dynamic from "next/dynamic";
import type { Metadata } from "next";

// 1) Importamos dinámicamente el componente cliente (ConversationScreen),
//    para que ‘page.tsx’ pueda seguir siendo un servidor/router.
//    El componente real, que usa useRouter(), estará en ClientConversation.tsx.
const ClientConversation = dynamic(
  () => import("./ClientConversation"),
  { ssr: false }
);

interface GenerateMetaProps {
  params: { peer: string };
}

export async function generateMetadata({
  params,
}: GenerateMetaProps): Promise<Metadata> {
  const peer = params.peer;
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

// 2) Este es el componente “servidor” que Next renderiza para /conversation/[peer].
//    Recibe `params.peer` y lo pasa a ClientConversation, que es 100% cliente.
export default function ConversationPage({
  params,
}: {
  params: { peer: string };
}) {
  const peer = params.peer;
  if (!peer) return null;
  return <ClientConversation peerAddress={peer} />;
}
