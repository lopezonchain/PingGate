// src/components/ConversationScreen.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  AsyncStream,
  Client,
  ConsentState,
  type DecodedMessage,
  IdentifierKind,
  SortDirection,
} from "@xmtp/browser-sdk";
import { useWalletClient, useConnect } from "wagmi";
import { FiArrowLeft, FiFile } from "react-icons/fi";
import { useXmtpClient } from "../hooks/useXmtpClient";
import { resolveNameLabel } from "../services/resolveNameLabel";
import { getServicesBy, getPurchasesBy } from "../services/contractService";
import { WarpcastService, Web3BioProfile } from "../services/warpcastService";
import MessageInput, { XMTPAttachment } from "./MessageInput";
import { useRouter } from "next/navigation";
import { ContentTypeAttachment } from "@xmtp/content-type-remote-attachment";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import sdk from "@farcaster/frame-sdk";

interface ConversationScreenProps {
  peerAddress: string; // Puedes pasar aquí el inboxId o la dirección ETH del peer
  onBack: () => void;
}

function abbreviateAddress(addr: string) {
  const isEthAddress = /^0x[a-fA-F0-9]{40}$/.test(addr);
  if (!isEthAddress) return addr;
  return addr.slice(0, 7) + "…" + addr.slice(-5);
}

