/**
 * Tabs — spec §6.11. WAI-ARIA tabs pattern: arrow keys move between tabs,
 * Home/End jump to first/last, only the active tab is in the Tab order.
 */
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import "./Tabs.css";

interface TabsProps {
  label: string;
  tabs: { id: string; label: ReactNode; content: ReactNode }[];
  value: string;
  onChange: (id: string) => void;
}

export function Tabs({ label, tabs, value, onChange }: TabsProps) {
  const baseId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.id === value));

  const focusTab = (index: number) => {
    const i = (index + tabs.length) % tabs.length;
    onChange(tabs[i].id);
    refs.current[i]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const keys: Record<string, () => void> = {
      ArrowRight: () => focusTab(activeIndex + 1),
      ArrowLeft: () => focusTab(activeIndex - 1),
      Home: () => focusTab(0),
      End: () => focusTab(tabs.length - 1),
    };
    if (keys[e.key]) {
      e.preventDefault();
      keys[e.key]();
    }
  };

  return (
    <div className="ds-tabs">
      <div role="tablist" aria-label={label} className="ds-tabs__list" onKeyDown={onKeyDown}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => (refs.current[i] = el)}
            id={`${baseId}-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={i === activeIndex}
            aria-controls={`${baseId}-panel-${t.id}`}
            tabIndex={i === activeIndex ? 0 : -1}
            className="ds-tabs__tab"
            onClick={() => onChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.id}
          id={`${baseId}-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${t.id}`}
          hidden={i !== activeIndex}
          tabIndex={0}
          className="ds-tabs__panel"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
