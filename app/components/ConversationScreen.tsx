// src/components/ConversationScreen.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { DecodedMessage, SortDirection } from "@xmtp/xmtp-js";
import { useWalletClient } from "wagmi";
import { FiArrowLeft } from "react-icons/fi";
import { useXmtpClient } from "../hooks/useXmtpClient";
import { resolveNameLabel } from "../services/resolveNameLabel";
import { WarpcastService, Web3BioProfile } from "../services/warpcastService";
import MessageInput from "./MessageInput";
import { useMiniKit } from "@coinbase/onchainkit/minikit";

interface ConversationScreenProps {
  peerAddress: string;
  onBack: () => void;
}

export default function ConversationScreen({ peerAddress, onBack }: ConversationScreenProps) {
  const { data: walletClient } = useWalletClient();
  const { xmtpClient } = useXmtpClient();
  const myAddress = walletClient?.account.address.toLowerCase() || "";
  const warpcast = new WarpcastService();

  const [displayName, setDisplayName] = useState<string>(peerAddress);
  const [profile, setProfile] = useState<Web3BioProfile>();
  const [messages, setMessages] = useState<DecodedMessage[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { context } = useMiniKit();

  // 1️⃣ Resuelve Farcaster name o ENS para el header
  useEffect(() => {
    let active = true;
    (async () => {
      const addr = peerAddress.toLowerCase();
      // Intentar Farcaster lookup
      try {
        const ids = [`farcaster,${addr}`];
        const profiles = await warpcast.getWeb3BioProfiles(ids);
        const aliasMap: Record<string, Web3BioProfile> = {};
        profiles.forEach((p) => p.aliases?.forEach((alias) => {
          const [, id] = alias.split(",");
          aliasMap[id.toLowerCase()] = p;
        }));
        const profile = aliasMap[addr];
        setProfile(profile);
        if (active && profile) {
          setDisplayName(profile.displayName);
          return;
        }
      } catch {
        // ignora error
      }
      // Fallback ENS
      try {
        const ens = await resolveNameLabel(addr);
        if (active && ens) {
          setDisplayName(ens);
        }
      } catch {
        if (active) {
          setDisplayName(peerAddress);
        }
      }
    })();
    return () => { active = false; };
  }, [peerAddress, warpcast]);

  // 2️⃣ Fetch inicial + stream de mensajes
  useEffect(() => {
    if (!xmtpClient) return;
    let active = true;
    let stream: AsyncIterable<DecodedMessage>;

    (async () => {
      const convo = await xmtpClient.conversations.newConversation(peerAddress);
      // Fetch inicial (hasta 50)
      const initial = await convo.messages({ limit: 50, direction: SortDirection.SORT_DIRECTION_DESCENDING });
      if (!active) return;
      setMessages(initial.slice().reverse());
      // Stream en tiempo real
      stream = await convo.streamMessages();
      for await (const msg of stream) {
        if (!active) break;
        setMessages((prev) => [...prev, msg]);
      }
    })().catch(console.error);

    return () => {
      active = false;
      // Si el stream soporta cancelación:
      if (stream && typeof (stream as any).return === 'function') {
        (stream as any).return();
      }
    };
  }, [xmtpClient, peerAddress]);

  // 3️⃣ Auto-scroll on new message
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [messages]);

    // 4️⃣ Envío de mensaje + notificacion
    const handleSend = async (text: string | File) => {
  if (!xmtpClient || !text) return;

  // 1️⃣ Abrir/crear conversación
  const convo = await xmtpClient.conversations.newConversation(peerAddress);

  // 2️⃣ Comprobar timestamp del último mensaje
  const lastMsg = messages[messages.length - 1];
  const lastSent = lastMsg?.sent?.getTime() ?? 0;
  const now = Date.now();
  const THIRTY_MIN = 30 * 60 * 1000;

  // 3️⃣ Enviar el mensaje (texto o archivo)
  await convo.send(text);

  // 4️⃣ Si el último fue hace menos de 30 min, no notificamos
  if (lastSent && now - lastSent < THIRTY_MIN) {
    return;
  }

  // 5️⃣ Obtener FID del peer
  let fid = 0;
  if (profile?.social?.uid) {
    fid = profile.social.uid;
  } else {
    try {
      fid = await warpcast.getFidByName(peerAddress);
    } catch (e) {
      console.error("Failed to lookup peer FID:", e);
      return;
    }
  }

  // 6️⃣ Resolver mi nombre (ENS) y elegir entre context o miName
  let myName: string;
  try {
    myName = await resolveNameLabel(myAddress);
  } catch {
    myName = myAddress;
  }
  const displayName = context?.user?.displayName ?? myName;

  // 7️⃣ Construir título y cuerpo
  const title = `New message from ${displayName}`;
  const body =
    typeof text === "string"
      ? text
      : `Sent you a file: ${(text as File).name}`;

  // 8️⃣ Llamada a tu API de notificaciones
  fetch("/api/notify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fid,
      notification: { title, body },
      targetUrl: `https://pinggate.lopezonchain.xyz/conversation/${myAddress}`,
    }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const err = await res.json();
        console.error("Notification error:", err);
      }
    })
    .catch((err) => console.error("Notification failed:", err));
};

  return (
    <div className="flex flex-col h-screen bg-[#0f0d14] text-white w-full max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-gray-700">
        <button
          onClick={onBack}
          className="flex items-center text-purple-400 text-lg px-6 py-2 bg-[#1a1725] rounded-lg mr-4"
        >
          <FiArrowLeft className="w-5 h-5" />
        </button>
        {profile?.avatar && <img src={profile?.avatar} alt="" className="w-5 h-5 rounded-full object-cover" />}
        <h2 className="flex-1 text-center font-semibold truncate">
          {displayName}
        </h2>
      </div>

      {/* Mensajes */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500"
        >
          {messages.map((m, i) => {
            const isMe = m.senderAddress.toLowerCase() === myAddress;
            const time = m.sent
              ? m.sent.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : "";
            return (
              <div
                key={i}
                className={`flex flex-col text-sm text-center max-w-[80%] p-2 rounded-lg whitespace-normal break-words ${
                  isMe ? "bg-purple-600 ml-auto" : "bg-gray-700"
                }`}
                style={{ hyphens: "auto" }}
              >
                <div>{m.content}</div>
                <span className="text-[10px] text-gray-300 text-right">
                  {time}
                </span>
              </div>
            );
          })}
        </div>

        {/* Input fijo abajo */}
        <div className="border-t border-gray-700 p-4">
          <MessageInput onSend={t => handleSend(t)} />
        </div>
      </div>
    </div>
  );
}