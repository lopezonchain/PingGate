// src/components/ConversationScreen.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import {
  AsyncStream,
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
import Link from "next/link";
import { ConnectWallet, Wallet, WalletDropdown, WalletDropdownDisconnect, WalletModal } from "@coinbase/onchainkit/wallet";
import { Avatar, Name, Identity, Address, EthBalance } from "@coinbase/onchainkit/identity";
import farcasterFrame from "@farcaster/frame-wagmi-connector";
import { Button } from "../page-client";

interface ConversationScreenProps {
  peerAddress: string;
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
  const { data: walletClient } = useWalletClient();
  const { connectAsync, connectors } = useConnect();
  const { xmtpClient, error: xmtpError } = useXmtpClient();
  const [myInboxId, setMyInboxId] = useState<string>("");
  const myAddress = walletClient?.account.address.toLowerCase() || "";
  const warpcast = React.useMemo(() => new WarpcastService(), []);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [displayName, setDisplayName] = useState<string>(peerAddress);
  const [profile, setProfile] = useState<Web3BioProfile | null>(null);
  const [myName, setMyName] = useState<string>(peerAddress);

  const [checkedGate, setCheckedGate] = useState(false);
  const [hasPeerServices, setHasPeerServices] = useState(false);
  const [hasPurchasedService, setHasPurchasedService] = useState(false);

  const [messages, setMessages] = useState<DecodedMessage[]>([]);
  const [fullImageSrc, setFullImageSrc] = useState<string | null>(null);
  const [fullFileText, setFullFileText] = useState<string | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [farcasterContext, setFarcasterContext] = useState<any>(null);

  const { setFrameReady, isFrameReady } = useMiniKit();

  // SDK Farcaster ready
  useEffect(() => {
    if (!isFrameReady) setFrameReady();
    (async () => {
      await sdk.actions.ready({ disableNativeGestures: true });
    })();
  }, [isFrameReady, setFrameReady]);

