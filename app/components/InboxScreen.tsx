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
} from "../services/contractService";

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

  // ─── Load XMTP conversations once ─────────────────────────────────────────
  useEffect(() => {
    const loadConversations = async () => {
      if (!xmtpClient || hasLoadedRef.current || !myAddress) return;
      try {
        const convos = await xmtpClient.conversations.list();
        const withMeta = await Promise.all(
          convos.map(async (c) => {
            const msgs = await c.messages({
              limit: 1,
              direction: SortDirection.SORT_DIRECTION_DESCENDING,
            });
            const last = msgs[0];
            return Object.assign<Conversation, Partial<ExtendedConversation>>(c, {
              updatedAt: last?.sent,
              hasUnread: !!last && last.senderAddress.toLowerCase() !== myAddress,
            });
          })
        );
        withMeta.sort(
          (a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0)
        );
        // resolve labels
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

  // ─── Load on-chain peers sets ──────────────────────────────────────────────
  useEffect(() => {
    if (!walletClient) return;
    (async () => {
      try {
        const purchaseIds = await fetchPurchasedServiceIds(walletClient.account.address);
        const pPeers = new Set<string>();
        for (const id of purchaseIds) {
          const svc = await fetchServiceDetails(id);
          pPeers.add(svc.seller.toLowerCase());
        }
        setPurchasedPeers(pPeers);

        const sales = await fetchSalesRecords(walletClient.account.address);
        const sPeers = new Set<string>();
        for (const rec of sales) {
          sPeers.add(rec.buyer.toLowerCase());
        }
        setSoldPeers(sPeers);
      } catch (e) {
        console.error("Failed to load on-chain data", e);
      }
    })();
  }, [walletClient]);

  // ─── Polling for messages in the open conversation ────────────────────────
  useEffect(() => {
    if (!expanded || !xmtpClient) return;
    const peer = expanded;
    const interval = setInterval(async () => {
      try {
        const convo = conversations.find((c) => c.peerAddress === peer);
        if (convo) {
          const msgs = await convo.messages();
          setMessages((prev) => ({ ...prev, [peer]: msgs }));
        }
      } catch (e) {
        console.error("Polling fetch failed", e);
      }
    }, 5000); // every 5s

    return () => clearInterval(interval);
  }, [expanded, xmtpClient, conversations]);

  const filteredConversations = conversations.filter((c) =>
    tab === "all"
      ? true
      : tab === "sales"
      ? soldPeers.has(c.peerAddress.toLowerCase())
      : purchasedPeers.has(c.peerAddress.toLowerCase())
  );

  const toggleConversation = async (peer: string, convo: ExtendedConversation) => {
    // if opening for the first time, load messages immediately
    if (expanded !== peer && !messages[peer]) {
      try {
        const msgs = await convo.messages();
        setMessages((prev) => ({ ...prev, [peer]: msgs }));
      } catch (e) {
        console.error("Failed to fetch messages", e);
      }
    }
    setExpanded((curr) => (curr === peer ? null : peer));
  };

  const handleSendMessage = async (peer: string, text: string) => {
    if (!xmtpClient) return;
    const convo = conversations.find((c) => c.peerAddress === peer);
    if (!convo || !text.trim()) return;
    await convo.send(text);
    // refresh immediately
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
    } catch (err: any) {
      setComposeError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="h-[90%] flex flex-col bg-[#0f0d14] text-white relative">
      {/* Back */}
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg"
      >
        <FiArrowLeft className="w-5 h-5 mr-2" /> Back
      </button>

      <h2 className="text-2xl font-bold mb-4 text-center">Inbox</h2>

      {/* Tabs */}
      <div className="flex justify-center space-x-4 mb-4">
        {(["all", "purchases", "sales"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded ${
              tab === t
                ? "bg-purple-600 text-white"
                : "bg-[#1a1725] text-gray-400 hover:bg-[#231c32]"
            }`}
          >
            {t === "sales"
              ? "Clients"
              : t === "purchases"
              ? "Bought"
              : "All"}
          </button>
        ))}
      </div>

      {xmtpError && <p className="text-red-500 text-center">{xmtpError}</p>}
      {loading ? (
        <p className="text-center text-gray-400 flex-1 flex items-center justify-center">
          Loading…
        </p>
      ) : (
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto space-y-4 px-2 pb-2">
            {filteredConversations.map((conv, idx) => {
              const peer = conv.peerAddress;
              const isOpen = peer === expanded;
              const lower = peer.toLowerCase();
              const isSale = tab === "sales";
              const isPurchase = tab === "purchases";
              const count = isSale
                ? soldPeers.has(lower)
                  ? 1
                  : 0
                : isPurchase
                ? purchasedPeers.has(lower)
                  ? 1
                  : 0
                : 0;

              return (
                <motion.div
                  key={peer}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-[#1a1725] rounded-xl overflow-hidden"
                >
                  <div
                    className="p-4 flex justify-between items-center hover:bg-[#231c32] cursor-pointer"
                    onClick={() => toggleConversation(peer, conv)}
                  >
                    <div>
                      <p className="font-semibold flex items-center space-x-2">
                        <a
                          href={`https://basescan.org/address/${peer}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline"
                        >
                          {nameLabels[peer] || peer}
                        </a>
                        {conv.hasUnread && (
                          <span
                            title="New from peer"
                            className="text-yellow-400 ml-2"
                          >
                            📩
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {conv.updatedAt?.toLocaleString() || "No messages"}
                      </p>
                      {(isSale || isPurchase) && (
                        <p className="text-xs text-gray-500 mt-1">
                          {isSale ? `Sold: ${count}` : `Bought: ${count}`}
                        </p>
                      )}
                    </div>
                    <FiMessageCircle className="text-lg" />
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-2 max-h-[50%] overflow-y-auto">
                      {messages[peer]?.map((m, i) => (
                        <div
                          key={i}
                          className={`text-sm max-w-[90%] p-2 rounded-lg ${
                            m.senderAddress.toLowerCase() === myAddress
                              ? "bg-purple-600 text-right ml-auto"
                              : "bg-gray-700"
                          }`}
                        >
                          {m.content}
                        </div>
                      ))}
                      <MessageInput
                        onSend={(text) => handleSendMessage(peer, text)}
                      />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* New Message */}
      <button
        onClick={() => setShowComposer(true)}
        className="fixed bottom-6 right-6 z-50 bg-purple-600 hover:bg-purple-700 text-white text-3xl w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
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
                className="px-4 py-2 rounded-lg bg-gray-600 hover:bg-gray-500 text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMessage}
                disabled={sending}
                className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold"
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
