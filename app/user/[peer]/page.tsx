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
  const peerWallet =
    Array.isArray(raw) && raw.length > 0 ? raw[0] : (raw as string);
  const url = `https://pinggate.lopezonchain.xyz/user/${peerWallet}`;

  // Resolver nombre y avatar con Web3.bio. Si falla o no hay avatar, usar logo por defecto.
  let displayName: string;
  let avatarUrl: string | null = null;
  try {
    const { WarpcastService } = await import("../../services/warpcastService");
    const svc = new WarpcastService();
    const [bio] = await svc.getWeb3BioProfiles([`farcaster,${peerWallet}`]);
    displayName =
      bio?.displayName || `${peerWallet.slice(0, 6)}…${peerWallet.slice(-4)}`;
    avatarUrl = bio?.avatar || null;
  } catch {
    displayName = `${peerWallet.slice(0, 6)}…${peerWallet.slice(-4)}`;
  }

  // Truncar a 22 caracteres + "..." si es necesario
  const peerLabel =
    displayName.length > 22 ? displayName.slice(0, 22) + "..." : displayName;

  // Si no hay avatar válido, caer a la imagen fija
  const imageUrl =
    avatarUrl || "https://pinggate.lopezonchain.xyz/PingGateLogo.png";

  return {
    title: `User Profile • ${peerLabel}`,
    description: `View services offered by ${peerLabel}`,
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl,
        button: {
          title: `Check my PingGate Services!!`,
          action: {
            type: "launch_frame",
            url,
            name: `Check my PingGate Services!!`,
            splashImageUrl: imageUrl,
            splashBackgroundColor: "#17101f",
          },
        },
      }),
    },
  };
}

// Fallback mientras carga React
function LoadingUser() {
  return (
    <div className="h-screen flex items-center justify-center bg-[#0f0d14] text-white">
      <p className="text-gray-400">Loading profile…</p>
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
