// app/conversation/[peer]/page.tsx
"use client";

import { useRouter, useParams } from "next/navigation";
import ConversationScreen from "../../components/ConversationScreen";

export default function ConversationPage() {
  const router = useRouter();
  const { peer } = useParams();      // grabs the `[peer]` param
  if (!peer) return null;

  return (
    <ConversationScreen
      peerAddress={peer}
      onBack={() => router.back()}
    />
  );
}
