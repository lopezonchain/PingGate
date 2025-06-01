// app/api/warpcast-proxy/route.ts
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // 1) Extraemos el query param "ids" (supuestamente viene URL-encoded)
  const url = new URL(request.url);
  const rawIdsParam = url.searchParams.get("ids") || "[]";

  // 2) decodeURIComponent para volver a la cadena JSON (p. ej. '["farcaster,0x…"]')
  let decodedJson: string;
  try {
    decodedJson = decodeURIComponent(rawIdsParam);
  } catch {
    return NextResponse.json(
      { error: "No se pudo decodeURIComponent(`ids`). Asegúrate de llamar al proxy como ?ids=<JSON-encoded>" },
      { status: 400 }
    );
  }

  // 3) JSON.parse para asegurarnos de que sea un array válido
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

  // 4) JSON.stringify vuelve a la forma '["farcaster,0x…"]'
  const reserialized = JSON.stringify(parsedArray);

  // 5) encodeURIComponent para darle el formato que Web3.bio exige
  const finalSegment = encodeURIComponent(reserialized);
  const targetURL = `https://api.web3.bio/profile/batch/${finalSegment}`;

  // (Opcional) comprobar en consola la URL que estamos llamando
  console.log("Llamando a Web3.bio en:", targetURL);

  try {
    const resp = await fetch(targetURL, {
      // Si Web3.bio necesita Authorization o API Key, ponerlo aquí:
      // headers: { "Authorization": `Bearer ${process.env.WEB3BIO_API_KEY}` },
    });
    if (resp.status === 403) {
      return NextResponse.json(
        { error: "Web3.bio devolvió 403 Forbidden. Revisa que el array exista o que no requieran token." },
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
