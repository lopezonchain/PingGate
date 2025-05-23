// src/components/InboxScreen.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { Conversation, DecodedMessage, SortDirection } from "@xmtp/xmtp-js";
import { useWalletClient } from "wagmi";
import { FiArrowLeft, FiMessageCircle, FiPlus } from "react-icons/fi";
import { motion } from "framer-motion";
import { useXmtpClient } from "../hooks/useXmtpClient";
import { resolveNameLabel } from "../services/resolveNameLabel";
import {
  getPurchasesBy as fetchPurchasedServiceIds,
  getSalesBy as fetchSalesRecords,
  getService as fetchServiceDetails,
} from "../services/contractService";
import { WarpcastService, Web3BioProfile } from "../services/warpcastService";
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

function abbreviateAddress(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

export default function InboxScreen({ onBack }: InboxScreenProps) {
  const router = useRouter();
  const { data: walletClient } = useWalletClient();
  const { xmtpClient, error: xmtpError } = useXmtpClient();
  const myAddr = walletClient?.account.address.toLowerCase() || "";

  // — Todos los hooks al tope —
  const [conversations, setConversations] = useState<ExtendedConversation[]>([]);
  const [purchasedPeers, setPurchasedPeers] = useState<Set<string>>(new Set());
  const [soldPeers, setSoldPeers] = useState<Set<string>>(new Set());
  const [loadingList, setLoadingList] = useState(true);

  const [resolvedNames, setResolvedNames] = useState<{
    [address: string]: { label: string; avatarUrl: string | null };
  }>({});

  const [expanded, setExpanded] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, DecodedMessage[]>>({});
  const pollingRef = useRef<number | null>(null);

  const [showComposer, setShowComposer] = useState(false);
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Muevo el hook de tab **antes** de cualquier return
  const [tab, setTab] = useState<Tab>("all");

  const warpcast = new WarpcastService();

  // — Efectos y lógica igual que antes —

  // 1️⃣ Cargo & ordeno conversaciones
  useEffect(() => {
    if (!xmtpClient) return;
    let active = true;
    (async () => {
      setLoadingList(true);
      const list = await xmtpClient.conversations.list();
      const metas = await Promise.all(
        list.map((c) =>
          c.messages({ limit: 1, direction: SortDirection.SORT_DIRECTION_DESCENDING })
        )
      );
      const enriched = list.map((c, i) => ({
        ...c,
        updatedAt: metas[i][0]?.sent ?? null,
        hasUnread: metas[i][0]?.senderAddress.toLowerCase() !== myAddr,
      }));
      enriched.sort(
        (a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0)
      );
      if (active) {
        setConversations(enriched);
        setLoadingList(false);
      }
    })();
    return () => { active = false; };
  }, [xmtpClient, myAddr]);

  // 2️⃣ Purchases & Sales
  useEffect(() => {
    if (!walletClient) return;
    (async () => {
      const buyerIds = await fetchPurchasedServiceIds(walletClient.account.address);
      const pSet = new Set<string>();
      for (const id of buyerIds) {
        const svc = await fetchServiceDetails(id);
        pSet.add(svc.seller.toLowerCase());
      }
      setPurchasedPeers(pSet);

      const sales = await fetchSalesRecords(walletClient.account.address);
      setSoldPeers(new Set(sales.map((r) => r.buyer.toLowerCase())));
    })();
  }, [walletClient]);

  // 3️⃣ Batch Farcaster lookup + fallback ENS
  useEffect(() => {
    if (conversations.length === 0) return;

    const peers = Array.from(
      new Set(conversations.map((c) => c.peerAddress.toLowerCase()))
    );
    const ids = peers.map((addr) => `farcaster,${addr}`);

    (async () => {
      const newResolved: typeof resolvedNames = {};
      try {
        const profiles = await warpcast.getWeb3BioProfiles(ids);
        const aliasMap: Record<string, Web3BioProfile> = {};
        profiles.forEach((p) => {
          p.aliases.forEach((alias) => {
            // alias tiene formato "farcaster,0x123..."
            const [, id] = alias.split(",");
            aliasMap[id.toLowerCase()] = p;
          });
        });

        // Asignamos los que matcheen por alias, no por address
        peers.forEach((addr) => {
          const p = aliasMap[addr];
          if (p) {
            newResolved[addr] = {
              label: p.displayName,
              avatarUrl: p.avatar,
            };
          }
        });
      } catch (e) {
        console.error("Batch Farcaster lookup failed:", e);
      }

      await Promise.all(
        peers.map(async (addr) => {
          if (newResolved[addr]) return;
          try {
            const ens = await resolveNameLabel(addr);
            newResolved[addr] = {
              label: ens || abbreviateAddress(addr),
              avatarUrl: null,
            };
          } catch {
            newResolved[addr] = {
              label: abbreviateAddress(addr),
              avatarUrl: null,
            };
          }
        })
      );
      setResolvedNames(newResolved);
    })();
  }, [conversations]);

  // Polling helpers
  function startPolling(peer: string) {
    stopPolling();
    pollingRef.current = window.setInterval(async () => {
      const convo = await xmtpClient!.conversations.newConversation(peer);
      const lastDesc = await convo.messages({
        limit: 5,
        direction: SortDirection.SORT_DIRECTION_DESCENDING,
      });
      setMessages((m) => ({ ...m, [peer]: lastDesc.slice().reverse() }));
    }, 3000);
  }
  function stopPolling() {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  // Carga de hilo al expandir
  useEffect(() => {
    if (!expanded || !xmtpClient) {
      stopPolling();
      return;
    }
    let active = true;
    (async () => {
      const convo = await xmtpClient.conversations.newConversation(expanded);
      const lastDesc = await convo.messages({
        limit: 5,
        direction: SortDirection.SORT_DIRECTION_DESCENDING,
      });
      if (active) {
        setMessages((m) => ({ ...m, [expanded]: lastDesc.slice().reverse() }));
      }
      startPolling(expanded);
    })();
    return () => {
      active = false;
      stopPolling();
    };
  }, [expanded, xmtpClient]);

  // Envío optimista + real + notificación
  const handleSend = async (peer: string, text: string) => {
    if (!xmtpClient || !text.trim()) return;
    const now = new Date();
    const optimistic: DecodedMessage = {
      content: text,
      sent: now,
      senderAddress: myAddr,
    } as any;
    setMessages((prev) => ({
      ...prev,
      [peer]: [...(prev[peer] || []), optimistic],
    }));
    setConversations((convs) =>
      convs
        .map((c) =>
          c.peerAddress === peer
            ? { ...c, updatedAt: now, hasUnread: false }
            : c
        )
        .sort((a, b) => (b.updatedAt!.getTime() - a.updatedAt!.getTime()))
    );
    const convo = await xmtpClient.conversations.newConversation(peer);
    await convo.send(text);
    let fid: number;
    try {
      fid = await warpcast.getFidByName(peer);
    } catch {
      fid = 802090;
    }
    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fid,
        notification: {
          title: `New message from ${myAddr.slice(0, 6)}…`,
          body: text,
          notificationDetails: null,
        },
      }),
    }).catch(console.error);
  };

  // Nuevo hilo
  const handleCreate = async () => {
    setSending(true);
    setErr(null);
    try {
      if (!xmtpClient) throw new Error("XMTP not ready");
      if (!to || !body) throw new Error("Fill all fields");
      const addr = await resolveNameLabel(to);
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

  // — FILTRADO utilizando el hook de tab —
  const filtered = conversations.filter((c) => {
    const lower = c.peerAddress.toLowerCase();
    if (tab === "sales") return soldPeers.has(lower);
    if (tab === "purchases") return purchasedPeers.has(lower);
    return true;
  });

  // — Retorno temprano SIEMPRE después de haber declarado TODOS los hooks —
  if (loadingList) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 mt-16">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 max-h-[97%] bg-[#0f0d14] text-white relative">
      {/* Back + Title */}
      <button
        onClick={onBack}
        className="mb-4 flex items-center justify-center text-purple-400 px-4 py-2 bg-[#1a1725] rounded-lg max-w-[200px]"
      >
        <FiArrowLeft className="w-5 h-5 mr-2" /> Back
      </button>
      <h2 className="text-2xl font-bold text-center mb-4">Inbox</h2>

      {/* Tabs */}
      <div className="flex justify-center space-x-4 mb-4 px-2">
        {(["all", "purchases", "sales"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded ${tab === t
              ? "bg-purple-600 text-white"
              : "bg-[#1a1725] text-gray-400 hover:bg-[#231c32]"
              }`}
          >
            {t === "sales" ? "Clients" : t === "purchases" ? "Bought" : "All"}
          </button>
        ))}
      </div>
      {xmtpError && <p className="text-red-500 text-center mb-2">{xmtpError}</p>}

      {/* Lista scrollable */}
      <div className="flex-1 overflow-y-auto px-2 space-y-4 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500">
        {filtered.map((conv, idx) => {
          const peer = conv.peerAddress.toLowerCase();
          const resolved = resolvedNames[peer] || {
            label: abbreviateAddress(peer),
            avatarUrl: null,
          };
          const isOpen = expanded === peer;
          const isSale = tab === "sales";
          const isPurchase = tab === "purchases";
          const count = isSale
            ? soldPeers.has(peer)
              ? 1
              : 0
            : isPurchase
              ? purchasedPeers.has(peer)
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
                className="p-4 hover:bg-[#231c32] cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : peer)}
              >
                {/* — Nombre (y avatar) en su propia línea — */}
                <div className="flex items-center space-x-2 mb-2">
                  {resolved.avatarUrl && (
                    <img
                      src={resolved.avatarUrl}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  )}
                  <span className="font-semibold text-white">{resolved.label}</span>
                </div>

                {/* — Fecha a la izquierda, iconos a la derecha — */}
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-400">
                    {conv.updatedAt?.toLocaleString() || "No messages"}
                  </p>
                  <div className="flex items-center space-x-2">
                    {conv.hasUnread && (
                      <span className="text-yellow-400" title="Unread">📩</span>
                    )}
                    {(isSale || isPurchase) && (
                      <span className="text-xs text-gray-500">
                        {isSale ? `Sold: ${count}` : `Bought: ${count}`}
                      </span>
                    )}
                    <FiMessageCircle className="text-lg text-gray-300" />
                  </div>
                </div>
              </div>

              {isOpen && (
                <div className="px-4 pb-4 space-y-2 max-h-[50%] overflow-y-auto">
                  <div
                    onClick={() => router.push(`/conversation/${peer}`)}
                    className="cursor-pointer italic text-sm p-2 rounded-lg bg-[#2a2438] hover:bg-[#3a3345] flex justify-center"
                  >
                    Open full conversation
                  </div>
                  {(messages[peer] || []).map((m, i) => {
                    const time = m.sent
                      ? m.sent.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                      : "";
                    const isMe = m.senderAddress.toLowerCase() === myAddr;
                    return (
                      <div
                        key={i}
                        className={`flex flex-col text-sm text-center max-w-[80%] py-1 px-3 rounded-lg whitespace-normal break-words ${isMe ? "bg-purple-600 ml-auto" : "bg-gray-700"
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
                  <MessageInput onSend={(t) => handleSend(peer, t)} />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* FAB nuevo chat */}
      <button
        onClick={() => setShowComposer(true)}
        className="fixed bottom-6 right-6 z-25 bg-purple-600 hover:bg-purple-700 text-white text-3xl w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
        aria-label="New Conversation"
      >
        <FiPlus />
      </button>

      {/* Modal composer */}
      {showComposer && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
          <div className="bg-[#1a1725] p-6 rounded-xl w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">New Conversation</h3>
            {err && <p className="text-red-400">{err}</p>}
            <input
              type="text"
              placeholder="ENS / Basename / Wallet"
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