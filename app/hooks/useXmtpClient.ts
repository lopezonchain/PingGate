// hooks/useXmtpClient.ts
import { useState, useEffect } from "react";
import { Client } from "@xmtp/xmtp-js";
import { useWalletClient } from "wagmi";

let cachedClient: Client | null = null;
let clientPromise: Promise<Client> | null = null;

async function clearXmtpStorage(): Promise<void> {
  try {
    const request = indexedDB.deleteDatabase("xmtp.org");
    request.onsuccess = () => {
      console.log("✅ XMTP identity storage cleared.");
      window.location.reload();
    };
    request.onerror = () => {
      console.warn("⚠️ Failed to clear XMTP identity storage.");
    };
    request.onblocked = () => {
      console.warn("⚠️ XMTP identity deletion blocked (still open elsewhere).");
    };
  } catch (e) {
    console.error("❌ Error clearing XMTP storage:", e);
  }
}

export function useXmtpClient() {
  const { data: walletClient } = useWalletClient();
  const [client, setClient] = useState<Client | null>(cachedClient);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!walletClient) return;

      if (cachedClient) {
        setClient(cachedClient);
        return;
      }

      if (!clientPromise) {
        clientPromise = Client.create(walletClient, { env: "production" })
          .then((client) => {
            cachedClient = client;
            return client;
          })
          .catch(async (err: any) => {
            const msg = err?.message?.toLowerCase() || "";
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
            clientPromise = null;
          });
      }

      try {
        const result = await clientPromise;
        if (!cancelled) {
          setClient(result);
        }
      } catch (err: any) {
        console.error("XMTP init error:", err);
        if (!cancelled) setError(err.message);
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [walletClient]);

  return { xmtpClient: client, error };
}
