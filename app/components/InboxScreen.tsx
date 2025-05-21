// src/components/InboxScreen.tsx
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
import { useRouter } from "next/navigation";
import MessageInput from "./MessageInput";

interface InboxScreenProps {
  onBack: () => void;
}

interface ExtendedConversation extends Conversation {
  updatedAt?: Date;
  hasUnread?: boolean;
}

type Tab = "sales" | "purchases" | "all";

export default function InboxScreen({ onBack }: InboxScreenProps) {
  const router = useRouter();
  const { data: walletClient } = useWalletClient();
  const { xmtpClient, error: xmtpError } = useXmtpClient();
  const myAddress = walletClient?.account.address.toLowerCase();

  const [conversations, setConversations] = useState<ExtendedConversation[]>([]);
  const [firstMessage, setFirstMessage] = useState<Record<string, DecodedMessage>>({});
  const [messages, setMessages] = useState<Record<string, DecodedMessage[]>>({});
  const [nameLabels, setNameLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("all");
  const [purchasedPeers, setPurchasedPeers] = useState<Set<string>>(new Set());
  const [soldPeers, setSoldPeers] = useState<Set<string>>(new Set());

  const [expanded, setExpanded] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const hasLoadedRef = useRef(false);

  // 1) Load XMTP conversations
  useEffect(() => {
    const load = async () => {
      if (!xmtpClient || hasLoadedRef.current || !myAddress) return;
      try {
        const convos = await xmtpClient.conversations.list();
        const withMeta = await Promise.all(
          convos.map(async (c) => {
            const [last] = await c.messages({
              limit: 1,
              direction: SortDirection.SORT_DIRECTION_DESCENDING,
            });
            return Object.assign(c, {
              updatedAt: last?.sent,
              hasUnread: !!last && last.senderAddress.toLowerCase() !== myAddress,
            });
          })
        );
        withMeta.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
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
        console.error(e);
      } finally {
        setLoading(false);
        hasLoadedRef.current = true;
      }
    };
    load();
  }, [xmtpClient, myAddress, nameLabels]);

  // 2) Load on-chain peers sets
  useEffect(() => {
    if (!walletClient) return;
    (async () => {
      try {
        const boughtIds = await fetchPurchasedServiceIds(walletClient.account.address);
        const pPeers = new Set<string>();
        for (const id of boughtIds) {
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
        console.error(e);
      }
    })();
  }, [walletClient]);

  const filtered = conversations.filter((c) =>
    tab === "all"
      ? true
      : tab === "sales"
      ? soldPeers.has(c.peerAddress.toLowerCase())
      : purchasedPeers.has(c.peerAddress.toLowerCase())
  );

  const toggle = async (peer: string, convo: ExtendedConversation) => {
    const opening = expanded !== peer;
    if (opening) {
      if (!firstMessage[peer]) {
        try {
          const [first] = await convo.messages({
            limit: 1,
            direction: SortDirection.SORT_DIRECTION_ASCENDING,
          });
          first && setFirstMessage((p) => ({ ...p, [peer]: first }));
        } catch {}
      }
      if (!messages[peer]) {
        try {
          let lastTen = await convo.messages({
            limit: 10,
            direction: SortDirection.SORT_DIRECTION_DESCENDING,
          });
          lastTen = lastTen.reverse();
          setMessages((p) => ({ ...p, [peer]: lastTen }));
        } catch {}
      }
    }
    setExpanded(opening ? peer : null);
  };

  const handleSend = async (peer: string, text: string) => {
    if (!xmtpClient || !text.trim()) return;
    const convo = conversations.find((c) => c.peerAddress === peer);
    if (!convo) return;
    await convo.send(text);
    const updated = await convo.messages({
      limit: 10,
      direction: SortDirection.SORT_DIRECTION_DESCENDING,
    });
    setMessages((p) => ({ ...p, [peer]: updated.reverse() }));
  };

  const handleCreate = async () => {
    setSending(true);
    setErr(null);
    try {
      if (!xmtpClient) throw new Error("XMTP not ready");
      if (!to || !body) throw new Error("Fill all fields");
      const addr = await resolveRecipient(to);
      const convo = await xmtpClient.conversations.newConversation(addr);
      await convo.send(body);
      setShowComposer(false);
      setTo("");
      setBody("");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex-1 flex items-center justify-center text-gray-400 mt-16">Loading…</div>;
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 max-h-[97%] bg-[#0f0d14] text-white relative">
      {/* Back + Title */}
      <button
              onClick={onBack}
              className="mb-4 flex items-center justify-center text-purple-400 text-lg px-4 py-2 bg-[#1a1725] rounded-lg max-w-[200px]"
            >
              <FiArrowLeft className="w-5 h-5 mr-2" />
              Back
      </button>
      <h2 className="text-2xl font-bold text-center mb-4">Inbox</h2>

      {/* Tabs */}
      <div className="flex justify-center space-x-4 mb-4 px-2">
        {(["all", "purchases", "sales"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded ${
              tab === t ? "bg-purple-600 text-white" : "bg-[#1a1725] text-gray-400 hover:bg-[#231c32]"
            }`}
          >
            {t === "sales" ? "Clients" : t === "purchases" ? "Bought" : "All"}
          </button>
        ))}
      </div>
      {xmtpError && <p className="text-red-500 text-center mb-2">{xmtpError}</p>}

      {/* Scrollable list */}
      <div
        className="
          flex-1 overflow-y-auto px-2 space-y-4
          scrollbar-thin
          scrollbar-track-[#1a1725]
          scrollbar-thumb-purple-600
          hover:scrollbar-thumb-purple-500
        "
      >
        {filtered.map((conv, idx) => {
          const peer = conv.peerAddress;
          const isOpen = expanded === peer;
          const lower = peer.toLowerCase();
          const isSale = tab === "sales";
          const isPurchase = tab === "purchases";
          const count = isSale
            ? Array.from(soldPeers).filter((p) => p === lower).length
            : isPurchase
            ? Array.from(purchasedPeers).filter((p) => p === lower).length
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
                onClick={() => toggle(peer, conv)}
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
                    {conv.hasUnread && <span className="text-yellow-400">📩</span>}
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
                  {firstMessage[peer] && (
                    <div
                      onClick={() => router.push(`/conversation/${peer}`)}
                      className="cursor-pointer italic text-sm p-2 rounded-lg bg-[#2a2438] hover:bg-[#3a3345]"
                    >
                      Click to open full conversation
                    </div>
                  )}
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
                  <MessageInput onSend={(t) => handleSend(peer, t)} />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* FAB para nuevo chat */}
      <button
        onClick={() => setShowComposer(true)}
        className="fixed bottom-6 right-6 z-50 bg-purple-600 hover:bg-purple-700 text-white text-3xl w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
        aria-label="New Conversation"
      >
        <FiPlus />
      </button>

      {/* Composer Modal */}
      {showComposer && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
          <div className="bg-[#1a1725] p-6 rounded-xl w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">New Conversation</h3>
            {err && <p className="text-red-400">{err}</p>}
            <input
              type="text"
              placeholder="ENS / Farcaster / Wallet"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full p-3 bg-[#2a2438] text-white rounded-lg"
            />
            <textarea
              rows={3}
              placeholder="Message"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full p-3 bg-[#2a2438] text-white rounded-lg"
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowComposer(false)}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white"
                disabled={sending}
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white"
                disabled={sending}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
