// app/users/[peer]/page.tsx
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
  const url = `https://pinggate.lopezonchain.xyz/user/${peerWallet}`;

  // Intentamos obtener nombre de Farcaster, si falla usamos wallet truncada
  let displayName: string;
  try {
    const { WarpcastService } = await import("../../services/warpcastService");
    const svc = new WarpcastService();
    const [bio] = await svc.getWeb3BioProfilesDirect([`farcaster,${peerWallet}`]);
    displayName = bio?.displayName || `${peerWallet.slice(0, 6)}…${peerWallet.slice(-4)}`;
  } catch {
    displayName = `${peerWallet.slice(0, 6)}…${peerWallet.slice(-4)}`;
  }

  const peer = displayName.length > 22
    ? displayName.slice(0, 22) + "..."
    : displayName;

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
