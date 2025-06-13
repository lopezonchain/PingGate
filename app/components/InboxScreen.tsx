// src/components/InboxScreen.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Client,
  Conversation,
  AsyncStream,
  ConsentState,
  type DecodedMessage,
  IdentifierKind,
  SortDirection,
  Dm,
  SafeInboxState,
} from "@xmtp/browser-sdk";
import { useWalletClient } from "wagmi";
import {
  FiCopy,
  FiFile,
  FiHelpCircle,
  FiMenu,
  FiMessageCircle,
  FiPlus,
  FiSend,
  FiShare2,
} from "react-icons/fi";
import { motion } from "framer-motion";
import { useXmtpClient } from "../hooks/useXmtpClient";
import { resolveNameLabel } from "../services/resolveNameLabel";
import {
  getPurchasesBy as fetchPurchasedServiceIds,
  getSalesBy as fetchSalesRecords,
  getServicesBy as fetchServiceIdsBySeller,
  getService as fetchServiceDetails,
  resolveRecipient,
} from "../services/contractService";
import { WarpcastService, Web3BioProfile } from "../services/warpcastService";
import { useRouter } from "next/navigation";
import MessageInput, { XMTPAttachment } from "./MessageInput";
import { useMiniKit } from "@coinbase/onchainkit/minikit";
import { ContentTypeAttachment } from "@xmtp/content-type-remote-attachment";
import { formatEther } from "ethers";
import FaqList from "./FAQList";
import BottomMenu from "./BottomMenu";
import { WarpView } from "../page-client";
import toast from "react-hot-toast";

interface InboxScreenProps {
  onAction: (view: WarpView) => void;
}

interface ExtendedConversation extends Conversation {
  updatedAt?: Date;
  hasUnread?: boolean;
  peerInboxId?: string;       // El inbox ID del peer (string)
  peerWalletAddress?: string; // La(s) dirección(es) ETH asociada(s), selec. la principal
  peerKey: string;
}

type Tab = "sales" | "purchases" | "all";

function abbreviateAddress(addr: string) {
  const isEthAddress = /^0x[a-fA-F0-9]{40}$/.test(addr);
  if (!isEthAddress) return addr;
  return addr.slice(0, 7) + "…" + addr.slice(-5);
}

