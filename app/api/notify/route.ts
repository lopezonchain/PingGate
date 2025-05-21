// src/app/api/notify/route.ts
import { sendFrameNotification } from "@/lib/notification-client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // 1️⃣ Parsear JSON de forma segura
  let payload: any;
  try {
    payload = await request.json();
  } catch (e) {
    console.error("🔔 Invalid JSON", e);
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // 2️⃣ Validar estructura mínima (notificationDetails es opcional)
  const { fid, notification } = payload;
  if (
    typeof fid !== "number" ||
    !notification ||
    typeof notification.title !== "string" ||
    typeof notification.body !== "string"
  ) {
    return NextResponse.json(
      { error: "Expected { fid: number, notification: { title: string, body: string, notificationDetails?: any } }" },
      { status: 422 }
    );
  }

  // 3️⃣ Enviar la notificación, dejando que sendFrameNotification
  //     obtenga notificationDetails si no vienen en el payload
  try {
    const result = await sendFrameNotification({
      fid,
      title: notification.title,
      body: notification.body,
      notificationDetails: notification.notificationDetails ?? undefined,
    });

    if (result.state === "no_token") {
      console.warn(`No notification token for fid ${fid}`);
      return NextResponse.json(
        { error: "No notification token registered for this user" },
        { status: 404 }
      );
    }

    if (result.state === "error") {
      console.error("⚠️ Frame notification error:", result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    if (result.state === "rate_limit") {
      return NextResponse.json(
        { error: "Rate limited" },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (e) {
    console.error("🔥 sendFrameNotification threw:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Notification service failure" },
      { status: 502 }
    );
  }
}
