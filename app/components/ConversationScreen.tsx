"use client";

import React, { useEffect, useState } from "react";
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

  // Load all messages once
  useEffect(() => {
    if (!xmtpClient) return;
    (async () => {
      const convo = await xmtpClient.conversations.newConversation(peerAddress);
      const msgs = await convo.messages();
      setMessages(msgs);
    })();
  }, [xmtpClient, peerAddress]);

  const handleSend = async (text: string) => {
    if (!xmtpClient) return;
    const convo = await xmtpClient.conversations.newConversation(peerAddress);
    await convo.send(text);
    const updated = await convo.messages();
    setMessages(updated);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f0d14] text-white max-w-md">
      {/* Header */}
      <div className="flex items-center px-4 py-2 border-b border-gray-700">
        <button
            onClick={onBack}
            className="mb-4 flex items-center justify-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg max-w-[200px]"
        >
            <FiArrowLeft className="w-5 h-5 mr-2" />
            Back
        </button>

        <h2 className="flex-1 text-center font-semibold truncate px-2">
          {peerAddress}
        </h2>
      </div>

      {/* Messages + Input wrapper */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Scrollable messages */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[80%] word-break p-2 rounded-lg ${
                m.senderAddress.toLowerCase() === myAddress
                  ? "bg-purple-600 text-right ml-auto"
                  : "bg-gray-700"
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>

        {/* Fixed input at bottom */}
        <div className="border-t border-gray-700 p-4">
          <MessageInput onSend={handleSend} />
        </div>
      </div>
    </div>
  );
}
