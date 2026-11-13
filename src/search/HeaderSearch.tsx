/**
 * Header search (spec 12 §4.1). On wide screens a Search button opens a panel with the search field and
 * suggestions (a permanent field didn't fit beside the nav); on narrower screens it links to /search.
 * "/" opens it from anywhere outside a text field. Suggestion requests are anonymous.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useApi } from "../auth/session";
import { Avatar, Icon } from "../components/ui";
import { Q_MIN, type Suggestions } from "./types";
import "./search.css";
import { t as tr } from "../i18n";

const WIDE = "(min-width: 1280px)";

function typingInField(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return Boolean(el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)));
}
const isWide = () => typeof window.matchMedia === "function" && window.matchMedia(WIDE).matches;

export function HeaderSearch() {
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const panelId = useId();
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [q, setQ] = useState("");
  const [data, setData] = useState<Suggestions | null>(null);
  const [active, setActive] = useState(-1);

  const close = (focusButton = false) => {
    setExpanded(false);
    setActive(-1);
    if (focusButton) button.current?.focus();
  };
  useEffect(() => close(), [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (expanded) input.current?.focus();
  }, [expanded]);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey || typingInField(e.target)) return;
      e.preventDefault();
      if (isWide()) setExpanded(true);
      else navigate("/search");
    };
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setExpanded(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [navigate]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < Q_MIN) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    const t = window.setTimeout(() => {
      api<Suggestions>(`/search/suggest/?q=${encodeURIComponent(term)}`, { anonymous: true, signal: ctrl.signal })
        .then((d) => { setData(d); setActive(-1); })
        .catch(() => setData(null)); // the full search still works on Enter (spec 12 §11)
    }, 250);
    return () => { window.clearTimeout(t); ctrl.abort(); };
  }, [q, api]);

  const items = [
    ...(data?.candidates ?? []).map((c) => ({ key: `c-${c.slug}`, url: `/candidates/${c.slug}`, kind: "candidate" as const, c })),
    ...(data?.places ?? []).map((t, i) => ({ key: `p-${i}`, url: t.url, kind: "place" as const, t: { title: t.title, candidate: "" } })),  // spec 19 §9
    ...(data?.titles ?? []).map((t, i) => ({ key: `t-${i}`, url: t.url, kind: t.type, t })),
  ];
  const showList = expanded && q.trim().length >= Q_MIN && items.length > 0;
  const go = (url: string) => {
    close();
    setQ("");
    navigate(url);
  };
  const submit = () => {
    const term = q.trim();
    if (term) go(`/search?q=${encodeURIComponent(term)}`);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (showList && active >= 0) go(items[active].url);
      else submit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (active >= 0) setActive(-1);
      else close(true);
    }
  };

  return (
    <div className="hs" ref={root}>
      <button ref={button} type="button" className="hs__button hs__button--wide" aria-expanded={expanded} aria-controls={panelId}
        aria-label={tr("search.search")} onClick={() => setExpanded((x) => !x)}>
        <Icon name="search" size={20} />
      </button>
      <Link to="/search" className="hs__button hs__button--narrow" aria-label={tr("search.search")}>
        <Icon name="search" size={20} />
      </Link>
      {expanded && (
        <div id={panelId} className="hs__panel" role="search">
          <div className="hs__field">
            <Icon name="search" size={18} className="hs__icon" />
            <input
              ref={input}
              type="search"
              className="hs__input"
              placeholder={tr("search.search-candidates-news-posts")}
              aria-label={tr("search.search-ndcconnect")}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showList}
              aria-controls={listId}
              aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </div>
          <span className="visually-hidden" aria-live="polite">
            {showList ? tr("search.suggestion", { length: items.length, v: items.length === 1 ? "" : "s" }) : ""}
          </span>
          {showList && (
            <ul id={listId} role="listbox" className="hs__list" aria-label={tr("search.suggestions")}>
              {items.map((it, i) => (
                <li key={it.key} id={`${listId}-${i}`} role="option" aria-selected={i === active}
                  className={i === active ? "hs__opt hs__opt--active" : "hs__opt"}
                  onMouseDown={(e) => { e.preventDefault(); go(it.url); }}>
                  {it.kind === "candidate" ? (
                    <>
                      <Avatar name={it.c.full_name} src={it.c.photo?.url_200 ?? undefined} size="xs" />
                      <span><strong>{it.c.full_name}</strong><span className="hs__meta">{it.c.position_label} · {it.c.area_display}</span></span>
                    </>
                  ) : (
                    <>
                      <Icon name={it.kind === "news" ? "inbox" : it.kind === "place" ? "mapPin" : "bell"} size={16} />
                      <span>{it.t.title}<span className="hs__meta">{it.kind === "news" ? tr("search.news") : it.kind === "place" ? tr("search.place") : tr("search.post-by", { candidate: it.t.candidate })}</span></span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          <p className="hs__foot">
            <button type="button" className="home-chip__clear" onClick={submit} disabled={q.trim().length < Q_MIN}>{tr("search.see-all-results")}</button>
            <Link to="/states" onClick={() => close()}>{tr("search.browse-by-state")}</Link>
          </p>
        </div>
      )}
    </div>
  );
}
