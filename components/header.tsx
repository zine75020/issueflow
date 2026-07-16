"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "./theme-provider";
import { SunIcon, MoonIcon, PlusIcon, ChevronIcon, SparkleIcon, MenuIcon, CloseIcon } from "./icons";
import { StoryFormModal } from "./StoryFormModal";
import { BugFormModal } from "./BugFormModal";
import { AssistantPanel } from "./agent/AssistantPanel";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showStoryForm, setShowStoryForm] = useState(false);
  const [showBugForm, setShowBugForm] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);

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

  useEffect(() => {
    if (!mobileNavOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setMobileNavOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileNavOpen]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  const defaultSprintId =
    pathname === "/sprint/active"
      ? sprints.find((s) => s.isActive)?.id
      : undefined;
  const hasActiveSprint = sprints.some((s) => s.isActive);
  const isSprintsActive = pathname.startsWith("/sprint") && pathname !== "/sprint/active";
  const isActiveSprintActive = pathname === "/sprint/active";

  const allNavItems = [
    ...NAV_LINKS,
    { href: "/sprint", label: "Sprints" },
    ...(hasActiveSprint ? [{ href: "/sprint/active", label: "Sprint en cours" }] : []),
  ];

  function isNavItemActive(href: string) {
    if (href === "/sprint") return isSprintsActive;
    if (href === "/sprint/active") return isActiveSprintActive;
    return pathname === href;
  }

  return (
    <header ref={headerRef} className="border-b border-border bg-surface px-4 md:px-6 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 md:gap-6 min-w-0">
          <span className="font-semibold tracking-tight shrink-0">ZineBoard</span>
          <nav className="hidden md:flex items-center gap-1">
            {allNavItems.map((link) => {
              const active = isNavItemActive(link.href);
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
          </nav>
        </div>

        <div className="flex items-center gap-1.5 md:gap-2">
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Créer"
              className="flex items-center justify-center gap-1.5 rounded-lg bg-accent text-accent-fg text-sm hover:opacity-90 transition-opacity px-3 py-1.5 max-md:h-11 max-md:w-11 max-md:px-0"
            >
              <PlusIcon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">Créer</span>
              <ChevronIcon collapsed={!menuOpen} className="hidden md:inline h-3.5 w-3.5" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg border border-border bg-surface shadow-lg overflow-hidden z-40">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setShowStoryForm(true);
                  }}
                  className="w-full text-left px-3 py-3 md:py-2 text-sm hover:bg-surface-2"
                >
                  Nouvelle Story
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setShowBugForm(true);
                  }}
                  className="w-full text-left px-3 py-3 md:py-2 text-sm hover:bg-surface-2 border-t border-border"
                >
                  Nouveau Bug
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setShowAssistant((open) => !open)}
            aria-label="Ouvrir l'Assistant Backlog"
            className={`flex items-center justify-center gap-1.5 rounded-lg border text-sm transition-colors px-3 py-1.5 max-md:h-11 max-md:w-11 max-md:px-0 ${
              showAssistant
                ? "border-accent text-accent bg-surface-2"
                : "border-border hover:bg-surface-2"
            }`}
          >
            <SparkleIcon className="h-4 w-4 text-accent shrink-0" />
            <span className="hidden md:inline">Assistant IA</span>
          </button>

          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"}
            className="flex items-center justify-center gap-2 rounded-lg border border-border text-sm hover:bg-surface-2 transition-colors px-3 py-1.5 max-md:h-11 max-md:w-11 max-md:px-0"
          >
            {theme === "dark" ? (
              <SunIcon className="h-4 w-4 shrink-0" />
            ) : (
              <MoonIcon className="h-4 w-4 shrink-0" />
            )}
            <span className="hidden md:inline">{theme === "dark" ? "Clair" : "Sombre"}</span>
          </button>

          <button
            onClick={() => setMobileNavOpen((open) => !open)}
            aria-label={mobileNavOpen ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={mobileNavOpen}
            className="md:hidden flex items-center justify-center h-11 w-11 rounded-lg border border-border hover:bg-surface-2 transition-colors"
          >
            {mobileNavOpen ? <CloseIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileNavOpen && (
        <nav className="md:hidden mt-3 flex flex-col gap-1 border-t border-border pt-3">
          {allNavItems.map((link) => {
            const active = isNavItemActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-3 text-base transition-colors ${
                  active
                    ? "bg-accent text-accent-fg"
                    : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      )}

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

      {showAssistant && <AssistantPanel onClose={() => setShowAssistant(false)} />}
    </header>
  );
}
