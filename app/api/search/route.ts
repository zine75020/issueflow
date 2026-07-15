import { NextRequest, NextResponse } from "next/server";
import { searchBacklog, VoyageError } from "@/lib/backlog-queries";
import { ItemType } from "@/app/generated/prisma/client";

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const ALL_ITEM_TYPES = Object.values(ItemType);

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const q = searchParams.get("q");

  if (!q || q.trim().length === 0) {
    return NextResponse.json(
      { error: "Le paramètre q est obligatoire et ne peut pas être vide." },
      { status: 400 }
    );
  }

  let limit = DEFAULT_LIMIT;
  const limitParam = searchParams.get("limit");
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return NextResponse.json(
        { error: "Le paramètre limit doit être un entier positif." },
        { status: 400 }
      );
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  let itemTypes: ItemType[] = ALL_ITEM_TYPES;
  const typesParam = searchParams.get("types");
  if (typesParam !== null && typesParam.trim().length > 0) {
    const requested = typesParam.split(",").map((t) => t.trim().toUpperCase());
    const invalid = requested.filter((t) => !ALL_ITEM_TYPES.includes(t as ItemType));
    if (invalid.length > 0) {
      return NextResponse.json(
        {
          error: `Valeur(s) invalide(s) pour types : ${invalid.join(", ")}. Valeurs autorisées : ${ALL_ITEM_TYPES.join(", ")}.`,
        },
        { status: 400 }
      );
    }
    itemTypes = requested as ItemType[];
  }

  try {
    const results = await searchBacklog(q, { limit, itemTypes });
    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof VoyageError) {
      console.error("GET /api/search: échec de l'appel Voyage AI:", error);
      return NextResponse.json(
        {
          error: `Le service de recherche sémantique (Voyage AI) est momentanément indisponible : ${error.message}`,
        },
        { status: 503 }
      );
    }
    console.error("GET /api/search failed:", error);
    return NextResponse.json(
      { error: "Erreur serveur lors de la recherche sémantique." },
      { status: 500 }
    );
  }
}
