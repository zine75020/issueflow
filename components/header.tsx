"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme-provider";
import { SunIcon, MoonIcon, PlusIcon, ChevronIcon } from "./icons";
import { StoryFormModal } from "./StoryFormModal";
import { BugFormModal } from "./BugFormModal";
import { emitDataChanged, onDataChanged } from "@/lib/events";
import type { Epic, Sprint } from "@/lib/types";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/backlog", label: "Backlog" },
];

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();

  const [epics, setEpics] = useState<Epic[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [showBugForm, setShowBugForm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [epicsRes, sprintsRes] = await Promise.all([
          fetch("/api/epics"),
          fetch("/api/sprints"),
        ]);
        if (!epicsRes.ok || !sprintsRes.ok) return;
        const [epicsData, sprintsData] = await Promise.all([
          epicsRes.json(),
          sprintsRes.json(),
        ]);
        if (cancelled) return;
        setEpics(epicsData);
        setSprints(sprintsData);
      } catch {
        // Le bouton "+ Créer" du header est une commodité : si ce fetch
        // silencieux échoue, la validation aura de toute façon lieu à la
        // soumission du formulaire (message d'erreur affiché dans le modal).
      }
    }

    load();

    const unsubscribe = onDataChanged(load);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const defaultSprintId =
    pathname === "/sprint/active"
      ? sprints.find((s) => s.isActive)?.id
      : undefined;
  const hasActiveSprint = sprints.some((s) => s.isActive);
  const isSprintsActive = pathname.startsWith("/sprint") && pathname !== "/sprint/active";
  const isActiveSprintActive = pathname === "/sprint/active";

  return (
    <header className="border-b border-border bg-surface px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="font-semibold tracking-tight">IssueFlow</span>
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <Link
            href="/sprint"
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
              isSprintsActive
                ? "bg-accent text-accent-fg"
                : "text-muted hover:bg-surface-2 hover:text-fg"
            }`}
          >
            Sprints
          </Link>
          {hasActiveSprint && (
            <Link
              href="/sprint/active"
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                isActiveSprintActive
                  ? "bg-accent text-accent-fg"
                  : "text-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              Sprint en cours
            </Link>
          )}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            className="flex items-center gap-1.5 rounded-lg bg-accent text-accent-fg px-3 py-1.5 text-sm hover:opacity-90 transition-opacity"
          >
            <PlusIcon className="h-4 w-4" />
            Créer
            <ChevronIcon collapsed={!menuOpen} className="h-3.5 w-3.5" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-surface shadow-lg overflow-hidden z-40">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setShowStoryForm(true);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2"
              >
                Nouvelle Story
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setShowBugForm(true);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2 border-t border-border"
              >
                Nouveau Bug
              </button>
            </div>
          )}
        </div>

        <button
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-surface-2 transition-colors"
        >
          {theme === "dark" ? (
            <SunIcon className="h-4 w-4" />
          ) : (
            <MoonIcon className="h-4 w-4" />
          )}
          {theme === "dark" ? "Clair" : "Sombre"}
        </button>
      </div>

      {showStoryForm && (
        <StoryFormModal
          epics={epics}
          sprints={sprints}
          defaultSprintId={defaultSprintId}
          onClose={() => setShowStoryForm(false)}
          onCreated={() => {
            setShowStoryForm(false);
            emitDataChanged();
          }}
        />
      )}

      {showBugForm && (
        <BugFormModal
          sprints={sprints}
          defaultSprintId={defaultSprintId}
          onClose={() => setShowBugForm(false)}
          onCreated={() => {
            setShowBugForm(false);
            emitDataChanged();
          }}
        />
      )}
    </header>
  );
}
