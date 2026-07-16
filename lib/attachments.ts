import { del } from "@vercel/blob";
import type { AttachmentMimeType } from "@/lib/constants";

// Signatures binaires (magic numbers) des 4 types autorisés. On ne fait jamais confiance
// au Content-Type déclaré par le client ni à l'extension du nom de fichier (falsifiables) :
// seuls ces premiers octets, lus depuis le fichier réellement stocké, déterminent le type.
const MAGIC_NUMBER_CHECKS: { mimeType: AttachmentMimeType; check: (bytes: Uint8Array) => boolean }[] = [
  {
    mimeType: "image/jpeg",
    check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mimeType: "image/png",
    check: (b) =>
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mimeType: "image/webp",
    check: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 && // "RIFF"
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50, // "WEBP"
  },
  {
    mimeType: "application/pdf",
    check: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46, // "%PDF"
  },
];

/** Détecte le vrai type MIME à partir des premiers octets d'un fichier. Retourne null si
 * aucune des 4 signatures autorisées ne correspond. */
export function sniffAttachmentMimeType(bytes: Uint8Array): AttachmentMimeType | null {
  return MAGIC_NUMBER_CHECKS.find((entry) => entry.check(bytes))?.mimeType ?? null;
}

/** Supprime un ou plusieurs blobs Vercel Blob. Best-effort : à l'appelant de décider
 * comment réagir à un échec (voir les différents appels : suppression individuelle vs
 * cascade en masse n'ont pas la même tolérance à l'échec). */
export async function deleteAttachmentBlobs(urls: string[]): Promise<void> {
  if (urls.length === 0) return;
  await del(urls);
}
