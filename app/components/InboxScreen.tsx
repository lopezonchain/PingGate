"use client";

import React, { useEffect, useState, useRef } from "react";
import { Conversation, DecodedMessage } from "@xmtp/xmtp-js";
import { useWalletClient } from "wagmi";
import { FiArrowLeft, FiMessageCircle } from "react-icons/fi";
import { motion } from "framer-motion";
import { useXmtpClient } from "../hooks/useXmtpClient";
import { resolveRecipient } from "../services/nameResolver";

interface InboxScreenProps {
  onBack: () => void;
}

const InboxScreen: React.FC<InboxScreenProps> = ({ onBack }) => {
  const { data: walletClient } = useWalletClient();
  const { xmtpClient, error: xmtpError } = useXmtpClient();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, DecodedMessage[]>>({});
  const [loading, setLoading] = useState(true);

  const [showComposer, setShowComposer] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);

  const hasLoadedRef = useRef(false); // 🧠 Prevent double fetch

  useEffect(() => {
    const loadConversations = async () => {
      if (!xmtpClient || hasLoadedRef.current) return;

      try {
        const convos = await xmtpClient.conversations.list();
        const sorted = convos.sort(
          (a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0)
        );
        setConversations(sorted);
      } catch (err) {
        console.error("❌ Failed to load conversations", err);
      } finally {
        setLoading(false);
        hasLoadedRef.current = true;
      }
    };

    loadConversations();
  }, [xmtpClient]);

  const toggleConversation = async (peer: string, convo: Conversation) => {
    if (expanded === peer) {
      setExpanded(null);
      return;
    }

    setExpanded(peer);
    if (!messages[peer]) {
      const msgs = await convo.messages();
      setMessages((prev) => ({ ...prev, [peer]: msgs }));
    }
  };

  const handleSendMessage = async (peer: string, text: string) => {
    if (!xmtpClient) return;
    const convo = conversations.find((c) => c.peerAddress === peer);
    if (!convo || !text.trim()) return;

    await convo.send(text);
    const updatedMsgs = await convo.messages();
    setMessages((prev) => ({ ...prev, [peer]: updatedMsgs }));
  };

  const handleCreateMessage = async () => {
    setSending(true);
    setComposeError(null);
    try {
      if (!xmtpClient) throw new Error("XMTP not ready");
      if (!composeTo || !composeMessage) throw new Error("Fill all fields");

      const toAddress = await resolveRecipient(composeTo);
      const convo = await xmtpClient.conversations.newConversation(toAddress);
      await convo.send(composeMessage);

      const convos = await xmtpClient.conversations.list();
      const sorted = convos.sort(
        (a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0)
      );
      setConversations(sorted);
      setComposeTo("");
      setComposeMessage("");
      setShowComposer(false);
    } catch (err: any) {
      setComposeError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 text-white bg-[#0f0d14] flex flex-col min-h-screen relative">
      <button
        onClick={onBack}
        className="mb-4 flex items-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg max-w-[200px]"
      >
        <FiArrowLeft className="w-5 h-5 mr-2" />
        Back
      </button>

      <h2 className="text-2xl font-bold mb-4 text-center">Inbox</h2>

      {xmtpError && <p className="text-red-500 text-center">{xmtpError}</p>}
      {loading ? (
        <p className="text-center text-gray-400">Loading conversations...</p>
      ) : (
        <div className="space-y-4">
          {conversations.map((c, idx) => {
            const isOpen = expanded === c.peerAddress;
            return (
              <motion.div
                key={c.peerAddress}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="bg-[#1a1725] rounded-xl overflow-hidden"
              >
                <div
                  className="p-4 flex justify-between items-center hover:bg-[#231c32] cursor-pointer"
                  onClick={() => toggleConversation(c.peerAddress, c)}
                >
                  <div>
                    <p className="font-semibold">{c.peerAddress}</p>
                    <p className="text-xs text-gray-400">
                      {c.updatedAt?.toLocaleString()}
                    </p>
                  </div>
                  <FiMessageCircle className="text-lg" />
                </div>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-2">
                    {messages[c.peerAddress]?.map((m, i) => (
                      <div
                        key={i}
                        className={`text-sm max-w-[80%] p-2 rounded-lg ${
                          m.senderAddress === walletClient?.account.address
                            ? "bg-purple-600 text-right ml-auto"
                            : "bg-gray-700"
                        }`}
                      >
                        {m.content}
                      </div>
                    ))}

                    <MessageInput
                      onSend={(text) => handleSendMessage(c.peerAddress, text)}
                    />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Floating + button */}
      <button
        onClick={() => setShowComposer(!showComposer)}
        className="fixed bottom-6 right-6 z-50 bg-purple-600 hover:bg-purple-700 text-white text-3xl w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
        aria-label="New Message"
      >
        +
      </button>

      {/* Composer modal */}
      {showComposer && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
          <div className="bg-[#1a1725] p-6 rounded-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4 text-white">New Message</h3>

            <input
              type="text"
              placeholder="ENS / Farcaster / Wallet"
              className="w-full p-3 mb-3 rounded-lg bg-[#2a2438] text-white"
              value={composeTo}
              onChange={(e) => setComposeTo(e.target.value)}
            />
            <textarea
              rows={3}
              placeholder="Message"
              className="w-full p-3 mb-3 rounded-lg bg-[#2a2438] text-white"
              value={composeMessage}
              onChange={(e) => setComposeMessage(e.target.value)}
            />
            {composeError && (
              <p className="text-red-500 text-sm mb-2">{composeError}</p>
            )}

            <div className="flex justify-between">
              <button
                onClick={() => setShowComposer(false)}
                className="px-4 py-2 rounded-lg bg-gray-600 text-white hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMessage}
                disabled={sending}
                className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-bold"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InboxScreen;

const MessageInput = ({ onSend }: { onSend: (text: string) => void }) => {
  const [text, setText] = useState("");

  const handleSubmit = () => {
    if (text.trim()) {
      onSend(text);
      setText("");
    }
  };

  return (
    <div className="mt-3 flex space-x-2">
      <input
        type="text"
        placeholder="Type a message..."
        className="flex-1 bg-[#2a2438] rounded-lg px-4 py-2 text-white"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
      />
      <button
        onClick={handleSubmit}
        className="bg-purple-600 hover:bg-purple-700 rounded-lg px-4 text-white font-bold"
      >
        Send
      </button>
    </div>
  );
};