  useEffect(() => {
    let mounted = true;
    sdk.context
      .then((ctx) => {
        if (mounted) setFarcasterContext(ctx);
      })
      .catch((err) => {
        console.error("failed to load Farcaster context", err);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Obtener mi inboxId
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

  // Resolver mi nombre (Farcaster / ENS / fallback)
  useEffect(() => {
    if (!walletClient?.account.address) return;
    let active = true;
    (async () => {
      try {
        const [prof] = await warpcast.getWeb3BioProfiles([
          `farcaster,${walletClient.account.address}`,
        ]);
        if (active && prof?.displayName) {
          setMyName(prof.displayName);
          return;
        }
      } catch { }
      try {
        const ens = await resolveNameLabel(walletClient.account.address);
        if (active && ens) {
          setMyName(ens);
          return;
        }
      } catch { }
      if (active) {
        setMyName(abbreviateAddress(walletClient.account.address));
      }
    })();
    return () => {
      active = false;
    };
  }, [walletClient, warpcast]);

  // Cargar perfil del peer (Farcaster / ENS)
  useEffect(() => {
    let active = true;
    (async () => {
      const addr = peerAddress.toLowerCase();
      try {
        const profiles = await warpcast.getWeb3BioProfiles([`farcaster,${addr}`]);
        const aliasMap: Record<string, Web3BioProfile> = {};
        profiles.forEach((p) =>
          p.aliases?.forEach((alias) => {
            const [, id] = alias.split(",");
            aliasMap[id.toLowerCase()] = p;
          })
        );
        if (active && aliasMap[addr]) {
          setProfile(aliasMap[addr]);
          setDisplayName(aliasMap[addr].displayName);
          return;
        }
      } catch { }
      if (active) {
        try {
          const ens = await resolveNameLabel(addr);
          if (ens) {
            setDisplayName(ens);
            return;
          }
        } catch { }
        setDisplayName(peerAddress);
      }
    })();
    return () => {
      active = false;
    };
  }, [peerAddress, warpcast]);

  // Chequear gating: servicios del peer vs. mis compras
  useEffect(() => {
    if (!walletClient) return;
    let active = true;
    (async () => {
      const addrPeer = peerAddress as `0x${string}`;
      const addrMe = myAddress as `0x${string}`;
      let peerServiceIds: bigint[] = [];
      try {
        peerServiceIds = await getServicesBy(addrPeer);
      } catch { }
      if (!active) return;

      if (peerServiceIds.length === 0) {
        setHasPeerServices(false);
        setHasPurchasedService(true);
        setCheckedGate(true);
        return;
      }
      setHasPeerServices(true);

      let myPurchaseIds: bigint[] = [];
      try {
        myPurchaseIds = await getPurchasesBy(addrMe);
      } catch { }
      if (!active) return;

      const peerSet = new Set(peerServiceIds.map((b) => b.toString()));
      setHasPurchasedService(myPurchaseIds.some((pid) => peerSet.has(pid.toString())));
      setCheckedGate(true);
    })().catch(console.error);
    return () => {
      active = false;
    };
  }, [peerAddress, walletClient, myAddress]);

  // Cargar mensajes XMTP (gating + syncAll + sync de la conversación)
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
      // 1) Verificar si el peer es mensageable
      const canPeer = await xmtpClient.canMessage([
        { identifier: peerAddress, identifierKind: "Ethereum" },
      ]);
      if (!canPeer) {
        console.warn("Peer no está en XMTP; no hay conversación posible");
        return;
      }

      // 2) Sincronizar todas las conversaciones (incluye Unknown)
      await xmtpClient.conversations.syncAll();

      // 3) Obtener instancia DM y forzar sync
      const peerIdentifier = {
        identifier: peerAddress,
        identifierKind: "Ethereum" as IdentifierKind,
      };
      const convo = await xmtpClient.conversations.newDmWithIdentifier(
        peerIdentifier
      );
      await convo.sync();

      // 4) Cargar últimos 50 mensajes
      const initial = await convo.messages({
        limit: BigInt(50),
        direction: SortDirection.Descending,
      });
      if (!active) return;
      setMessages(initial.slice().reverse());

      // 5) Stream de nuevos mensajes
      stream = await convo.stream();
      for await (const msg of stream as unknown as AsyncIterable<DecodedMessage>) {
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

  // Auto-scroll al final
  useEffect(() => {
    const c = scrollContainerRef.current;
    if (c) {
      requestAnimationFrame(() => {
        c.scrollTop = c.scrollHeight;
      });
    }
  }, [messages]);

  // Enviar mensaje
  const handleSend = async (text: string | XMTPAttachment) => {
    if (!xmtpClient || !text) return;
    const peerIdentifier = {
      identifier: peerAddress,
      identifierKind: "Ethereum" as IdentifierKind,
    };
    const convo = await xmtpClient.conversations.newDmWithIdentifier(
      peerIdentifier
    );
    if (typeof text === "string") {
      await convo.send(text);
    } else {
      await convo.send(text, ContentTypeAttachment);
    }
    // notificación (igual que antes)...
  };

  // Helpers attachments
  const attachmentToUrl = (att: XMTPAttachment) => {
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

  // Render loading / gating / error
  if (walletClient && !xmtpClient) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0f0d14] text-white p-4">
        <p className="text-gray-400 mb-2">Initializing secure chat (XMTP)…</p>
        {xmtpError && (
          <p className="text-red-500">Error connecting to XMTP: {xmtpError}</p>
        )}
      </div>
    );
  }
  if (!checkedGate) {
    return (
      <div className="flex flex-col h-screen bg-[#0f0d14] text-white w-full max-w-md mx-auto px-1">
        <header className="flex justify-between items-center mb-3 h-11">
          <Link href="/?view=home" shallow>
            <img src="/PingGateLogoNoBG.png" alt="PingGate Home" className="w-12 h-12" />
          </Link>
          <div className="flex justify-end space-x-2 w-full z-50 pt-2">
            <Wallet>
              {myAddress ? (
                <>
                  <ConnectWallet>
                    <Avatar className="h-6 w-6" />
                    <Name />
                  </ConnectWallet>
                  <WalletDropdown classNames={{
                    container: 'max-sm:pb-20'
                  }}>
                    <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                      <Avatar />
                      <Name />
                      <Address />
                      <EthBalance />
                    </Identity>
                    <WalletDropdownDisconnect />
                  </WalletDropdown>
                </>
              ) : farcasterContext ? (
                <Button
                  onClick={() => connectAsync({ connector: farcasterFrame() })}
                  size="md"
                  className="cursor-pointer ock-bg-primary active:bg-[var(--ock-bg-primary-active)] active:shadow-inner ock-border-radius ock-font-family font-semibold ock-text-inverse inline-flex items-center justify-center px-4 py-3 min-w-[153px]"
                >
                  Connect Farcaster
                </Button>
              ) : (
                // if not connected, show our own connect button
                <Button
                  onClick={() => setIsWalletModalOpen(!isWalletModalOpen)}
                  size="md"
                  className={`cursor-pointer ock-bg-primary active:bg-[var(--ock-bg-primary-active)] active:shadow-inner ock-border-radius ock-font-family font-semibold ock-text-inverse inline-flex items-center justify-center px-4 py-3 min-w-[153px]`}
                >
                  Connect
                </Button>
              )}
            </Wallet>
          </div>
        </header>
        <div className="flex justify-center items-center h-full px-4 py-2">
          <span className="text-gray-400">Loading chat… Connect a wallet if you didn&apos;t yet</span>
        </div>
        <WalletModal
          isOpen={isWalletModalOpen}
          onClose={() => {
            setIsWalletModalOpen(false);
          }}
        />
      </div>
    );
  }
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

  // Render principal
  return (
    <div className="flex flex-col h-screen bg-[#0f0d14] text-white w-full max-w-md mx-auto px-1">
      <header className="flex justify-between items-center mb-3 h-11">
        <Link href="/?view=home" shallow>
          <img src="/PingGateLogoNoBG.png" alt="PingGate Home" className="w-12 h-12" />
        </Link>
        <div className="flex justify-end space-x-2 w-full z-50 pt-2">
          <Wallet>
            {myAddress ? (
              <>
                <ConnectWallet>
                  <Avatar className="h-6 w-6" />
                  <Name />
                </ConnectWallet>
                <WalletDropdown classNames={{
                  container: 'max-sm:pb-20'
                }}>
                  <Identity className="px-4 pt-3 pb-2" hasCopyAddressOnClick>
                    <Avatar />
                    <Name />
                    <Address />
                    <EthBalance />
                  </Identity>
                  <WalletDropdownDisconnect />
                </WalletDropdown>
              </>
            ) : farcasterContext ? (
              <Button
                onClick={() => connectAsync({ connector: farcasterFrame() })}
                size="md"
                className="cursor-pointer ock-bg-primary active:bg-[var(--ock-bg-primary-active)] active:shadow-inner ock-border-radius ock-font-family font-semibold ock-text-inverse inline-flex items-center justify-center px-4 py-3 min-w-[153px]"
              >
                Connect Farcaster
              </Button>
            ) : (
              // if not connected, show our own connect button
              <Button
                onClick={() => setIsWalletModalOpen(!isWalletModalOpen)}
                size="md"
                className={`cursor-pointer ock-bg-primary active:bg-[var(--ock-bg-primary-active)] active:shadow-inner ock-border-radius ock-font-family font-semibold ock-text-inverse inline-flex items-center justify-center px-4 py-3 min-w-[153px]`}
              >
                Connect
              </Button>
            )}
          </Wallet>
        </div>
      </header>
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

      <div className="flex-1 flex flex-col overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500"
        >
          {messages.map((m, i) => {
            const isMe = m.senderInboxId === myInboxId;
            const time = m.sentAtNs
              ? new Date(Number(m.sentAtNs / BigInt(1e6))).toLocaleTimeString([], {
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
                className={`flex flex-wrap items-end w-fit max-w-[80%] p-1 break-words py-1 px-3 rounded-lg ${isMe
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
                ) : typeof m.content === "string" ? (
                  <div className="max-w-[100%] p-1 break-words">
                    {typeof m.content === "string" ? m.content : ""}
                  </div>
                ) : (
                  <div className="text-xs text-gray-400 italic pr-2">
                    Conversation started
                  </div>
                )}
                <span className="self-end ml-auto text-[10px] text-gray-300">
                  {time}
                </span>
              </div>
            );
          })}
        </div>

        <div className="border-t border-gray-700 px-1">
          <MessageInput onSend={(t) => handleSend(t)} />
        </div>
      </div>

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
      <WalletModal
        isOpen={isWalletModalOpen}
        onClose={() => {
          setIsWalletModalOpen(false);
        }}
      />
    </div>
  );
}
