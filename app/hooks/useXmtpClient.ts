// hooks/useXmtpClient.ts
"use client";

import { useState, useEffect } from "react";
import { Client } from "@xmtp/xmtp-js";
import { useWalletClient } from "wagmi";

// We cache the XMTP client so that once initialized it survives across renders.
let _cachedClient: Client | null = null;
let _clientPromise: Promise<Client> | null = null;

/** If XMTP’s IndexedDB identity is corrupt we clear it and reload the page */
async function clearXmtpStorage(): Promise<void> {
  try {
    const req = indexedDB.deleteDatabase("xmtp.org");
    req.onsuccess = () => {
      console.log("✅ XMTP identity storage cleared.");
      window.location.reload();
    };
    req.onerror = () => {
      console.warn("⚠️ Failed to clear XMTP identity storage.");
    };
    req.onblocked = () => {
      console.warn("⚠️ XMTP identity deletion blocked (still open elsewhere).");
    };
  } catch (err) {
    console.error("❌ Error clearing XMTP storage:", err);
  }
}

/**
 * React hook that returns an initialized XMTP client (or an error).
 * It uses wagmi’s Viem `walletClient` under the hood by adapting it to an
 * ethers-style "signer" object with getAddress() and signMessage().
 */
export function useXmtpClient() {
  const { data: walletClient } = useWalletClient();
  const [xmtpClient, setXmtpClient] = useState<Client | null>(_cachedClient);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!walletClient) return;

      // Already have a working XMTP client in cache?
      if (_cachedClient) {
        setXmtpClient(_cachedClient);
        return;
      }

      // Otherwise, if initialization is in flight, reuse that promise.
      if (!_clientPromise) {
        // Build an ethers-like signer wrapper around the Viem walletClient
        const signer = {
          getAddress: async () => {
            // Viem WalletClient.account.address is always defined here
            return walletClient.account.address;
          },
          signMessage: async (message: string | Uint8Array) => {
            // XMTP passes either a string or Uint8Array; convert to string
            const text =
              typeof message === "string"
                ? message
                : new TextDecoder().decode(message);
            // Viem's signMessage expects { message } (string or Uint8Array)
            return walletClient.signMessage({ message: text });
          },
        };

        _clientPromise = Client.create(signer, { env: "production" })
          .then((client) => {
            _cachedClient = client;
            return client;
          })
          .catch(async (err: any) => {
            const msg = (err?.message || "").toLowerCase();
            if (msg.includes("signature validation failed")) {
              console.warn("⚠️ Corrupt XMTP identity. Clearing...");
              await clearXmtpStorage();
            } else if (msg.includes("user rejected")) {
              throw new Error("You must sign a message to enable messaging.");
            } else {
              throw new Error("Failed to initialize XMTP.");
            }
            throw err;
          })
          .finally(() => {
            _clientPromise = null;
          });
      }

      try {
        const client = await _clientPromise;
        if (!cancelled) {
          setXmtpClient(client);
        }
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
