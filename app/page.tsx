import dynamic from 'next/dynamic';
import type { Metadata } from 'next';

const PingGateApp = dynamic(() => import('./page-client'), { ssr: false });

export async function generateMetadata({ searchParams }: { searchParams: { [key: string]: string } }): Promise<Metadata> {

  return {
    title: "PingGate",
    description: "Chat wallet to wallet. Monetize your inbox. Offer consulting, reviews, mentorship, or support through direct, wallet-based chats using XMTP (end to end encrypted)",
    other: {
      "fc:frame": JSON.stringify({
        version: "next",
        imageUrl: "https://pinggate.lopezonchain.xyz/PingGateLogo.png",
        button: {
          title: "Launch PingGate 💬",
          action: {
            type: "launch_frame",
            url: "https://pinggate.lopezonchain.xyz",
            name: "PingGate",
            splashImageUrl: "https://pinggate.lopezonchain.xyz/PingGateLogo.png",
            splashBackgroundColor: "#17101f",
          },
        },
      }),
    },
  };
}
export default function Page() {
  return <PingGateApp />;
}