export default function ConversationScreen({
  peerAddress,
  onBack,
}: ConversationScreenProps) {
  const router = useRouter();

  // 1) Wagmi: walletClient y connect
  const { data: walletClient, isLoading: walletLoading } = useWalletClient();
  const { connect, connectors } = useConnect();

  // 2) XMTP: hook que nos da xmtpClient y xmtpError
  const { xmtpClient, error: xmtpError } = useXmtpClient();
  const [myInboxId, setMyInboxId] = useState<string>("");

  const myAddress = walletClient?.account.address.toLowerCase() || "";
  const warpcast = React.useMemo(() => new WarpcastService(), []);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // — Nombre a mostrar y avatar
  const [displayName, setDisplayName] = useState<string>(peerAddress);
  const [profile, setProfile] = useState<Web3BioProfile | null>(null);

  const [myName, setMyName] = useState<string>(peerAddress);

  // — Estado de “gating”
  const [checkedGate, setCheckedGate] = useState(false);
  const [hasPeerServices, setHasPeerServices] = useState(false);
  const [hasPurchasedService, setHasPurchasedService] = useState(false);

  // — Mensajes
  const [messages, setMessages] = useState<DecodedMessage[]>([]);

  // — Preview para adjuntos
  const [fullImageSrc, setFullImageSrc] = useState<string | null>(null);
  const [fullFileText, setFullFileText] = useState<string | null>(null);

  const { setFrameReady, isFrameReady } = useMiniKit();
  
  useEffect(() => {
      if (!isFrameReady) setFrameReady();
      (async () => {
        await sdk.actions.ready({ disableNativeGestures: true });
      })();
  }, [isFrameReady, setFrameReady]);

  useEffect(() => {
    if (!xmtpClient) return;

    (async () => {
      try {
        const { inboxId } = await xmtpClient.preferences.inboxState();
        setMyInboxId(inboxId);
      } catch (err) {
        console.error("Couldn't get inboxId:", err);
      }
    })();
  }, [xmtpClient]);

  useEffect(() => {
    const myAddr = walletClient?.account.address;
      if (!myAddr) return;
      let active = true;
  
      (async () => {
        try {
          const [prof] = await warpcast.getWeb3BioProfiles([`farcaster,${myAddr}`]);
          if (active && prof?.displayName) {
            setMyName(prof.displayName);
            return;
          }
        } catch {
          // Ignorar
        }
  
        try {
          const ens = await resolveNameLabel(myAddr);
          if (active && ens) {
            setMyName(ens);
            return;
          }
        } catch {
          // Ignorar
        }
  
        if (active) {
          setMyName(abbreviateAddress(myAddr));
        }
      })();
  
      return () => {
        active = false;
      };
    }, [walletClient, warpcast]);

  // =========================
  // Cargar perfil Farcaster/ENS
  // =========================
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

  // =========================
  // Chequear gating (servicios del peer + compras propias)
  // =========================
  useEffect(() => {
    if (!walletClient) return;
    let active = true;

    (async () => {
      const addrPeer = peerAddress as `0x${string}`;
      const addrMe = myAddress as `0x${string}`;

      // 1) Obtener IDs de servicios que vende el peer
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

      // 2) Chequear si yo compré alguno
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

  // =========================
  // Cargar mensajes XMTP si pasamos el gating
  // =========================
  useEffect(() => {
  if (
    !xmtpClient ||
    !checkedGate ||
    (hasPeerServices && !hasPurchasedService)
  ) {
    return;
  }

  let active = true;
  let stream: AsyncStream<DecodedMessage> | undefined;

  (async () => {
    // 1) Primero: verificar si el peer está reachable en XMTP
    const canPeer = await xmtpClient.canMessage([
      { identifier: peerAddress, identifierKind: "Ethereum" }
    ]);

    if (!canPeer) {
      console.warn("Peer no está en XMTP; no hay conversación posible");
      return;
    }

    // 2) Sincronizar todas las conversaciones para asegurarnos de ver el 'welcome'
    await xmtpClient.conversations.syncAll([ConsentState.Allowed]);

    // 3) Ahora sí: obtenemos (o creamos) el DM de dos miembros
    const peerIdentifier = {
      identifier: peerAddress,
      identifierKind: "Ethereum" as IdentifierKind,
    };
    const convo = await xmtpClient.conversations.newDmWithIdentifier(peerIdentifier);

    // 4) Cargar mensajes iniciales (descendentes) y revertir el array
    const initial = await convo.messages({
      limit: BigInt(50),
      direction: SortDirection.Descending,
    });
    if (!active) return;
    setMessages(initial.slice().reverse());

    // 5) Abrir el stream de nuevos mensajes
    stream = await convo.stream();
    const iterableStream = stream as unknown as AsyncIterable<DecodedMessage>;

    for await (const msg of iterableStream) {
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



  // =========================
  // Auto-scroll cuando cambian los mensajes
  // =========================
  useEffect(() => {
    const c = scrollContainerRef.current;
    if (c) {
      requestAnimationFrame(() => {
        c.scrollTop = c.scrollHeight;
      });
    }
  }, [messages]);

  // =========================
  // Enviar un nuevo mensaje
  // =========================
  const handleSend = async (text: string | XMTPAttachment) => {
    if (!xmtpClient || !text) return;
    const peerIdentifier = {
      identifier: peerAddress,
      identifierKind: "Ethereum" as IdentifierKind,
    };
    const convo = await xmtpClient.conversations.newDmWithIdentifier(peerIdentifier);

    if (typeof text === "string") {
      await convo.sendOptimistic(text);
    } else {
      await convo.sendOptimistic(text, ContentTypeAttachment);
    }

    // Opcional: enviar notificación
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

  // — Helpers para attachments
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

  // Si walletClient existe pero xmtpClient aún no, mostramos loading
  if (walletClient && !xmtpClient) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0f0d14] text-white p-4">
        <p className="text-gray-400 mb-2">Initializing secure chat (XMTP)…</p>
        {xmtpError && (
          <p className="text-red-500">
            Error connecting to XMTP: {xmtpError}
          </p>
        )}
      </div>
    );
  }

  // Mientras chequeamos el gating, mostramos loading
  if (!checkedGate) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0f0d14] text-white">
        <span className="text-gray-400">Loading chat…</span>
      </div>
    );
  }

  // Si está gated y no compramos, mostramos modal de gated
  if (hasPeerServices && !hasPurchasedService) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
        <div className="bg-[#1a1725] text-white p-6 rounded-lg max-w-sm w-full mx-4">
          <h2 className="text-xl font-semibold">Gated Chat</h2>
          <p className="mt-2">
            This user has a private chat. To continue, please purchase their
            service first.
          </p>
          <div className="mt-4 flex flex-col space-y-2">
            <button
              onClick={() => router.push(`/user/${peerAddress}`)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white"
            >
              View this user’s services
            </button>
            <button
              onClick={onBack}
              className="px-4 py-2 text-gray-400 hover:underline"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =================================
  // Render principal del chat completo
  // =================================
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

      {/* Lista de mensajes */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500"
        >
          {messages.map((m, i) => {
            // Aquí comparamos con la propiedad senderInboxId
            const isMe = m.senderInboxId === myInboxId;
            const time = m.sentAtNs
              ? new Date(Number(m.sentAtNs / BigInt(1000000))).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "";
            const isAtt = typeof m.content !== "string" && (m.content as any).data;
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
                        <span className="truncate text-sm">
                          {att.filename}
                        </span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    {typeof m.content === "string" ? m.content : ""}
                  </div>
                )}
                <span className="text-[10px] text-gray-300 text-right">
                  {time}
                </span>
              </div>
            );
          })}
        </div>

        {/* Área de input */}
        <div className="border-t border-gray-700 p-4">
          <MessageInput onSend={(t) => handleSend(t)} />
        </div>
      </div>

      {/* Preview de imagen a pantalla completa */}
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

      {/* Preview de texto de archivo a pantalla completa */}
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
