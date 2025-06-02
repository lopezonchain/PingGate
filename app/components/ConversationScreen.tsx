// src/components/ConversationScreen.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { DecodedMessage, SortDirection } from "@xmtp/xmtp-js";
import { useWalletClient, useConnect } from "wagmi";
import { FiArrowLeft, FiFile } from "react-icons/fi";
import { useXmtpClient } from "../hooks/useXmtpClient";
import { resolveNameLabel } from "../services/resolveNameLabel";
import { getServicesBy, getPurchasesBy } from "../services/contractService";
import { WarpcastService, Web3BioProfile } from "../services/warpcastService";
import MessageInput, { XMTPAttachment } from "./MessageInput";
import { useRouter } from "next/navigation";
import { ContentTypeAttachment } from "@xmtp/content-type-remote-attachment";

interface ConversationScreenProps {
  peerAddress: string;
  onBack: () => void;
}

export default function ConversationScreen({
  peerAddress,
  onBack,
}: ConversationScreenProps) {
  const router = useRouter();

  // 1) Wagmi: walletClient y método para conectar
  const { data: walletClient, isLoading: walletLoading } = useWalletClient();
  const { connect, connectors } = useConnect();

  // 2) XMTP: hook que expone xmtpClient y xmtpError
  const { xmtpClient, error: xmtpError } = useXmtpClient();

  const myAddress = walletClient?.account.address.toLowerCase() || "";
  const warpcast = React.useMemo(() => new WarpcastService(), []);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // — Display name y avatar
  const [displayName, setDisplayName] = useState<string>(peerAddress);
  const [profile, setProfile] = useState<Web3BioProfile | null>(null);

  // — Gating state
  const [checkedGate, setCheckedGate] = useState(false);
  const [hasPeerServices, setHasPeerServices] = useState(false);
  const [hasPurchasedService, setHasPurchasedService] = useState(false);

  // — Mensajes
  const [messages, setMessages] = useState<DecodedMessage[]>([]);

  // — Preview de attachments
  const [fullImageSrc, setFullImageSrc] = useState<string | null>(null);
  const [fullFileText, setFullFileText] = useState<string | null>(null);

  // — Error de conexión XMTP
  const [displayError, setDisplayError] = useState<string | null>(null);

  // =========================
  // 1️⃣  Si no hay walletClient, mostramos "Connect Wallet"
  // =========================
  if (!walletClient && !walletLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0f0d14] text-white p-4">
        <p className="mb-4 text-gray-400">
          Para ver esta conversación necesitas conectar tu wallet.
        </p>
        {connectors.map((c) => (
          <button
            key={c.id}
            onClick={() => connect({ connector: c })}
            className="px-4 py-2 mb-2 bg-purple-600 hover:bg-purple-700 rounded text-white"
          >
            Conectar con {c.name}
          </button>
        ))}
        {walletLoading && (
          <p className="text-gray-400 mt-2">Cargando wallet…</p>
        )}
      </div>
    );
  }

  // 2️⃣  Si hay walletClient pero XMTP no está listo, mostramos Loading mientras xmtpClient llega
  if (walletClient && !xmtpClient) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0f0d14] text-white p-4">
        <p className="text-gray-400 mb-2">Inicializando chat seguro (XMTP)…</p>
        {xmtpError && (
          <p className="text-red-500">
            Error conectando a XMTP: {xmtpError}
          </p>
        )}
      </div>
    );
  }

  // 3️⃣  Fetch Farcaster/ENS profile
  useEffect(() => {
    let active = true;
    const warp = new WarpcastService();

    (async () => {
      const addr = peerAddress.toLowerCase();
      try {
        const ids = [`farcaster,${addr}`];
        const profiles = await warp.getWeb3BioProfiles(ids);
        const aliasMap: Record<string, Web3BioProfile> = {};
        profiles.forEach((p) =>
          p.aliases?.forEach((alias) => {
            const [, id] = alias.split(",");
            aliasMap[id.toLowerCase()] = p;
          })
        );
        const prof = aliasMap[addr];
        if (active && prof) {
          setProfile(prof);
          setDisplayName(prof.displayName);
          return;
        }
      } catch {
        // ignorar
      }
      if (active) {
        try {
          const ens = await resolveNameLabel(addr);
          if (ens) {
            setDisplayName(ens);
            return;
          }
        } catch {
          // ignorar
        }
        setDisplayName(peerAddress);
      }
    })();

    return () => {
      active = false;
    };
  }, [peerAddress]);

  // 4️⃣  Check de “gating” (servicios + compras)
  useEffect(() => {
    if (!walletClient) return;
    let active = true;

    (async () => {
      const addrPeer = peerAddress as `0x${string}`;
      const addrMe = myAddress as `0x${string}`;

      // 4.1) Obtener servicios del peer
      let peerServiceIds: bigint[] = [];
      try {
        peerServiceIds = await getServicesBy(addrPeer);
      } catch {
        peerServiceIds = [];
      }
      if (!active) return;

      if (peerServiceIds.length === 0) {
        setHasPeerServices(false);
        setHasPurchasedService(true);
        setCheckedGate(true);
        return;
      }
      setHasPeerServices(true);

      // 4.2) Obtener compras mías
      let myPurchaseIds: bigint[] = [];
      try {
        myPurchaseIds = await getPurchasesBy(addrMe);
      } catch {
        myPurchaseIds = [];
      }
      if (!active) return;

      const setPeerIds = new Set(peerServiceIds.map((b) => b.toString()));
      const purchased = myPurchaseIds.some((pid) =>
        setPeerIds.has(pid.toString())
      );

      setHasPurchasedService(purchased);
      setCheckedGate(true);
    })().catch(console.error);

    return () => {
      active = false;
    };
  }, [peerAddress, walletClient, myAddress]);

  // 5️⃣  Cargar mensajes XMTP si pasa gating
  useEffect(() => {
    if (
      !xmtpClient ||
      !checkedGate ||
      (hasPeerServices && !hasPurchasedService)
    ) {
      return;
    }

    let active = true;
    let stream: AsyncIterable<DecodedMessage>;

    (async () => {
      const convo = await xmtpClient.conversations.newConversation(peerAddress);
      const initial = await convo.messages({
        limit: 50,
        direction: SortDirection.SORT_DIRECTION_DESCENDING,
      });
      if (!active) return;
      setMessages(initial.slice().reverse());

      stream = await convo.streamMessages();
      for await (const msg of stream) {
        if (!active) break;
        setMessages((prev) => [...prev, msg]);
      }
    })().catch(console.error);

    return () => {
      active = false;
      if (stream && typeof (stream as any).return === "function") {
        (stream as any).return();
      }
    };
  }, [xmtpClient, peerAddress, checkedGate, hasPeerServices, hasPurchasedService]);

  // 6️⃣  Scroll automático cuando llegan mensajes
  useEffect(() => {
    const c = scrollContainerRef.current;
    if (c) {
      requestAnimationFrame(() => {
        c.scrollTop = c.scrollHeight;
      });
    }
  }, [messages]);

  // 7️⃣  Envío de nuevos mensajes
  const handleSend = async (text: string | XMTPAttachment) => {
    if (!xmtpClient || !text) return;
    const convo = await xmtpClient.conversations.newConversation(peerAddress);

    if (typeof text === "string") {
      await convo.send(text);
    } else {
      await convo.send(text, { contentType: ContentTypeAttachment });
    }

    // Notificación opcional…
    let fid = 0;
    if (profile?.social?.uid) {
      fid = profile.social.uid;
    } else {
      try {
        fid = await warpcast.getFidByName(peerAddress);
      } catch {
        /* ignorar */
      }
    }

    let myName: string;
    try {
      myName = await resolveNameLabel(myAddress);
    } catch {
      myName = myAddress;
    }

    const title = `New ping from ${myName}`;
    const bodyText =
      typeof text === "string" ? text : (text as XMTPAttachment).filename;

    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fid,
        notification: { title, body: bodyText },
        targetUrl: `https://pinggate.lopezonchain.xyz/conversation/${myAddress}`,
      }),
    }).catch(console.error);
  };

  // — Funciones para attachments
  const attachmentToUrl = (att: XMTPAttachment): string => {
    if (typeof att.data === "string") {
      return `data:${att.mimeType};base64,${att.data}`;
    }
    const bytes =
      att.data instanceof Uint8Array
        ? att.data
        : Array.isArray(att.data)
        ? Uint8Array.from(att.data as number[])
        : new Uint8Array(att.data as ArrayBuffer);
    return URL.createObjectURL(new Blob([bytes], { type: att.mimeType }));
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

  // =========================
  // Render condicional
  // =========================

  // 1) Loading de gating antes de terminar la comprobación
  if (!checkedGate) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0f0d14] text-white">
        <span className="text-gray-400">Loading chat…</span>
      </div>
    );
  }

  // 2) Si gated y no se compró el servicio, mostrar modal de gated
  if (hasPeerServices && !hasPurchasedService) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
        <div className="bg-[#1a1725] text-white p-6 rounded-lg max-w-sm w-full mx-4">
          <h2 className="text-xl font-semibold">Gated Chat</h2>
          <p className="mt-2">
            Este usuario tiene un chat privado. Para continuar, compra su servicio
            primero.
          </p>
          <div className="mt-4 flex flex-col space-y-2">
            <button
              onClick={() => router.push(`/user/${peerAddress}`)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white"
            >
              Ver servicios de este usuario
            </button>
            <button
              onClick={onBack}
              className="px-4 py-2 text-gray-400 hover:underline"
            >
              Volver
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3) Render completo de chat ya desbloqueado
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
        {profile?.avatar && (
          <img
            src={profile.avatar}
            alt=""
            className="w-5 h-5 rounded-full object-cover"
          />
        )}
        <h2 className="flex-1 text-center font-semibold truncate">
          {displayName}
        </h2>
      </div>

      {/* Messages list */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500"
        >
          {messages.map((m, i) => {
            const isMe = m.senderAddress.toLowerCase() === myAddress;
            const time = m.sent
              ? m.sent.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            const isAtt =
              typeof m.content !== "string" && (m.content as any).data;
            const att = isAtt ? (m.content as XMTPAttachment) : null;

            return (
              <div
                key={i}
                className={`flex flex-col text-sm max-w-[80%] p-2 rounded-lg break-words ${
                  isMe ? "bg-purple-600 ml-auto" : "bg-[#2a2438]"
                }`}
                style={{ hyphens: "auto" }}
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
                        <span className="truncate text-sm">{att.filename}</span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center">{m.content}</div>
                )}
                <span className="text-[10px] text-gray-300 text-right">
                  {time}
                </span>
              </div>
            );
          })}
        </div>

        {/* Input area */}
        <div className="border-t border-gray-700 p-4">
          <MessageInput onSend={(t) => handleSend(t)} inConversation={true} />
        </div>
      </div>

      {/* Full-screen image preview */}
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

      {/* Full-screen file text */}
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
