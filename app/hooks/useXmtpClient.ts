// hooks/useXmtpClient.ts
"use client";

import { useState, useEffect } from "react";
import { Client as JsClient } from "@xmtp/xmtp-js";
import {
  Client as BrowserClient,
  type Signer,
  type Identifier,
} from "@xmtp/browser-sdk";
import {
  AttachmentCodec,
  RemoteAttachmentCodec,
} from "@xmtp/content-type-remote-attachment";
import { useWalletClient } from "wagmi";
import { hexToBytes } from "viem/utils";

// Key under which we store the encryption key
const STORAGE_KEY = "xmtp-db-key";

let _cachedClient: JsClient | null = null;
let _clientPromise: Promise<JsClient> | null = null;

function encodeKey(key: Uint8Array): string {
  let str = "";
  for (let i = 0; i < key.length; i++) str += String.fromCharCode(key[i]);
  return btoa(str);
}

function decodeKey(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function clearXmtpStorage(): Promise<void> {
  const req = indexedDB.deleteDatabase("xmtp.org");
  req.onsuccess = () => {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  };
  req.onerror = () => console.warn("⚠️ Failed clearing XMTP storage");
}

export function useXmtpClient() {
  const { data: walletClient } = useWalletClient();
  const [xmtpClient, setXmtpClient] = useState<JsClient | null>(_cachedClient);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletClient) return;
    let cancelled = false;

    async function init() {
      if (_cachedClient) {
        setXmtpClient(_cachedClient);
        return;
      }

      if (!_clientPromise) {
        const signer: Signer = {
          type: "EOA",
          getIdentifier: async (): Promise<Identifier> => ({
            identifier: walletClient?.account?.address != undefined ? walletClient?.account?.address : "",
            identifierKind: "Ethereum",
          }),
          signMessage: async (message: string): Promise<Uint8Array> => {
            const sigHex = await walletClient?.signMessage({ message });
            return hexToBytes(sigHex != undefined ? sigHex : "0x");
          },
        };

        _clientPromise = (async () => {
          // load or generate key
          const saved = localStorage.getItem(STORAGE_KEY);
          const dbKey = saved
            ? decodeKey(saved)
            : window.crypto.getRandomValues(new Uint8Array(32));

          const browserClient = await BrowserClient.create(signer, {
            env: "production",
            dbEncryptionKey: dbKey,
            codecs: [new AttachmentCodec(), new RemoteAttachmentCodec()],
          });

          if (!saved) localStorage.setItem(STORAGE_KEY, encodeKey(dbKey));

          // cast to JsClient for compatibility
          _cachedClient = browserClient as unknown as JsClient;
          return _cachedClient;
        })().catch(async (err: any) => {
          if (err.message?.toLowerCase().includes('signature validation failed')) {
            await clearXmtpStorage();
          }
          throw err;
        }).finally(() => {
          _clientPromise = null;
        });
      }

      try {
        const client = await _clientPromise;
        if (!cancelled) setXmtpClient(client);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'XMTP init failed');
      }
    }

    init();
    return () => { cancelled = true; };
  }, [walletClient]);

  return { xmtpClient, error };
}