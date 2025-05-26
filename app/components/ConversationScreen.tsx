// src/components/ConversationScreen.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import { useWalletClient } from "wagmi";
import { FiArrowLeft, FiFile } from "react-icons/fi";
import { useXmtpClient } from "../hooks/useXmtpClient";
import { resolveNameLabel } from "../services/resolveNameLabel";
import { WarpcastService, Web3BioProfile } from "../services/warpcastService";
import MessageInput, { XMTPAttachment } from "./MessageInput";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { ContentTypeAttachment } from "@xmtp/content-type-remote-attachment";
import {
  Client,
  DecodedMessage,
  SortDirection,
} from "@xmtp/browser-sdk";

interface ConversationScreenProps {
  peerAddress: string;
  onBack: () => void;
}

export default function ConversationScreen({
  peerAddress,
  onBack,
}: ConversationScreenProps) {
  const { data: walletClient } = useWalletClient();
  const { xmtpClient } = useXmtpClient();
  const myAddress = walletClient?.account.address.toLowerCase() || "";
  const myInboxId = xmtpClient?.inboxId || "";
  const warpcast = new WarpcastService();
  const { context } = useMiniKit();

  const [displayName, setDisplayName] = useState<string>(peerAddress);
  const [profile, setProfile] = useState<Web3BioProfile>();
  const [messages, setMessages] = useState<DecodedMessage<unknown>[]>([]);
  const [fullImageSrc, setFullImageSrc] = useState<string | null>(null);
  const [fullFileText, setFullFileText] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const attachmentToUrl = (att: XMTPAttachment): string => {
    if (typeof att.data === "string") {
      return `data:${att.mimeType};base64,${att.data}`;
    }
    const bytes = att.data instanceof Uint8Array
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

  useEffect(() => {
    if (!xmtpClient) return;
    let active = true;
    let stopStream: (() => Promise<void>) | null = null;

    (async () => {
      // 1) Verificar que podemos mensajear al peer
      const identity = {
        identifier: peerAddress.toLowerCase(),
        identifierKind: "Ethereum" as const,
      };
      const canMsg = await Client.canMessage([identity]);
      if (!canMsg.get(identity.identifier)) {
        console.warn(`No es posible enviar mensajes a ${peerAddress}`);
        return;
      }

      // 2) Crear o recuperar la conversación DM
      const convo = await xmtpClient.conversations.newDm(identity.identifier);

      // 3) Fetch inicial: hasta 50 mensajes, descendentemente
      const initial = await convo.messages({
        limit: BigInt(50)
      });
      if (!active) return;
      setMessages(initial.slice().reverse());

      // 4) Stream global de mensajes y filtrado por conversationId
      const stream = await xmtpClient.conversations.streamAllMessages();
      stopStream = async () => {
        if (typeof (stream as any).return === "function") {
          await (stream as any).return();
        }
      };
      for await (const msg of stream) {
        if (!active) break;
        if (msg?.conversationId === convo.id) {
          setMessages((prev) => [...prev, msg]);
        }
      }
    })().catch(console.error);

    return () => {
      active = false;
      if (stopStream) stopStream();
    };
  }, [xmtpClient, peerAddress]);

  // Auto-scroll al final
  useEffect(() => {
    const c = scrollContainerRef.current;
    if (c) {
      requestAnimationFrame(() => {
        c.scrollTop = c.scrollHeight;
      });
    }
  }, [messages]);

  const handleSend = async (text: string | XMTPAttachment) => {
    if (!xmtpClient || !text) return;
    const convo = await xmtpClient.conversations.newDm(peerAddress.toLowerCase());
    if (typeof text === "string") {
      await convo.send(text);
    } else {
      await convo.send(text, ContentTypeAttachment);
    }

    // Notificación Warpcast (igual que antes)...
    let fid = 0;
    if (profile?.social?.uid) {
      fid = profile.social.uid;
    } else {
      try {
        fid = await warpcast.getFidByName(peerAddress);
      } catch {
        return;
      }
    }
    let myName: string;
    try {
      myName = await resolveNameLabel(myAddress);
    } catch {
      myName = myAddress;
    }
    const sender = context?.user?.displayName ?? myName;
    const title = `New ping from ${sender}`;
    const body =
      typeof text === "string"
        ? text
        : `Sent you a file: ${(text as XMTPAttachment).filename}`;

    fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fid,
        notification: { title, body },
        targetUrl: `https://pinggate.lopezonchain.xyz/conversation/${myAddress}`,
      }),
    }).catch(console.error);
  };

  return (
    <div className="flex flex-col h-screen bg-[#0f0d14] text-white w-full max-w-md mx-auto">
      {/* Cabecera */}
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

      {/* Mensajes */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500"
        >
          {messages.map((m, i) => {
            const isMe = m.senderInboxId === myInboxId;
            // convertir de ns a ms
            const sentMs = Number(m.sentAtNs / BigInt(1000000));
            const time = new Date(sentMs).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            const isAtt =
              m.content !== undefined && (m.content as any).data !== undefined;
            const att = isAtt ? (m.content as XMTPAttachment) : null;

            return (
              <div key={i} className="flex flex-col h-screen bg-[#0f0d14] text-white w-full max-w-md mx-auto">
                {/* Cabecera */}
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

                {/* Mensajes */}
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500"
                  >
                    {messages.map((m, i) => {
                      const isMe = m.senderInboxId === myInboxId;
                      const sentMs = Number(m.sentAtNs / BigInt(1000000));
                      const key = `${m.senderInboxId}-${sentMs}`;
                      const time = new Date(sentMs).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      });

                      const isAtt =
                        m.content !== undefined && (m.content as any).data !== undefined;
                      const att = isAtt ? (m.content as XMTPAttachment) : null;

                      // Aquí definimos un texto seguro para renderizar
                      const text =
                        typeof m.content === "string"
                          ? m.content
                          : m.fallback ?? "";

                      return (
                        <div
                          key={key}
                          className={`flex flex-col text-sm max-w-[80%] p-2 rounded-lg break-words ${isMe ? "bg-purple-600 ml-auto" : "bg-[#2a2438]"
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
                            <div className="text-center">{text}</div>
                          )}
                          <span className="text-[10px] text-gray-300 text-right">
                            {time}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Input */}
                  <div className="border-t border-gray-700 p-4">
                    <MessageInput onSend={(t) => handleSend(t)} inConversation={true} />
                  </div>
                </div>

                {/* Modal Imagen */}
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

                {/* Modal Archivo */}
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
          })}
        </div>

        {/* Input */}
        <div className="border-t border-gray-700 p-4">
          <MessageInput onSend={(t) => handleSend(t)} inConversation={true} />
        </div>
      </div>

      {/* Modal de imagen */}
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

      {/* Modal de archivo */}
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
