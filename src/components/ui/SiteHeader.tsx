/**
 * Site header — spec §6.2 and §6.11.
 * - Desktop (≥1024px): wordmark, nav, then persistent Join NDC (secondary) + Donate (primary).
 * - Mobile: wordmark + menu button; Donate and Join NDC move to a fixed bottom bar so
 *   Donate is always one tap away (spec §6.2).
 * Hierarchy Donate = primary, Join NDC = secondary follows the spec's proposal (§11.4).
 * The bar is NDC brand blue with the official NDC logo, followed by the product
 * name NDCConnect (the logo is the party's; the product name stays NDCConnect).
 */
import { useId, useState, type ReactNode } from "react";
import ndcLogo from "../../assets/brand/ndc-logo.jpg";
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
          <a href="/" className="ds-header__brand" aria-label="NDCConnect home">
            <img src={ndcLogo} alt="" width={225} height={121} className="ds-header__logo" />
            <span className="ds-header__wordmark" aria-hidden="true">
              NDC<span>Connect</span>
            </span>
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
