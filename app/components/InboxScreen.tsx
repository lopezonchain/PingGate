// src/components/InboxScreen.tsx
"use client";

import React, { useEffect, useState } from "react";
import { Conversation, DecodedMessage, SortDirection } from "@xmtp/xmtp-js";
import { useWalletClient } from "wagmi";
import { FiFile, FiHelpCircle, FiMenu, FiMessageCircle, FiPlus } from "react-icons/fi";
import { motion } from "framer-motion";
import { useXmtpClient } from "../hooks/useXmtpClient";
import { resolveNameLabel } from "../services/resolveNameLabel";
import {
  getPurchasesBy as fetchPurchasedServiceIds,
  getSalesBy as fetchSalesRecords,
  getService as fetchServiceDetails,
  resolveRecipient,
} from "../services/contractService";
import { WarpcastService, Web3BioProfile } from "../services/warpcastService";
import { useRouter } from "next/navigation";
import MessageInput, { XMTPAttachment } from "./MessageInput";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { ContentTypeAttachment } from "@xmtp/content-type-remote-attachment";

interface InboxScreenProps {
  onBack: () => void;
}

interface ExtendedConversation extends Conversation {
  updatedAt?: Date;
  hasUnread?: boolean;
}
type Tab = "sales" | "purchases" | "all";

function abbreviateAddress(addr: string) {
  const isEthAddress = /^0x[a-fA-F0-9]{40}$/.test(addr);
  if (!isEthAddress) return addr;
  return addr.slice(0, 7) + "…" + addr.slice(-5);
}

