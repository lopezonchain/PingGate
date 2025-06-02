// app/conversation/[peer]/ClientConversation.tsx
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import ConversationScreen from "../../components/ConversationScreen"; 

import { sdk } from '@farcaster/frame-sdk';
import { useMiniKit } from "@coinbase/onchainkit/minikit";

interface ClientProps {
  peerAddress: string;
}

export default function ClientConversation({ peerAddress }: ClientProps) {
  const router = useRouter();

  const { setFrameReady, isFrameReady } = useMiniKit();
  
    useEffect(() => {
      if (!isFrameReady) setFrameReady();
      (async () => {
        await sdk.actions.ready({ disableNativeGestures: true });
      })();
    }, [isFrameReady, setFrameReady]);
    

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
