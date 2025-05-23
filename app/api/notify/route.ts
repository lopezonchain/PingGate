// src/app/api/notify/route.ts
import { NextResponse } from "next/server";
import { sendFrameNotification } from "@/lib/notification-client";

// Definición manual de SendFrameNotificationResult
export type SendFrameNotificationResult =
  | { state: "success"; successfulTokens: string[]; invalidTokens: string[] }
  | { state: "rate_limit"; rateLimitedTokens?: string[] }
  | { state: "error"; error: unknown }
  | { state: "no_token" };

export async function POST(request: Request) {
  // 1️⃣ Parsear JSON de forma segura
  let payload: any;
  try {
    payload = await request.json();
  } catch (e) {
    console.error("🔔 Invalid JSON", e);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // 2️⃣ Validar estructura mínima con parámetros opcionales
  const { fid, notification, notificationId, targetUrl, tokens } = payload;

  if (typeof fid !== "number") {
    return NextResponse.json({ error: "Expected fid: number" }, { status: 422 });
  }
  if (
    !notification ||
    typeof notification.title !== "string" ||
    typeof notification.body !== "string"
  ) {
    return NextResponse.json(
      { error: "Expected notification: { title: string, body: string }" },
      { status: 422 }
    );
  }
  if (targetUrl !== undefined && typeof targetUrl !== "string") {
    return NextResponse.json(
      { error: "targetUrl must be a string" },
      { status: 422 }
    );
  }
  if (tokens && tokens.length > 0 ) {
    for (const token of tokens) {
      if (typeof token !== "string") {
        return NextResponse.json(
          { error: "each token must be a string" },
          { status: 422 }
        );
      }
    }
  }
  

  // 3️⃣ Construir payload para sendFrameNotification
  const sendPayload = {
    fid,
    title: notification.title,
    body: notification.body,
    notificationId: notificationId ?? undefined,
    targetUrl: targetUrl ?? undefined,
    tokens,
  };

  try {
    const rawResult = await sendFrameNotification(sendPayload);
    const result = rawResult as SendFrameNotificationResult;

    switch (result.state) {
      case "no_token":
        console.warn(`No notification token for fid ${fid}`);
        return NextResponse.json(
          { error: "No notification token registered for this user" },
          { status: 404 }
        );

      case "error":
        const errorMessage =
          result.error instanceof Error ? result.error.message : String(result.error);
        console.error("⚠️ Frame notification error:", errorMessage);
        return NextResponse.json(
          { error: errorMessage },
          { status: 500 }
        );

      case "rate_limit":
        return NextResponse.json(
          { error: "Rate limited", rateLimitedTokens: result.rateLimitedTokens || [] },
          { status: 429 }
        );

      case "success":
        return NextResponse.json(
          {
            success: true,
            successfulTokens: result.successfulTokens,
            invalidTokens: result.invalidTokens,
          },
          { status: 200 }
        );

      default:
        return NextResponse.json(
          { error: "Unexpected notification state" },
          { status: 500 }
        );
    }
  } catch (e) {
    console.error("🔥 sendFrameNotification threw:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Notification service failure" },
      { status: 502 }
    );
  }
}
