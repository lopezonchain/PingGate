// app/api/warpcast-proxy/route.ts  (Next.js 13+ con carpeta /app)
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Leer el query param "ids" con la lista de IDs que quieras enviar
  // Ej: /api/warpcast-proxy?ids=["farcaster,0xabc...", "farcaster,0xdef..."]
  const url = new URL(request.url);
  const idsParam = url.searchParams.get("ids") || "[]";

  try {
    // Llamada server-side a la API de web3.bio
    const resp = await fetch(
      `https://api.web3.bio/profile/batch/${encodeURIComponent(idsParam)}`,
      {
        // Si la API requiere algún encabezado de autenticación, agrégalo aquí
        // headers: { "Authorization": "Bearer TU_TOKEN" },
      }
    );

    if (!resp.ok) {
      return NextResponse.json(
        { error: "Error al obtener perfiles desde web3.bio", status: resp.status },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    // Devuelves esa data a tu frontend
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message || "Error desconocido" },
      { status: 500 }
    );
  }
}