export default function InboxScreen({ onAction }: InboxScreenProps) {
  const router = useRouter();
  const { context } = useMiniKit();
  const { data: walletClient } = useWalletClient();
  const { xmtpClient, error: xmtpError } = useXmtpClient();
  const myAddr = walletClient?.account.address || "";

  // Instanciar WarpcastService
  const warpcast = useMemo(() => new WarpcastService(), []);

  // Resolver mi propio nombre (Farcaster → ENS → fallback)
  const [myName, setMyName] = useState<string>("");
  useEffect(() => {
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
  }, [myAddr, warpcast]);

  // Estados principales
  const [conversations, setConversations] = useState<ExtendedConversation[]>([]);
  const [purchasedPeers, setPurchasedPeers] = useState<Set<string>>(new Set());
  const [soldPeers, setSoldPeers] = useState<Set<string>>(new Set());
  const [spentByPeer, setSpentByPeer] = useState<Record<string, bigint>>({});
  const [earnedFromPeer, setEarnedFromPeer] = useState<Record<string, bigint>>({});
  const [gatedPeers, setGatedPeers] = useState<Set<string>>(new Set());
  const [loadingList, setLoadingList] = useState(true);

  const [profilesMap, setProfilesMap] = useState<
    Record<string, Web3BioProfile | { displayName: string; avatar: string | null }>
  >({});
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

  const [showGatedModal, setShowGatedModal] = useState(false)
  const [modalPeer, setModalPeer] = useState<string>("")

  const [showCastModal, setShowCastModal] = useState(false)
  const [castPeer, setCastPeer] = useState<string>("")
  const [castHandle, setCastHandle] = useState<string>("")

  const [showShareOptions, setShowShareOptions] = useState(false);
  const conversationUrl = `https://farcaster.xyz/miniapps/EeMMAjeUSYta/pinggate/conversation/${myAddr}`;
  const conversationWebUrl = `https://pinggate.lopezonchain.xyz/conversation/${myAddr}`;

  // Obtener mi inboxId para saber mis mensajes no leídos
  const [myInboxId, setMyInboxId] = useState<string>("");
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

  // Convierte un XMTPAttachment en URL
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

  const loadConversations = async () => {
    if (!xmtpClient) return;
    setLoadingList(true);

    // 1) sincroniza la lista de conversaciones (metadatos)
    await xmtpClient.conversations.syncAll([ConsentState.Allowed]);
    const list = await xmtpClient.conversations.list();

    // 2) procesa en paralelo cada conversación
    const enriched = await Promise.all(
      list.map(async (conv) => {
        if (!(conv.id && typeof conv.id === "string")) return null;

        // — peerInboxId
        let peerInbox: string | undefined;
        if (conv instanceof Dm) {
          try {
            peerInbox = await conv.peerInboxId();
          } catch {
            /* swallow */
          }
        }

        // — peerWalletAddress
        let peerWallet: string | undefined;
        if (peerInbox) {
          try {
            const [state] = await xmtpClient.preferences.inboxStateFromInboxIds(
              [peerInbox],
              true
            );
            const ethId = state?.accountIdentifiers?.find(
              (i) => i.identifierKind === "Ethereum"
            );
            peerWallet = ethId?.identifier.toLowerCase();
          } catch {
            /* swallow */
          }
        }

        // — trata de leer el último mensaje real sin sync
        let lastMsg: DecodedMessage | undefined;
        try {
          const raws = await conv.messages({
            limit: BigInt(1),
            direction: SortDirection.Descending,
          });
          lastMsg = raws.find(
            (m) =>
              typeof m.content === "string" ||
              ((m.content as any).data !== undefined)
          );
        } catch {
          /* swallow */
        }

        // — si no hay ninguno, entonces sí sincroniza esta conversación
        if (!lastMsg) {
          try {
            await conv.sync();
            const raws2 = await conv.messages({
              limit: BigInt(1),
              direction: SortDirection.Descending,
            });
            lastMsg = raws2.find(
              (m) =>
                typeof m.content === "string" ||
                ((m.content as any).data !== undefined)
            );
          } catch {
            /* swallow */
          }
        }

        // — extrae fecha y unread
        let updatedAt: Date | undefined;
        let hasUnread = false;
        if (lastMsg) {
          updatedAt = new Date(Number(lastMsg.sentAtNs! / BigInt(1e6)));
          hasUnread = lastMsg.senderInboxId !== myInboxId;
        }

        const ext = conv as unknown as ExtendedConversation;
        ext.peerInboxId = peerInbox;
        ext.peerWalletAddress = peerWallet;
        ext.updatedAt = updatedAt;
        ext.hasUnread = hasUnread;
        ext.peerKey = peerWallet || peerInbox!;

        return ext;
      })
    );

    // 3) filtra nulos y ordena
    const finalList = enriched
      .filter((c): c is ExtendedConversation => c !== null)
      .sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));

    setConversations(finalList);
    setLoadingList(false);
  };

  useEffect(() => {
    if (!xmtpClient || !myInboxId) return
    let active = true
    loadConversations().catch(console.error)
    return () => { active = false }
  }, [xmtpClient, myInboxId])

  // Stream de nuevas conversaciones (DMs) para agregarlas al estado al vuelo
  useEffect(() => {
    if (!xmtpClient) return;
    let active = true;

    (async () => {
      const streamDms = await xmtpClient.conversations.streamDms();
      for await (const newConv of streamDms as AsyncStream<Dm>) {
        if (!active || !newConv) break;

        // Construir el stub
        let peerInbox: string | undefined;
        let peerWallet: string | undefined
        if (peerInbox) {
          // Llamada sin optional chaining
          const states: SafeInboxState[] = await xmtpClient.preferences.inboxStateFromInboxIds(
            [peerInbox],
            true
          )
          // Comprueba que vino algo
          if (states.length > 0) {
            const state = states[0]
            // Anota el tipo de 'i' para que TS sepa qué lleva dentro
            const ethId = state.accountIdentifiers?.find(
              (i: { identifierKind: IdentifierKind; identifier: string }) =>
                i.identifierKind == "Ethereum"
            )
            peerWallet = ethId?.identifier.toLowerCase()
          }
        }

        const metas = await newConv.messages({
          limit: BigInt(1),
          direction: SortDirection.Descending,
        });
        const lastMsg = metas[0];
        const updatedAt = lastMsg
          ? new Date(Number(lastMsg.sentAtNs / BigInt(1e6)))
          : new Date();
        const hasUnread = lastMsg ? lastMsg.senderInboxId !== myInboxId : true;

        const ext = newConv as unknown as ExtendedConversation;
        ext.peerInboxId = peerInbox;
        ext.peerWalletAddress = peerWallet;
        ext.updatedAt = updatedAt;
        ext.hasUnread = hasUnread;

        // Añadir a la lista
        setConversations(prev => {
          if (prev.find(c => c.id === ext.id)) return prev;
          const next = [ext, ...prev];
          next.sort((a, b) => (b.updatedAt!.getTime() - a.updatedAt!.getTime()));
          return next;
        });

        // Refetch inmediato para pillar el content YA indexado
        try {
          await xmtpClient.conversations.syncAll();
          const rawList = await xmtpClient.conversations.list();
          const enriched: ExtendedConversation[] = [];
          for (const conv of rawList) {
            const [msg] = await conv.messages({ limit: BigInt(1), direction: SortDirection.Descending });
            const date = msg
              ? new Date(Number(msg.sentAtNs / BigInt(1e6)))
              : new Date();
            const unread = msg ? msg.senderInboxId !== myInboxId : false;
            const ec = conv as unknown as ExtendedConversation;
            ec.updatedAt = date;
            ec.hasUnread = unread;
            try {
              if (conv instanceof Dm) {
                ec.peerInboxId = await conv.peerInboxId();
              }
            } catch { }
            enriched.push(ec);
          }
          enriched.sort((a, b) => (b.updatedAt!.getTime() - a.updatedAt!.getTime()));
          if (active) setConversations(enriched);
        } catch {
          /* ignora errores de refetch */
        }
      }
    })().catch(console.error);

    return () => { active = false; };
  }, [xmtpClient, myInboxId]);


  // Obtener compras y ventas: ahora “peerWalletAddress” en lugar de inbox ID
  useEffect(() => {
    if (!walletClient) return;
    let active = true;

    (async () => {
      // Purchases → Experts 
      const spentMap: Record<string, bigint> = {};
      const buyerIds = await fetchPurchasedServiceIds(walletClient.account.address);
      for (const id of buyerIds) {
        const svc = await fetchServiceDetails(id);
        const seller = svc.seller.toLowerCase();
        const price = BigInt(svc.price);
        spentMap[seller] = (spentMap[seller] || BigInt(0)) + price;
      }
      if (active) {
        setSpentByPeer(spentMap);
        setPurchasedPeers(new Set(Object.keys(spentMap)));
      }

      // Sales → Clients
      const earnedMap: Record<string, bigint> = {};
      const sales = await fetchSalesRecords(walletClient.account.address);
      for (const sale of sales) {
        const buyer = sale.buyer.toLowerCase();
        const svc = await fetchServiceDetails(sale.serviceId);
        const price: bigint = BigInt(svc.price);
        earnedMap[buyer] = (earnedMap[buyer] || BigInt(0)) + price;
      }
      if (active) {
        setEarnedFromPeer(earnedMap);
        setSoldPeers(new Set(Object.keys(earnedMap)));
      }
    })().catch(console.error);

    return () => {
      active = false;
    };
  }, [walletClient]);

  // Cargar perfiles Farcaster + ENS, esta vez con “peerWalletAddress”
  useEffect(() => {
    if (conversations.length === 0) return;
    let active = true;

    // Solo nos quedamos con los “peerWalletAddress” que existan y no sean undefined
    const peers = Array.from(
      new Set(
        conversations
          .map((c) => c.peerWalletAddress)
          .filter((addr): addr is string => typeof addr === "string")
      )
    );
    const ids = peers.map((addr) => `farcaster,${addr}`);

    (async () => {
      const newProfiles: Record<
        string,
        Web3BioProfile | { displayName: string; avatar: string | null }
      > = {};

      // Intentamos Farcaster
      try {
        const bioProfiles = await warpcast.getWeb3BioProfiles(ids);
        const aliasMap: Record<string, Web3BioProfile> = {};
        bioProfiles.forEach((p) =>
          p.aliases?.forEach((alias) => {
            const [, id] = alias.split(",");
            aliasMap[id.toLowerCase()] = p;
          })
        );
        peers.forEach((addr) => {
          if (aliasMap[addr]) {
            newProfiles[addr] = aliasMap[addr];
          }
        });
      } catch {
        // Ignorar errores
      }

      // ENS / fallback
      await Promise.all(
        peers.map(async (addr) => {
          if (newProfiles[addr]) return;
          try {
            const ens = await resolveNameLabel(addr);
            newProfiles[addr] = {
              displayName: ens || abbreviateAddress(addr),
              avatar: null,
            };
          } catch {
            newProfiles[addr] = {
              displayName: abbreviateAddress(addr),
              avatar: null,
            };
          }
        })
      );

      if (active) {
        setProfilesMap(newProfiles);
      }
    })().catch(console.error);

    return () => {
      active = false;
    };
  }, [conversations, warpcast]);

  // Determinar gatedChats basado en “peerWalletAddress”
  useEffect(() => {
    if (!walletClient || conversations.length === 0) return;
    let active = true;

    const peers = Array.from(
      new Set(
        conversations
          .map((c) => c.peerWalletAddress)
          .filter((addr): addr is string => typeof addr === "string")
      )
    );

    (async () => {
      const gp = new Set<string>();
      for (const peer of peers) {
        try {
          const ids = await fetchServiceIdsBySeller(peer as `0x${string}`);
          for (const sid of ids) {
            const svc = await fetchServiceDetails(sid);
            if (svc.active) {
              gp.add(peer);
              break;
            }
          }
        } catch {
          // Ignorar
        }
      }
      if (active) {
        setGatedPeers(gp);
      }
    })().catch(console.error);

    return () => {
      active = false;
    };
  }, [conversations, walletClient]);

  // Stream global de mensajes (solo actualiza updatedAt / hasUnread para conversaciones ya cargadas)
  useEffect(() => {
    if (!xmtpClient) return;
    let active = true;

    (async () => {
      const streamAll = await xmtpClient.conversations.streamAllMessages();
      for await (const msg of streamAll as AsyncStream<DecodedMessage>) {
        if (!active) break;

        setConversations((prevConvs) => {
          // Buscamos la conversación a la que llegó el mensaje
          const idx = prevConvs.findIndex((c) => c.id === msg?.conversationId);
          if (idx < 0) return prevConvs;

          // Calculamos si el mensaje vino de mí o del otro, y la fecha en ms
          const isMe = msg?.senderInboxId === myInboxId;
          const sentAtMs =
            msg?.sentAtNs !== undefined
              ? Number(msg.sentAtNs / BigInt(1e6))
              : Date.now();

          // Creamos un nuevo array clonando la lista anterior
          const newConvs = [...prevConvs];

          // En la misma instancia (ExtendedConversation) actualizamos los campos
          const target = newConvs[idx];
          target.updatedAt = new Date(sentAtMs);
          target.hasUnread = !isMe;

          // Ordenamos por updatedAt descendente
          newConvs.sort((a, b) => (b.updatedAt?.getTime() || 0) - (a.updatedAt?.getTime() || 0));

          return newConvs;
        });
      }
    })().catch(console.error);

    return () => {
      active = false;
    };
  }, [xmtpClient, myInboxId]);


  // Cargar mensajes de la conversación “expanded” (igual que antes, usando peerInboxId para crear el DM)
  useEffect(() => {
    if (!xmtpClient || !expanded) return;
    let active = true;

    (async () => {
      // Instancia previa
      const convo = await xmtpClient.conversations.getConversationById(expanded);
      // Sincronizas con la red los mensajes históricos
      await convo?.sync();
      // Lees los últimos 5 mensajes
      const initial = await convo?.messages({
        limit: BigInt(5),
        direction: SortDirection.Descending,
      });
      if (!active) return;

      setMessages((prev) => ({
        ...prev,
        [expanded]: initial !== undefined ? initial.slice().reverse() : [],
      }));

      // Stream para nuevos mensajes
      const streamSingle = await convo?.stream();
      for await (const msg of streamSingle as AsyncStream<DecodedMessage>) {
        if (!active) break;
        setMessages((prev) => ({
          ...prev,
          [expanded]: ([...(prev[expanded] || []), msg] as DecodedMessage[]),
        }));
      }
    })().catch(console.error);

    return () => {
      active = false;
    };
  }, [xmtpClient, expanded]);


  // 📤 Envío de mensaje + notificación (ya estabas usando la dirección ETH en “peer”)
  const handleSend = async (
    peer: string,
    text: string | XMTPAttachment
  ) => {
    if (!xmtpClient || !text) return;
    const peerIdentifier = {
      identifier: peer,
      identifierKind: "Ethereum" as IdentifierKind,
    };
    const convo = await xmtpClient.conversations.newDmWithIdentifier(peerIdentifier);

    // Primero enviamos el texto/attachment por XMTP
    if (typeof text === "string") {
      await convo.send(text);
    } else {
      await convo.send(text, ContentTypeAttachment);
    }

    // Luego obtenemos el fid (si existe) para la notificación
    const profile = profilesMap[peer] as Web3BioProfile | null;
    let fid = 0;
    if (profile?.social?.uid) {
      fid = profile.social.uid;
    } else {
      try {
        fid = await warpcast.getFidByName(peer);
      } catch {
        //ignore
      }
    }

    if (fid !== 0) {
      const title = `New ping from ${myName}`;
      const bodyText = typeof text === "string" ? text : (text as XMTPAttachment).filename;

      // Intenta notificar; capturamos cualquier error (404, red, etc.)
      try {
        const res = await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fid,
            notification: { title, body: bodyText },
            targetUrl: `https://farcaster.xyz/miniapps/EeMMAjeUSYta/pinggate/conversation/${myAddr}`,
          }),
        });
        if (!res.ok) {
          console.error(`Notify failed: ${res.status} ${res.statusText}`);
        }
      } catch (e) {
        console.error("Notify error:", e);
      }
    }

  };

  // ✉️ Nuevo hilo (“composer”)
  const handleCreate = async () => {
    setSending(true)
    setErr(null)
    let addr = ""

    try {
      if (!xmtpClient) throw new Error("XMTP not ready")
      if (!to || !body) throw new Error("Fill all fields")

      // 1) resuelvo la dirección
      addr = await resolveRecipient(to)

      // 2) compruebo gated chat como antes...
      const serviceIds = await fetchServiceIdsBySeller(addr as `0x${string}`)
      let hasActive = false
      for (const id of serviceIds) {
        const svc = await fetchServiceDetails(id)
        if (svc.active) { hasActive = true; break }
      }
       console.log("HEY");
      console.log(addr);
      console.log(purchasedPeers);
      console.log(soldPeers);
      if (hasActive && !purchasedPeers.has(addr.toLowerCase()) && !soldPeers.has(addr.toLowerCase())) {
        setModalPeer(addr)
        setShowGatedModal(true)
        return
      }

      // 3) intento enviar por XMTP
      const peerIdentifier = {
        identifier: addr,
        identifierKind: "Ethereum" as IdentifierKind,
      }
      const convo = await xmtpClient.conversations.newDmWithIdentifier(peerIdentifier);
      if (typeof body === "string") {
        await convo.send(body);
      } else {
        await convo.send(body, ContentTypeAttachment);
      }

      // 4) refresco y cierro composer
      await loadConversations();
      setShowComposer(false);
      setTo("");
      setBody("");

      // 5) notificación Warpcast (igual que antes)
      const profile = profilesMap[addr] as Web3BioProfile | null;
      let fid = 0;
      if (profile?.social?.uid) {
        fid = profile.social.uid;
      } else {
        try {
          fid = await warpcast.getFidByName(addr);
        } catch {
          // leave fid = 0
        }
      }
      if (fid !== 0) {
        const title = `New ping from ${myName}`;
        const bodyText = typeof body === "string" ? body : (body as XMTPAttachment).filename;
        try {
          const res = await fetch("/api/notify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fid,
              notification: { title, body: bodyText },
              targetUrl: `https://pinggate.lopezonchain.xyz/conversation/${myAddr}`,
            }),
          })
          if (!res.ok) console.error(`Notify failed: ${res.status}`);
        } catch { /* ignore */ }
      }

    } catch (e: any) {
      // —— NUEVO: lookup Farcaster on-demand si no hay inbox
      if (e.message.includes("not found")) {
        let displayName: string | undefined;
        try {
          const [bio] = await warpcast.getWeb3BioProfiles([`farcaster,${addr}`]);
          displayName = bio?.identity;
        } catch { /* ignore */ }

        if (displayName) {
          setCastPeer(myAddr);
          setCastHandle(displayName);
          setShowCastModal(true);
          return
        }
      }
      // cualquier otro error:
      setErr(e.message);
    } finally {
      setSending(false);
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(conversationUrl);
      toast.success("Link copied to clipboard");
    } catch (err) {
      console.error("Copy failed", err);
      toast.error("Failed to copy link");
    }
    setShowShareOptions(false);
  };

  const handleCopyWeb = async () => {
    try {
      await navigator.clipboard.writeText(conversationWebUrl);
      toast.success("Link copied to clipboard");
    } catch (err) {
      console.error("Copy failed", err);
      toast.error("Failed to copy link");
    }
    setShowShareOptions(false);
  };


  const handleCast = () => {
    const text = `Chat with me... or better said: PING ME!!\nYou also can monetize your inbox or find experts, built by @lopezonchain.eth 💬🛠️\n\n${conversationUrl}`;
    const shareUrl = `https://farcaster.xyz/~/compose?text=${encodeURIComponent(text)}`;
    window.open(shareUrl, "_blank");
    setShowShareOptions(false);
  };

  // — Filtrar conversaciones según pestaña (“sales”/“purchases”/“all”), pero ahora usando peerWalletAddress
  const filtered = conversations.filter((c) => {
    const key = c.peerKey;
    if (!key) return false;

    if (tab === "sales") return soldPeers.has(key);
    if (tab === "purchases") return purchasedPeers.has(key);
    return true; // “all” muestra todo, incluso sin wallet
  });

  if (loadingList) {
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
              The chat protocol requires a
              signature the first time you join it so you can have your inbox,
              but don&apos;t worry, this is completely free!
              <br />
              <br />
              An additional signature could be needed when you access back to
              your inbox from a new device, or after memory cleans.
              <a
                className="block p-3 mt-3 bg-[#0F0D14]"
                href="https://docs.xmtp.org/intro/intro"
                target="_blank"
                rel="noreferrer"
              >
                More info (What is XMTP? Official docs)
              </a>
            </p>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 h-[99%] bg-[#0f0d14] text-white">
      <div className="flex-1 flex flex-col min-h-0 bg-[#0f0d14] text-white pb-14">
        <div className="flex justify-center items center">
          <div className="relative mr-2 flex items-start justify-center">
            <button
              onClick={() => setShowShareOptions((prev) => !prev)}
              className="flex items-center space-x-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg"
            >
              <FiShare2 />
              <span>Share</span>
            </button>

            {showShareOptions && (
              <div className="absolute top-[40px] left-[40px] mt-2 bg-[#1a1725] border border-gray-700 rounded-lg shadow-lg w-52 z-[150]">
                <button
                  onClick={handleCast}
                  className="w-full flex items-center px-4 py-2 text-sm hover:bg-[#2a2438] text-white"
                >
                  <FiSend className="mr-2" />
                  Cast my conversation
                </button>
                <button
                  onClick={handleCopy}
                  className="w-full flex items-center px-4 py-2 text-sm hover:bg-[#2a2438] text-white"
                >
                  <FiCopy className="mr-2" />
                  Copy My conversation link (Miniapp)
                </button>
                <button
                  onClick={handleCopyWeb}
                  className="w-full flex items-center px-4 py-2 text-sm hover:bg-[#2a2438] text-white"
                >
                  <FiCopy className="mr-2" />
                  Copy My conversation link (Web)
                </button>
              </div>
            )}
          </div>
          <div className="flex justify-center items-center mb-2 divide-x divide-purple-600">
            {(["all", "purchases", "sales"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`
              px-6 py-3
              first:rounded-l-lg last:rounded-r-lg
              ${tab === t
                    ? "bg-purple-600 text-white"
                    : "bg-[#1a1725] text-gray-400 hover:bg-[#231c32]"
                  }
            `}
              >
                {t === "sales" ? "Clients" : t === "purchases" ? "Experts" : "All"}
              </button>
            ))}
          </div>
        </div>
        {xmtpError && <p className="text-red-500 text-center mb-2">{xmtpError}</p>}

        <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-thin scrollbar-track-[#1a1725] scrollbar-thumb-purple-600 hover:scrollbar-thumb-purple-500 pb-6">
          {filtered.length === 0 && tab === "all" ? (
            <div className="flex flex-col items-center justify-center text-center mt-8 space-y-6 px-4">
              <div className="text-gray-400 text-lg font-semibold">
                You don’t have any conversations on this device yet.
              </div>

              <button
                onClick={() => setShowComposer(true)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg text-lg font-medium"
              >
                Create Ping
              </button>

              <div className="w-full max-w-2xl mt-6">
                <FaqList />
              </div>
            </div>
          ) : filtered.length === 0 && tab !== "all" ? (
            <div className="flex flex-col items-center justify-center text-center mt-8 px-4">
              {tab === "sales" && (
                <p className="text-gray-400">You still don&apos;t have clients! Create your first service in &quot;My services&quot; (in the bottom menu) and start monetizing your Inbox!</p>
              )}
              {tab === "purchases" && (
                <p className="text-gray-400">No experts contacted yet, you can find some in &quot;Explore&quot; (in the bottom menu)</p>
              )}
            </div>
          ) : (
            filtered.map((conv, idx) => {
              const peerRaw = conv.peerWalletAddress ?? conv.peerInboxId;
              if (!peerRaw) {
                console.warn(`Conversation ${conv.id} with no peer`);
                return null;
              }
              const peer = peerRaw.toLowerCase();
              const profile = profilesMap[peer];
              const label = profile
                ? abbreviateAddress((profile as any).displayName)
                : abbreviateAddress(peer);
              const avatarUrl = (profile as any)?.avatar || null;
              const isOpen = expanded === conv.id;
              const isGated = gatedPeers.has(peer) && !purchasedPeers.has(peer);

              return (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-[#1a1725] rounded-xl overflow-hidden"
                >
                  <div
                    className="p-4 hover:bg-[#231c32] cursor-pointer"
                    onClick={() => {
                      if (isGated) return;
                      setExpanded(isOpen ? null : conv.id)
                    }}
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
                    <div className="flex justify-between items-center mb-2">
                      <p className="text-xs text-gray-400">
                        {conv.updatedAt?.toLocaleString() || "No messages"}
                      </p>
                      <FiMessageCircle className="text-lg text-gray-300" />
                    </div>

                    {isGated && (
                      <div className="mb-2 flex items-center space-x-2">
                        <span className="text-xs text-yellow-400">
                          Expert (Gated Chat)
                        </span>
                        <button
                          onClick={() => router.push(`/user/${peer}`)}
                          className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded"
                        >
                          View Services
                        </button>
                      </div>
                    )}

                    <div className="flex items-center space-x-2">
                      {conv.hasUnread && <span className="text-yellow-400">📩</span>}
                      {purchasedPeers.has(peer) && (
                        <span className="px-2 py-0.5 bg-blue-600 text-xs rounded-full">
                          Expert • {formatEther(spentByPeer[peer] || BigInt(0))} ETH
                        </span>
                      )}
                      {soldPeers.has(peer) && (
                        <span className="px-2 py-0.5 bg-green-600 text-xs rounded-full">
                          Client • {formatEther(earnedFromPeer[peer] || BigInt(0))} ETH
                        </span>
                      )}
                    </div>
                  </div>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-2 max-h-[50%] overflow-y-auto">
                      <div
                        onClick={() => router.push(`/conversation/${peer}`)}
                        className="cursor-pointer text-md p-2 rounded-lg bg-[#2a2438] border border-purple-600 hover:bg-[#3a3345] flex justify-center"
                      >
                        Open FULL conversation
                      </div>

                      {(messages[conv.id] || []).slice(-5).map((m, i) => {
                        const content = m.content;
                        const isString = typeof content === "string";
                        const isAttachment =
                          !isString && (content as any).data !== undefined;

                        return (
                          <div
                            key={i}
                            className={`flex flex-wrap items-end w-fit max-w-[80%] p-1 break-words py-1 px-3 rounded-lg ${m.senderInboxId === myInboxId
                              ? "bg-purple-600 ml-auto"
                              : "bg-[#2a2438]"
                              }`}
                          >
                            {isAttachment ? (
                              <div
                                className="flex items-center space-x-2 cursor-pointer"
                                onClick={() =>
                                  handleAttachmentClick(content as XMTPAttachment)
                                }
                              >
                                {(content as XMTPAttachment).mimeType.startsWith(
                                  "image/"
                                ) ? (
                                  <img
                                    src={attachmentToUrl(content as XMTPAttachment)}
                                    alt={(content as XMTPAttachment).filename}
                                    className="max-h-40 object-contain rounded"
                                  />
                                ) : (
                                  <>
                                    <FiFile className="w-6 h-6 text-gray-300" />
                                    <span className="truncate text-sm">
                                      {(content as XMTPAttachment).filename}
                                    </span>
                                  </>
                                )}
                              </div>
                            ) : isString ? (
                              <div className="max-w-[100%] p-1 break-words">
                                {content}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400 italic pr-2">
                                Conversation started
                              </div>
                            )}

                            <span className="self-end ml-auto text-[10px] text-gray-300 text-right">
                              {m.sentAtNs
                                ? new Date(
                                  Number(m.sentAtNs / BigInt(1e6))
                                ).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                                : ""}
                            </span>
                          </div>
                        );
                      })}

                      <MessageInput onSend={(t) => handleSend(peer, t)} />
                    </div>
                  )}
                </motion.div>
              );
            })
          )}
        </div>


        <button
          onClick={() => setShowComposer(true)}
          className="fixed bottom-14 right-[10%] z-25 bg-purple-600 hover:bg-purple-700 text-white text-3xl w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
          aria-label="New Conversation"
        >
          <FiPlus />
        </button>

        {showCastModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
            <div className="bg-[#1a1725] text-white p-6 rounded-lg max-w-sm w-full mx-4">
              <h2 className="text-xl font-semibold">Post on Farcaster</h2>
              <p className="mt-2">
                This user doesn&apos;t have an inbox yet, but found this related Farcaster account!.<br />
                Would you like to send an invite to <strong>@{castHandle}</strong>?
              </p>
              <div className="mt-4 flex flex-col space-y-2">
                <a
                  href={
                    `https://farcaster.xyz/~/compose?text=` +
                    encodeURIComponent(
                      `Hello @${castHandle}! 👋\n\nDo you want to chat??\nPING ME on PingGate when you have any time!! \n\nA chat, but also a marketplace 👀\nCreated by @lopezonchain.eth \n\nhttps://farcaster.xyz/miniapps/EeMMAjeUSYta/pinggate/conversation/${castPeer}`
                    )
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white text-center"
                >
                  Post Cast to @{castHandle}
                </a>
                <button
                  onClick={() => setShowCastModal(false)}
                  className="px-4 py-2 text-gray-400 hover:underline"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showGatedModal && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50">
            <div className="bg-[#1a1725] text-white p-6 rounded-lg max-w-sm w-full mx-4">
              <h2 className="text-xl font-semibold">Gated Chat</h2>
              <p className="mt-2">
                This user has a private chat. To continue, please purchase their service first.
              </p>
              <div className="mt-4 flex flex-col space-y-2">
                <button
                  onClick={() => router.push(`/user/${modalPeer}`)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-white"
                >
                  View this user’s services
                </button>
                <button
                  onClick={() => setShowGatedModal(false)}
                  className="px-4 py-2 text-gray-400 hover:underline"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showComposer && (
          <div className="fixed inset-0 bg-black bg-opacity-70 z-40 flex items-center justify-center">
            <div className="bg-[#1a1725] p-6 rounded-xl w-full max-w-md space-y-4">
              <h3 className="text-lg font-bold text-white">New Ping / Chat</h3>
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
      </div>
      <div>
        <BottomMenu onAction={onAction} />
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
    </div>
  );
}
