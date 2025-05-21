"use client";

import React, { useEffect, useState } from "react";
import { DecodedMessage } from "@xmtp/xmtp-js";
import { useWalletClient } from "wagmi";
import { FiArrowLeft } from "react-icons/fi";
import { useXmtpClient } from "../hooks/useXmtpClient";
import MessageInput from "./MessageInput"; // extract your input as a shared component

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

  // load all messages once
  useEffect(() => {
    if (!xmtpClient) return;
    (async () => {
      const convo = await xmtpClient.conversations.newConversation(
        peerAddress
      );
      const msgs = await convo.messages();
      setMessages(msgs);
    })();
  }, [xmtpClient, peerAddress]);

  const handleSend = async (text: string) => {
    if (!xmtpClient) return;
    const convo = await xmtpClient.conversations.newConversation(
      peerAddress
    );
    await convo.send(text);
    const updated = await convo.messages();
    setMessages(updated);
  };

  return (
    <div className="h-full flex flex-col bg-[#0f0d14] text-white">
      <button
        onClick={onBack}
        className="mb-2 inline-flex items-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg"
      >
        <FiArrowLeft className="w-5 h-5 mr-2" /> Back
      </button>

      <div className="flex-1 overflow-y-auto space-y-2 p-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[80%] p-2 rounded-lg ${
              m.senderAddress.toLowerCase() === myAddress
                ? "bg-purple-600 text-right ml-auto"
                : "bg-gray-700"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gray-700">
        <MessageInput onSend={handleSend} />
      </div>
    </div>
  );
}
