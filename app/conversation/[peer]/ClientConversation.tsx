// app/conversation/[peer]/ClientConversation.tsx
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import ConversationScreen from "../../components/ConversationScreen"; 

interface ClientProps {
  peerAddress: string;
}

export default function ClientConversation({ peerAddress }: ClientProps) {
  const router = useRouter();    

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0f0d14]">
      <div className="w-full max-w-md flex flex-col h-screen">
        <ConversationScreen
          peerAddress={peerAddress}
          onBack={() => router.back()}
        />
      </div>
    </div>
  );
}
