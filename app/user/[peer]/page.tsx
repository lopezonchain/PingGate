// app/users/[peer]/page.tsx
"use client";

import dynamic from "next/dynamic";
import type { Metadata } from "next";
import { useParams } from "next/navigation";

const UserProfileApp = dynamic(() => import("./ClientUser"), { ssr: false });

interface GenerateMetaProps {
  params: { peer: string };
}

export async function generateMetadata({
  params,
}: GenerateMetaProps): Promise<Metadata> {
  const peer = params.peer;
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

export default function UserProfilePage() {
  const params = useParams();
  const raw = params.peer;

  // Hacer la comprobación en dos pasos para que TS entienda que peerAddress es string
  let peerAddress: string;
  if (Array.isArray(raw)) {
    peerAddress = raw[0];
  } else {
    peerAddress = raw;
  }

  if (!peerAddress) return null;
  return <UserProfileApp peerAddress={peerAddress} />;
}
