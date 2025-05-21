// app/conversation/[peer]/page.tsx
"use client";

import { useRouter, useParams } from "next/navigation";
import ConversationScreen from "../../components/ConversationScreen";

export default function ConversationPage() {
  const router = useRouter();
  const { peer } = useParams(); // grabs the `[peer]` param
  if (!peer) return null;

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f0d14]">
      <div className="w-full max-w-md flex flex-col h-screen">
        <ConversationScreen
          peerAddress={peer}
          onBack={() => router.back()}
        />
      </div>
    </div>
  );
}
