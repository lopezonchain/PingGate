"use client";

import React, { useEffect, useState, useRef } from "react";
import { Conversation, DecodedMessage, SortDirection } from "@xmtp/xmtp-js";
import { useWalletClient } from "wagmi";
import { FiArrowLeft, FiMessageCircle, FiPlus } from "react-icons/fi";
import { motion } from "framer-motion";
import { useXmtpClient } from "../hooks/useXmtpClient";
import { resolveRecipient } from "../services/nameResolver";
import { resolveNameLabel } from "../services/resolveNameLabel";
import {
  getPurchasesBy as fetchPurchasedServiceIds,
  getSalesBy as fetchSalesRecords,
  getService as fetchServiceDetails,
} from "../services/contractService"; // You need to implement these

interface InboxScreenProps {
  onBack: () => void;
}

interface ExtendedConversation extends Conversation {
  updatedAt?: Date;
  hasUnread?: boolean;
}

type Tab = "sales" | "purchases" | "all";

export default function InboxScreen({ onBack }: InboxScreenProps) {
  const { data: walletClient } = useWalletClient();
  const { xmtpClient, error: xmtpError } = useXmtpClient();
  const myAddress = walletClient?.account.address.toLowerCase();

  const [conversations, setConversations] = useState<ExtendedConversation[]>([]);
  const [messages, setMessages] = useState<Record<string, DecodedMessage[]>>({});
  const [nameLabels, setNameLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("all");
  const [purchasedPeers, setPurchasedPeers] = useState<Set<string>>(new Set());
  const [soldPeers, setSoldPeers] = useState<Set<string>>(new Set());

  const [showComposer, setShowComposer] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);

  // Load XMTP conversations
  useEffect(() => {
    const loadConversations = async () => {
      if (!xmtpClient || hasLoadedRef.current || !myAddress) return;
      try {
        const convos = await xmtpClient.conversations.list();
        const withMeta = await Promise.all(
          convos.map(async (c) => {
            // get last message for timestamp and unread flag
            const msgs = await c.messages({
              limit: 1,
              direction: SortDirection.SORT_DIRECTION_DESCENDING,
            });
            const last = msgs[0];
            return Object.assign(c, {
              updatedAt: last?.sent,
              hasUnread: !!last && last.senderAddress.toLowerCase() !== myAddress,
            });
          })
        );
        // sort descending
        withMeta.sort(
          (a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0)
        );
        // fetch display labels for new peers
        const newLabels: Record<string, string> = {};
        await Promise.all(
          withMeta.map(async (c) => {
            if (!nameLabels[c.peerAddress]) {
              newLabels[c.peerAddress] = await resolveNameLabel(c.peerAddress);
            }
          })
        );
        setNameLabels((prev) => ({ ...prev, ...newLabels }));
        setConversations(withMeta);
      } catch (e) {
        console.error("Failed to load XMTP convos", e);
      } finally {
        setLoading(false);
        hasLoadedRef.current = true;
      }
    };
    loadConversations();
  }, [xmtpClient, myAddress, nameLabels]);

  // Load contract-based sales/purchases
  useEffect(() => {
    if (!walletClient) return;
    (async () => {
      try {
        // 1️⃣ Purchases: fetch serviceIds buyer has bought, then map to seller addresses
        const serviceIds = await fetchPurchasedServiceIds(walletClient.account.address);
        const pPeers = new Set<string>();
        for (const id of serviceIds) {
          const svc = await fetchServiceDetails(id);
          pPeers.add(svc.seller.toLowerCase());
        }
        setPurchasedPeers(pPeers);

        // 2️⃣ Sales: fetch purchase records for me as seller
        const sales = await fetchSalesRecords(walletClient.account.address);
        const sPeers = new Set<string>();
        for (const rec of sales) {
          sPeers.add(rec.buyer.toLowerCase());
        }
        setSoldPeers(sPeers);
      } catch (e) {
        console.error("Failed to load contract sales/purchases", e);
      }
    })();
  }, [walletClient]);

  const filteredConversations = conversations.filter((c) =>
    tab === "all"
      ? true
      : tab === "sales"
        ? soldPeers.has(c.peerAddress.toLowerCase())
        : purchasedPeers.has(c.peerAddress.toLowerCase())
  );

  const toggleConversation = async (peer: string, convo: ExtendedConversation) => {
    // expand/collapse
    setMessages((prev) => {
      if (prev[peer]) return prev; // already loaded
      return prev;
    });
    if (!messages[peer]) {
      try {
        const msgs = await convo.messages();
        setMessages((prev) => ({ ...prev, [peer]: msgs }));
      } catch (e) {
        console.error("Failed to fetch messages", e);
      }
    }
    // toggle expanded
    setExpanded((curr) => (curr === peer ? null : peer));
  };

  const handleSendMessage = async (peer: string, text: string) => {
    if (!xmtpClient) return;
    const convo = conversations.find((c) => c.peerAddress === peer);
    if (!convo) return;
    await convo.send(text);
    const msgs = await convo.messages();
    setMessages((prev) => ({ ...prev, [peer]: msgs }));
  };

  const handleCreateMessage = async () => {
    setSending(true);
    setComposeError(null);
    try {
      if (!xmtpClient) throw new Error("XMTP not ready");
      if (!composeTo || !composeMessage) throw new Error("Fill all fields");
      const addr = await resolveRecipient(composeTo);
      const convo = await xmtpClient.conversations.newConversation(addr);
      await convo.send(composeMessage);
      setComposeTo("");
      setComposeMessage("");
      setShowComposer(false);
    } catch (e: any) {
      setComposeError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-[90%] flex flex-col bg-[#0f0d14] text-white relative">
      <button
        onClick={onBack}
        className="mb-4 flex items-center justify-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg max-w-[200px]"
      >
        <FiArrowLeft className="w-5 h-5 mr-2" />
        Back
      </button>

      <h2 className="text-2xl font-bold mb-4 text-center">Inbox</h2>

      {/* Tabs */}
      <div className="flex justify-center space-x-1 mb-4">
        {(["all", "purchases", "sales"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-2 rounded ${tab === t
              ? "bg-purple-600 text-white"
              : "bg-[#1a1725] text-gray-400 hover:bg-[#231c32]"
              }`}
          >
            {t === "sales" ? "Clients" : t === "purchases" ? "Bought" : "All"}
          </button>
        ))}
      </div>

      {xmtpError && <p className="text-red-500 text-center">{xmtpError}</p>}
      {loading ? (
        <p className="text-center text-gray-400 flex-1 flex items-center justify-center">
          Loading…
        </p>
      ) : (
        <div className="flex-1">
          <div className="h-full overflow-y-auto space-y-4 px-2 pb-2">
            {filteredConversations.map((conv, idx) => {
              const isOpen = conv.peerAddress === expanded;
              const peer = conv.peerAddress.toLowerCase();
              const isSale = tab === "sales";
              const isPurchase = tab === "purchases";

              // summary: count & total – you can enhance by fetching exact amounts
              const count = isSale
                ? Array.from(soldPeers).filter((p) => p === peer).length
                : isPurchase
                  ? Array.from(purchasedPeers).filter((p) => p === peer).length
                  : 0;

              return (
                <motion.div
                  key={conv.peerAddress}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-[#1a1725] rounded-xl overflow-hidden"
                >
                  <div
                    className="p-4 flex justify-between items-center hover:bg-[#231c32] cursor-pointer"
                    onClick={() => toggleConversation(conv.peerAddress, conv)}
                  >
                    <div>
                      <p className="font-semibold flex items-center space-x-2">
                        <a
                          href={`https://basescan.org/address/${conv.peerAddress}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {nameLabels[conv.peerAddress] || conv.peerAddress}
                        </a>
                        {conv.hasUnread && (
                          <span
                            title="You haven't replied"
                            className="text-yellow-400 ml-4"  // <-- aquí ajustas el 4 por el espaciado que quieras
                          >
                            📩
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {conv.updatedAt?.toLocaleString() || "No messages"}
                      </p>
                    </div>
                    <FiMessageCircle className="text-lg" />
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-2 max-h-[50%]">
                      {messages[conv.peerAddress]?.map((m, i) => (
                        <div
                          key={i}
                          className={`text-sm max-w-[90%] p-2 rounded-lg ${m.senderAddress.toLowerCase() === walletClient?.account.address.toLowerCase()
                            ? "bg-purple-600 text-right ml-auto"
                            : "bg-gray-700"
                            }`}
                        >
                          {m.content}
                        </div>
                      ))}

                      <MessageInput
                        onSend={(text) => handleSendMessage(conv.peerAddress, text)}
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* New message */}      
      <button
        onClick={() => setShowComposer(true)}
        className="fixed bottom-6 right-6 z-50 
                  bg-purple-600 hover:bg-purple-700 
                  text-white text-3xl w-12 h-12 
                  rounded-full shadow-lg 
                  flex items-center justify-center p-0"
        aria-label="New Message"
      >
        <FiPlus />
      </button>

      {/* Composer Modal */}
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
}


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