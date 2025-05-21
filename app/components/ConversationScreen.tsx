"use client";

import React, { useEffect, useState, useRef } from "react";
import { DecodedMessage } from "@xmtp/xmtp-js";
import { useWalletClient } from "wagmi";
import { FiArrowLeft } from "react-icons/fi";
import { useXmtpClient } from "../hooks/useXmtpClient";
import MessageInput from "./MessageInput";

export default function ConversationScreen({
  peerAddress,
  onBack,
}: {
  peerAddress: string;
  onBack: () => void;
}) {
  const { data: walletClient } = useWalletClient();
  const { xmtpClient } = useXmtpClient();
  const [messages, setMessages] = useState<DecodedMessage[]>([]);
  const myAddress = walletClient?.account.address.toLowerCase();

  // Ref al contenedor de mensajes para scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Función para cargar mensajes
  const loadMessages = async () => {
    if (!xmtpClient) return;
    const convo = await xmtpClient.conversations.newConversation(peerAddress);
    const msgs = await convo.messages();
    setMessages(msgs);
  };

  // Carga inicial + polling cada 3s
  useEffect(() => {
    if (!xmtpClient) return;
    loadMessages();
    const id = window.setInterval(loadMessages, 3000);
    return () => window.clearInterval(id);
  }, [xmtpClient, peerAddress]);

  // Scroll automático al final
  useEffect(() => {
    const c = scrollContainerRef.current;
    if (c) {
      requestAnimationFrame(() => {
        c.scrollTop = c.scrollHeight;
      });
    }
  }, [messages]);

  // Envío de mensaje
  const handleSend = async (text: string) => {
    if (!xmtpClient || !text.trim()) return;
    const convo = await xmtpClient.conversations.newConversation(peerAddress);
    await convo.send(text);
    await loadMessages();
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f0d14] text-white max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-gray-700">
        <button
          onClick={onBack}
          className="flex items-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg"
        >
          <FiArrowLeft className="w-5 h-5 mr-2" />
          Back
        </button>
        <h2 className="flex-1 text-center font-semibold truncate px-2">
          {peerAddress}
        </h2>
      </div>

      {/* Mensajes + Input */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Contenedor scrollable */}
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
          <MessageInput onSend={handleSend} />
        </div>
      </div>
    </div>
  );
}