export default function InboxScreen({ onBack }: InboxScreenProps) {
  const router = useRouter();
  const { context } = useMiniKit();
  const { data: walletClient } = useWalletClient();
  const { xmtpClient, error: xmtpError } = useXmtpClient();
  const myAddr = walletClient?.account.address.toLowerCase() || "";
  const warpcast = new WarpcastService();

  // Mi nombre: Farcaster > ENS > abreviatura de wallet
  const [myName, setMyName] = useState<string>("");
  useEffect(() => {
    if (!myAddr) return;
    let active = true;
    (async () => {
      // 1) Intento Farcaster
      try {
        const [prof] = await warpcast.getWeb3BioProfiles([`farcaster,${myAddr}`]);
        if (active && prof?.displayName) {
          setMyName(prof.displayName);
          return;
        }
      } catch {}
      // 2) ENS
      try {
        const ens = await resolveNameLabel(myAddr);
        if (active && ens) {
          setMyName(ens);
          return;
        }
      } catch {}
      // 3) fallback
      if (active) {
        setMyName(abbreviateAddress(myAddr));
      }
    })();
    return () => { active = false };
  }, [myAddr, warpcast]);

  // — State hooks —
  const [conversations, setConversations] = useState<ExtendedConversation[]>([]);
  const [purchasedPeers, setPurchasedPeers] = useState<Set<string>>(new Set());
  const [soldPeers, setSoldPeers] = useState<Set<string>>(new Set());
  const [loadingList, setLoadingList] = useState(true);

  const [profilesMap, setProfilesMap] = useState<Record<string, any>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, DecodedMessage[]>>({});

  const [showComposer, setShowComposer] = useState(false);
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("all");

  const [fullImageSrc, setFullImageSrc] = useState<string | null>(null);
  const [fullFileText, setFullFileText] = useState<string | null>(null);

  const attachmentToUrl = (att: XMTPAttachment) => {
    if (typeof att.data === "string") {
      return `data:${att.mimeType};base64,${att.data}`;
    }
    let bytes: Uint8Array;
    if (att.data instanceof Uint8Array) {
      bytes = att.data;
    } else if (Array.isArray(att.data)) {
      bytes = Uint8Array.from(att.data as number[]);
    } else {
      bytes = new Uint8Array(att.data as ArrayBuffer);
    }
    const blob = new Blob([bytes], { type: att.mimeType });
    return URL.createObjectURL(blob);
  };

  const handleAttachmentClick = async (att: XMTPAttachment) => {
    if (att.mimeType.startsWith("image/")) {
      setFullImageSrc(attachmentToUrl(att));
    } else {
      const url = attachmentToUrl(att);
      const resp = await fetch(url);
      const text = await resp.text();
      setFullFileText(text);
    }
  };

  // 1️⃣ Carga inicial de conversaciones
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
      enriched.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));
      if (active) {
        setConversations(enriched);
        setLoadingList(false);
      }
    })();
    return () => { active = false };
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

  // 3️⃣ Lookup perfiles Farcaster + ENS
  useEffect(() => {
    if (conversations.length === 0) return;
    const peers = Array.from(new Set(conversations.map((c) => c.peerAddress.toLowerCase())));
    const ids = peers.map((addr) => `farcaster,${addr}`);
    (async () => {
      const newProfiles: Record<string, any> = {};
      try {
        const profiles = await warpcast.getWeb3BioProfiles(ids);
        const aliasMap: Record<string, Web3BioProfile> = {};
        profiles.forEach((p) =>
          p.aliases?.forEach((alias) => {
            const [, id] = alias.split(",");
            aliasMap[id.toLowerCase()] = p;
          })
        );
        peers.forEach((addr) => {
          if (aliasMap[addr]) newProfiles[addr] = aliasMap[addr];
        });
      } catch {}
      await Promise.all(
        peers.map(async (addr) => {
          if (newProfiles[addr]) return;
          try {
            const ens = await resolveNameLabel(addr);
            newProfiles[addr] = { displayName: ens || abbreviateAddress(addr), avatar: null };
          } catch {
            newProfiles[addr] = { displayName: abbreviateAddress(addr), avatar: null };
          }
        })
      );
      setProfilesMap(newProfiles);
    })();
  }, [conversations, warpcast]);

  // 4️⃣ Stream global de mensajes
  useEffect(() => {
    if (!xmtpClient) return;
    let active = true;
    (async () => {
      const stream = await xmtpClient.conversations.streamAllMessages();
      for await (const msg of stream) {
        if (!active) break;
        const peer = msg.conversation.peerAddress.toLowerCase();
        const isMe = msg.senderAddress.toLowerCase() === myAddr;
        setConversations((prev) =>
          prev
            .map((c) =>
              c.peerAddress.toLowerCase() === peer
                ? { ...c, updatedAt: msg.sent, hasUnread: !isMe }
                : c
            )
            .sort((a, b) => (b.updatedAt!.getTime() - a.updatedAt!.getTime()))
        );
      }
    })().catch(console.error);
    return () => { active = false };
  }, [xmtpClient, myAddr]);

  // 5️⃣ Mensajes de conversación expandida
  useEffect(() => {
    if (!xmtpClient || !expanded) return;
    let active = true;
    (async () => {
      const convo = await xmtpClient.conversations.newConversation(expanded);
      const initial = await convo.messages({
        limit: 5,
        direction: SortDirection.SORT_DIRECTION_DESCENDING,
      });
      if (!active) return;
      setMessages((prev) => ({ ...prev, [expanded]: initial.slice().reverse() }));
      const stream = await convo.streamMessages();
      for await (const msg of stream) {
        if (!active) break;
        setMessages((prev) => ({
          ...prev,
          [expanded]: [...(prev[expanded] || []), msg],
        }));
      }
    })().catch(console.error);
    return () => { active = false };
  }, [xmtpClient, expanded]);

  // Envío + notificación (usa siempre myName resuelto)
  const handleSend = async (peer: string, text: string | XMTPAttachment) => {
    if (!xmtpClient || !text) return;
    const convo = await xmtpClient.conversations.newConversation(peer);
    const conv = conversations.find((c) => c.peerAddress.toLowerCase() === peer);
    const lastSent = conv?.updatedAt;
    const now = new Date();
    const THIRTY_MIN = 30 * 60 * 1000;

    if (typeof text === "string") {
      await convo.send(text);
    } else {
      await convo.send(text, { contentType: ContentTypeAttachment });
    }

    if (lastSent && now.getTime() - lastSent.getTime() < THIRTY_MIN) return;

    const profile = profilesMap[peer];
    let fid = 0;
    if ((profile as Web3BioProfile).social?.uid) {
      fid = (profile as Web3BioProfile).social.uid;
    } else {
      try {
        fid = await warpcast.getFidByName(peer);
      } catch {}
    }

    // Título usando myName resuelto
    const title = `New ping from ${myName}`;
    const bodyText = typeof text === "string" ? text : (text as XMTPAttachment).filename;

    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fid,
        notification: { title, body: bodyText },
        targetUrl: `https://pinggate.lopezonchain.xyz/conversation/${myAddr}`,
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

  const filtered = conversations.filter((c) => {
    const peer = c.peerAddress.toLowerCase();
    if (tab === "sales") return soldPeers.has(peer);
    if (tab === "purchases") return purchasedPeers.has(peer);
    return true;
  });

  if (loadingList)
    return (
      <>
        <div className="flex-1 flex items-center justify-center text-gray-400 mt-16 mb-8">
          Loading…
        </div>
        {!xmtpClient && (
          <div className="bg-[#1a1725] text-gray-400 text-center rounded-lg shadow-md p-6 max-w-md text-black">
            <div className="flex justify-start items-center">
              <FiHelpCircle className="w-6 h-6" />
              <h2 className="m-2 text-lg font-semibold mb-2">
                Why do I need to sign something?
              </h2>
            </div>
            <p>
              This chat uses XMTP to send and receive messages. XMTP requires a
              signature the first time you join it so you can start using it,
              but don&apos;t worry, this is completely free.
              <br />
              <br />
              An additional signature is needed each time you access back to
              your messages, to decrypt them for reading. All messages are
              secured and wallet2wallet encrypted, this means only you and your
              conversation partner can view the content.
              <a className="block p-3 mt-3 bg-[#0F0D14]"
                href="https://docs.xmtp.org/intro/intro"
                target="_blank">
                More info (What is XMTP? Official docs)
              </a>
            </p>
          </div>
        )}
      </>
    );

  return (
    <div className="flex-1 flex flex-col min-h-0 max-h-[99%] bg-[#0f0d14] text-white relative">
      <button
        onClick={onBack}
        className="mb-4 flex items-center justify-center text-purple-400 px-4 py-2 bg-[#1a1725] rounded-lg max-w-[200px]"
      >
        <FiMenu className="w-5 h-5 mr-2" /> Menu
      </button>

      <div className="flex justify-center mb-4 divide-x divide-purple-600">
        {(["all", "purchases", "sales"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`
              px-6 py-3
              first:rounded-l-lg last:rounded-r-lg
              ${
                tab === t
                  ? "bg-purple-600 text-white"
                  : "bg-[#1a1725] text-gray-400 hover:bg-[#231c32]"
              }
            `}
          >
            {t === "sales" ? "Clients" : t === "purchases" ? "Bought" : "All"}
          </button>
        ))}
      </div>

      {xmtpError && <p className="text-red-500 text-center mb-2">{xmtpError}</p>}

      <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500">
        {filtered.map((conv, idx) => {
          const peer = conv.peerAddress.toLowerCase();
          const profile = profilesMap[peer];
          const label = profile
            ? abbreviateAddress(profile.displayName)
            : abbreviateAddress(peer);
          const avatarUrl = profile?.avatar || null;
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
                <div className="flex items-center space-x-2 mb-2">
                  {avatarUrl && (
                    <img
                      src={avatarUrl}
                      alt=""
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  )}
                  <span className="font-semibold">{label}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-xs text-gray-400">
                    {conv.updatedAt?.toLocaleString() || "No messages"}
                  </p>
                  <div className="flex items-center space-x-2">
                    {conv.hasUnread && <span className="text-yellow-400">📩</span>}
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
                  {(messages[peer] || [])
                    .slice(-5)
                    .map((m, i) => {
                      const isAttachment =
                        typeof m.content !== "string" && (m.content as any).data;
                      const att = isAttachment
                        ? (m.content as XMTPAttachment)
                        : null;
                      return (
                        <div
                          key={i}
                          className={`flex flex-col max-w-[80%] py-1 px-3 rounded-lg ${
                            m.senderAddress.toLowerCase() === myAddr
                              ? "bg-purple-600 ml-auto"
                              : "bg-[#2a2438]"
                          }`}
                        >
                          {att ? (
                            <div
                              className="flex items-center space-x-2 cursor-pointer"
                              onClick={() => handleAttachmentClick(att)}
                            >
                              {att.mimeType.startsWith("image/") ? (
                                <img
                                  src={attachmentToUrl(att)}
                                  alt={att.filename}
                                  className="max-h-40 object-contain rounded"
                                />
                              ) : (
                                <>
                                  <FiFile className="w-6 h-6 text-gray-300" />
                                  <span className="truncate text-sm">
                                    {att.filename}
                                  </span>
                                </>
                              )}
                            </div>
                          ) : (
                            <div className="text-center">{m.content}</div>
                          )}
                          <span className="text-[10px] text-gray-300 text-right">
                            {m.sent?.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      );
                    })}
                  <MessageInput onSend={(t) => handleSend(peer, t)} inConversation={false}/>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <button
        onClick={() => setShowComposer(true)}
        className="fixed bottom-6 right-6 z-25 bg-purple-600 hover:bg-purple-700 text-white text-3xl w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
        aria-label="New Conversation"
      >
        <FiPlus />
      </button>

      {showComposer && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
          <div className="bg-[#1a1725] p-6 rounded-xl w-full max-w-md space-y-4">
            <h3 className="text-lg font-bold text-white">New Conversation</h3>
            {err && <p className="text-red-400">{err}</p>}
            <input
              type="text"
              placeholder="Farcaster name / Basename or ENS / Wallet"
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

      {fullImageSrc && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50"
          onClick={() => setFullImageSrc(null)}
        >
          <img
            src={fullImageSrc}
            alt="Full screen"
            className="max-h-full max-w-full"
          />
        </div>
      )}

      {fullFileText && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
          onClick={() => setFullFileText(null)}
        >
          <pre className="bg-[#1a1725] text-white p-4 rounded-xl max-h-full overflow-auto">
            {fullFileText}
          </pre>
        </div>
      )}
    </div>
  );
}
