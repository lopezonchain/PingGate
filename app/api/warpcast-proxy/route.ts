// app/api/warpcast-proxy/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // 1) Extraemos el parámetro "ids" (llegará URL-encoded)
  const url = new URL(request.url);
  const rawIdsParam = url.searchParams.get("ids") || "[]";

  // 2) decodeURIComponent para volver al JSON puro (por ejemplo '["farcaster,0x..."]')
  let decodedJson: string;
  try {
    decodedJson = decodeURIComponent(rawIdsParam);
  } catch {
    return NextResponse.json(
      { error: "Formato de `ids` inválido; asegúrate de pasarlo URL-encoded" },
      { status: 400 }
    );
  }

  // 3) JSON.parse para asegurarnos de que es un array de strings
  let parsedArray: string[];
  try {
    const arr = JSON.parse(decodedJson);
    if (!Array.isArray(arr)) throw new Error();
    parsedArray = arr as string[];
  } catch {
    return NextResponse.json(
      { error: "`ids` debe ser un JSON válido de un array de strings." },
      { status: 400 }
    );
  }

  // 4) Volvemos a serializar y luego URL-encode para el endpoint de Web3.bio
  const reserialized = JSON.stringify(parsedArray);
  const finalSegment = encodeURIComponent(reserialized);
  const targetURL = `https://api.web3.bio/profile/batch/${finalSegment}`;

  // 5) Preparamos el header de autenticación con tu API key
  const apiKey = process.env.WEB3BIO_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "No se encontró la variable de entorno WEB3BIO_API_KEY" },
      { status: 500 }
    );
  }

  try {
    const resp = await fetch(targetURL, {
      headers: {
        "X-API-KEY": `Bearer ${apiKey}`,
      },
    });

    if (resp.status === 429) {
      return NextResponse.json(
        {
          error:
            "Demasiadas peticiones a Web3.bio (429). Intenta de nuevo más tarde.",
        },
        { status: 429 }
      );
    }
    if (resp.status === 403) {
      return NextResponse.json(
        {
          error:
            "Web3.bio devolvió 403 Forbidden. Verifica que tu API key esté activa y que el array exista.",
        },
        { status: 403 }
      );
    }
    if (!resp.ok) {
      return NextResponse.json(
        { error: `Web3.bio API error: ${resp.status}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Error inesperado al llamar a Web3.bio." },
      { status: 500 }
    );
  }
}
