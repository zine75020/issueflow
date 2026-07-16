import type { Severity, Status } from "./types";

// Le statut fixe (TODO/IN_PROGRESS/DONE) ne subsiste que pour Epic — Story et
// Bug utilisent désormais des colonnes dynamiques (voir lib/useColumns.ts).
export const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "TODO", label: "À faire" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "DONE", label: "Terminé" },
];

export const STATUS_LABELS: Record<Status, string> = Object.fromEntries(
  STATUS_OPTIONS.map((opt) => [opt.value, opt.label])
) as Record<Status, string>;

export const STATUS_TONE: Record<Status, "todo" | "inprogress" | "done"> = {
  TODO: "todo",
  IN_PROGRESS: "inprogress",
  DONE: "done",
};

export const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: "CRITICAL", label: "Critique" },
  { value: "MAJOR", label: "Majeur" },
  { value: "MINOR", label: "Mineur" },
];

// Échelle Fibonacci agile standard. storyPoints/remainingEffort restent
// nullable au niveau du modèle : une valeur absente signifie "non estimé",
// distinct de 0 qui reste une estimation légitime (item trivial). On
// réutilise donc la convention existante (chaîne vide -> null) plutôt que
// de surcharger 0 avec ce sens, ce qui aurait été ambigu.
export const FIBONACCI_VALUES = [0, 1, 2, 3, 5, 8, 13, 21] as const;

export const FIBONACCI_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Non estimé" },
  ...FIBONACCI_VALUES.map((value) => ({ value: String(value), label: String(value) })),
];

export function isFibonacciValue(value: number): boolean {
  return (FIBONACCI_VALUES as readonly number[]).includes(value);
}

export const TITLE_MAX_LENGTH = 200;
export const TEXT_MAX_LENGTH = 5000;
export const COMMENT_MAX_LENGTH = 2000;
