// app/users/[peer]/page.tsx
import dynamic from "next/dynamic";
import type { Metadata } from "next";

interface GenerateMetaProps {
  params: { peer: string | string[] };
}

// 1) Este page.tsx NO debe llevar "use client" ni usar useParams
export async function generateMetadata({
  params,
}: GenerateMetaProps): Promise<Metadata> {
  const raw = params.peer;
  const peer = Array.isArray(raw) && raw.length > 0 ? raw[0] : (raw as string);
  const url = `https://pinggate.lopezonchain.xyz/users/${peer}`;

  return {
    title: `User Profile • ${peer}`,
    description: `View services offered by ${peer}`,
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: "https://pinggate.lopezonchain.xyz/PingGateLogo.png",
        button: {
          title: "Launch PingGate 💬",
          action: {
            type: "launch_frame",
            url,
            name: `User • ${peer}`,
            splashImageUrl: "https://pinggate.lopezonchain.xyz/PingGateLogo.png",
            splashBackgroundColor: "#17101f",
          },
        },
      }),
    },
  };
}

// 2) Aquí hacemos dynamic import de la parte cliente
const ClientUser = dynamic<{ peerAddress: string }>(
  () => import("./ClientUser"),
  { ssr: false }
);

export default function UserProfilePage({
  params,
}: {
  params: { peer: string | string[] };
}) {
  const raw = params.peer;
  const peer = Array.isArray(raw) && raw.length > 0 ? raw[0] : (raw as string);
  if (!peer) return null;

  return <ClientUser peerAddress={peer} />;
}
