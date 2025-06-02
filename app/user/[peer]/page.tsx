// app/users/[peer]/page.tsx
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
  const peer =
    Array.isArray(raw) && raw.length > 0 ? raw[0] : (raw as string);
  const url = `https://pinggate.lopezonchain.xyz/user/${peer}`;

  return {
    title: `User Profile • ${peer}`,
    description: `View services offered by ${peer}`,
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: "https://pinggate.lopezonchain.xyz/PingGateLogo.png",
        button: {
          title: `User • ${peer}`,
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

// Fallback para mostrar mientras React carga el bundle
function LoadingUser() {
  return (
    <div className="h-full flex items-center justify-center bg-[#0f0d14] text-white">
      <p className="text-gray-400">Cargando perfil…</p>
    </div>
  );
}

const ClientUser = dynamic<{ peerAddress: string }>(
  () => import("./ClientUser"),
  {
    ssr: false,
    loading: () => <LoadingUser />,
  }
);

export default function UserProfilePage({
  params,
}: {
  params: { peer: string | string[] };
}) {
  const raw = params.peer;
  const peer =
    Array.isArray(raw) && raw.length > 0 ? raw[0] : (raw as string);
  if (!peer) return null;

  return <ClientUser peerAddress={peer} />;
}
