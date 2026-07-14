const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
export const VOYAGE_EMBEDDING_MODEL = "voyage-4-lite";

const REQUEST_TIMEOUT_MS = 15_000;

export class VoyageError extends Error {}

type VoyageInputType = "document" | "query";

type VoyageEmbeddingsResponse = {
  data?: { embedding: number[] }[];
};

export async function embedText(
  text: string,
  inputType: VoyageInputType
): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new VoyageError("VOYAGE_API_KEY est manquante dans l'environnement.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: [text],
        model: VOYAGE_EMBEDDING_MODEL,
        input_type: inputType,
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new VoyageError("La requête vers l'API Voyage AI a expiré (timeout).");
    }
    throw new VoyageError(
      `Impossible de contacter l'API Voyage AI : ${(error as Error).message}`
    );
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new VoyageError("Quota Voyage AI dépassé (429 Too Many Requests).");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new VoyageError(
      `Erreur API Voyage AI (${response.status} ${response.statusText}) : ${body}`
    );
  }

  const data = (await response.json()) as VoyageEmbeddingsResponse;
  const vector = data.data?.[0]?.embedding;
  if (!vector) {
    throw new VoyageError("Réponse Voyage AI invalide : aucun vecteur retourné.");
  }

  return vector;
}
