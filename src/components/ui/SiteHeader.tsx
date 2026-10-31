/**
 * Site header — spec §6.2 and §6.11.
 * - Desktop (≥1024px): wordmark, nav, then persistent Join NDC (secondary) + Donate (primary).
 * - Mobile: wordmark + menu button; Donate and Join NDC move to a fixed bottom bar so
 *   Donate is always one tap away (spec §6.2).
 * Hierarchy Donate = primary, Join NDC = secondary follows the spec's proposal (§11.4).
 * The wordmark is text only: no NDC logo asset is used until an approved one exists.
 */
import { useId, useState, type ReactNode } from "react";
import { Button } from "./Button";
import { DonateButton } from "./DonateButton";
import { Icon } from "./Icon";
import "./SiteHeader.css";

interface NavLink {
  label: string;
  href: string;
  current?: boolean;
}

interface SiteHeaderProps {
  links: NavLink[];
  donateHref: string;
  joinHref: string;
  /** Account area (sign-in button or user menu). */
  account?: ReactNode;
}

export function SiteHeader({ links, donateHref, joinHref, account }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  return (
    <>
      <header className="ds-header">
        <div className="ds-header__inner">
          <a href="/" className="ds-header__wordmark">
            NDC<span>Connect</span>
          </a>

          <nav className="ds-header__nav" aria-label="Main">
            <ul>
              {links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} aria-current={l.current ? "page" : undefined}>
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ds-header__actions">
            {account}
            <Button variant="secondary" href={joinHref}>
              Join NDC
            </Button>
            <DonateButton href={donateHref} />
          </div>

          <button
            type="button"
            className="ds-header__menu"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <Icon name={menuOpen ? "close" : "menu"} />
            <span>Menu</span>
          </button>
        </div>

        <nav id={menuId} className="ds-header__drawer" aria-label="Main" hidden={!menuOpen}>
          <ul>
            {links.map((l) => (
              <li key={l.href}>
                <a href={l.href} aria-current={l.current ? "page" : undefined}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
          {account && <div className="ds-header__drawer-account">{account}</div>}
        </nav>
      </header>

      <div className="ds-bottombar" role="region" aria-label="Quick actions">
        <Button variant="secondary" href={joinHref} fullWidth>
          Join NDC
        </Button>
        <DonateButton href={donateHref} fullWidth />
      </div>
    </>
  );
}
