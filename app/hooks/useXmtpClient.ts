// hooks/useXmtpClient.ts
"use client";

import { useState, useEffect } from "react";
import { Client, type Signer, type Identifier } from "@xmtp/browser-sdk";
import {
  AttachmentCodec,
  RemoteAttachmentCodec,
} from "@xmtp/content-type-remote-attachment";
import { useWalletClient } from "wagmi";

// Key under which we store the encryption key in localStorage
const STORAGE_KEY = "xmtp-production";

// In-memory cache for XMTP client
let _cachedClient: Client | null = null;
let _clientPromise: Promise<Client> | null = null;

/** Encode a Uint8Array as Base64-safe string */
function encodeKey(key: Uint8Array): string {
  let str = "";
  for (let i = 0; i < key.length; i++) {
    str += String.fromCharCode(key[i]);
  }
  return btoa(str);
}

/** Decode a Base64 string back to Uint8Array */
function decodeKey(str: string): Uint8Array {
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Clear XMTP IndexedDB and localStorage, then reload */
async function clearXmtpStorage(): Promise<void> {
  try {
    const req = indexedDB.deleteDatabase("xmtp.org");
    req.onsuccess = () => {
      console.log("✅ XMTP identity storage cleared.");
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    };
    req.onerror = () => console.warn("⚠️ Failed to clear XMTP identity storage.");
    req.onblocked = () => console.warn("⚠️ XMTP identity deletion blocked.");
  } catch (err) {
    console.error("❌ Error clearing XMTP storage:", err);
  }
}

/** Convert hex string (0x...) to Uint8Array */
function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const len = clean.length / 2;
  const result = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return result;
}

/**
 * React hook: init XMTP client, caching encryption key to avoid repeat signatures.
 */
export function useXmtpClient() {
  const { data: walletClient } = useWalletClient();
  const [xmtpClient, setXmtpClient] = useState<Client | null>(_cachedClient);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!walletClient) return;
      if (_cachedClient) {
        setXmtpClient(_cachedClient);
        return;
      }

      if (!_clientPromise) {
        // Build a Signer for XMTP
        const signer: Signer = {
          type: "EOA",
          getIdentifier: async (): Promise<Identifier> => ({
            identifier: walletClient.account.address,
            identifierKind: "Ethereum",
          }),
          signMessage: async (message: string): Promise<Uint8Array> => {
            const signatureHex = await walletClient.signMessage({ message });
            return hexToBytes(signatureHex);
          },
        };

        _clientPromise = (async () => {
          // Load or generate encryption key
          const saved = localStorage.getItem(STORAGE_KEY);
          const dbKey = saved
            ? decodeKey(saved)
            : window.crypto.getRandomValues(new Uint8Array(32));

          // Create the client; only signs if identity not registered or key mismatch
          const client = await Client.create(signer, {
            env: "production",
            dbEncryptionKey: dbKey,
            codecs: [new AttachmentCodec(), new RemoteAttachmentCodec()],
          });

          // Store key after first init
          if (!saved) {
            localStorage.setItem(STORAGE_KEY, encodeKey(dbKey));
          }

          _cachedClient = client;
          return client;
        })()
          .catch(async (err: any) => {
            const msg = (err?.message || "").toLowerCase();
            if (msg.includes("signature validation failed")) {
              console.warn("⚠️ Corrupt XMTP identity. Clearing...");
              await clearXmtpStorage();
            }
            throw err;
          })
          .finally(() => {
            _clientPromise = null;
          });
      }

      try {
        const client = await _clientPromise!;
        if (!cancelled) setXmtpClient(client);
      } catch (err: any) {
        console.error("XMTP init error:", err);
        if (!cancelled) setError(err.message || "XMTP initialization failed");
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [walletClient]);

  return { xmtpClient, error };
}
