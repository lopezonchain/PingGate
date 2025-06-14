import {
  setUserNotificationDetails,
  deleteUserNotificationDetails,
} from "@/lib/notification";
import { sendFrameNotification } from "@/lib/notification-client";
import { http } from "viem";
import { createPublicClient } from "viem";
import { optimism } from "viem/chains";

const appName = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME;

const KEY_REGISTRY_ADDRESS = "0x00000000Fc1237824fb747aBDE0FF18990E59b7e";

const KEY_REGISTRY_ABI = [
  {
    inputs: [
      { name: "fid", type: "uint256" },
      { name: "key", type: "bytes" },
    ],
    name: "keyDataOf",
    outputs: [
      {
        components: [
          { name: "state", type: "uint8" },
          { name: "keyType", type: "uint32" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function verifyFidOwnership(fid: number, appKey: `0x${string}`) {
  const client = createPublicClient({
    chain: optimism,
    transport: http(),
  });

  try {
    const result = await client.readContract({
      address: KEY_REGISTRY_ADDRESS,
      abi: KEY_REGISTRY_ABI,
      functionName: "keyDataOf",
      args: [BigInt(fid), appKey],
    });

    return result.state === 1 && result.keyType === 1;
  } catch (error) {
    console.error("Key Registry verification failed:", error);
    return false;
  }
}

function decode(encoded: string) {
  return JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8"));
}

export async function POST(request: Request) {
  const requestJson = await request.json();

  const { header: encodedHeader, payload: encodedPayload } = requestJson;

  const headerData = decode(encodedHeader);
  const event = decode(encodedPayload);

  const { fid, key } = headerData;

  const valid = await verifyFidOwnership(fid, key);

  if (!valid) {
    return Response.json(
      { success: false, error: "Invalid FID ownership" },
      { status: 401 },
    );
  }

  switch (event.event) {
    case "frame_added":
      console.log(
        "frame_added",
        "event.notificationDetails",
        event.notificationDetails,
      );
      if (event.notificationDetails) {
        await setUserNotificationDetails(fid, event.notificationDetails);
        await sendFrameNotification({
          fid,
          title: `Welcome to ${appName}`,
          body: `Privately chat with wallet to wallet encryption. Find experts. Start offering a chat service and monetize your inbox. Wallet to wallet messages with Farcaster notifications`,
          targetUrl: `https://pinggate.lopezonchain.xyz`
        });
      } else {
        await deleteUserNotificationDetails(fid);
      }

      break;
    case "frame_removed": {
      console.log("frame_removed");
      await setUserNotificationDetails(fid, event.notificationDetails);
      await sendFrameNotification({
        fid,
        title: `Miniapp removed`,
        body: `You removed ${appName} successfully. Please tell me how I can improve your experience. @lopezonchain.xyz`,
        targetUrl: `https://pinggate.lopezonchain.xyz`
      });
      await deleteUserNotificationDetails(fid);
      break;
    }
    case "notifications_enabled": {
      console.log("notifications_enabled", event.notificationDetails);
      await setUserNotificationDetails(fid, event.notificationDetails);
      await sendFrameNotification({
        fid,
        title: `Notifications enabled!`,
        body: `Thank you for enabling ${appName} notifications`,
        targetUrl: `https://pinggate.lopezonchain.xyz`
      });

      break;
    }
    case "notifications_disabled": {
      console.log("notifications_disabled");
      await setUserNotificationDetails(fid, event.notificationDetails);
      await sendFrameNotification({
        fid,
        title: `Notifications disabled successfully on ${appName}`,
        body: `Please tell me how I can improve your experience. @lopezonchain.xyz`,
        targetUrl: `https://pinggate.lopezonchain.xyz`
      });
      await deleteUserNotificationDetails(fid);

      break;
    }
  }

  return Response.json({ success: true });
}
