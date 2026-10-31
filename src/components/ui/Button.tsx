/**
 * Button — spec §6.1.
 * Variants: primary (red fill) · secondary (white, strong border) · ghost (text) · danger (error).
 * Sizes: md (44px min — touch target) · sm (36px — desktop-dense tables only).
 * States: default, hover, pressed, focus-visible, disabled, loading (spinner + verb).
 * Renders an <a> when `href` is given so links can share the same look.
 */
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and replaces the label with this verb, e.g. "Paying…". */
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
  fullWidth?: boolean;
  children: ReactNode;
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkProps = CommonProps & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

function classes({ variant = "primary", size = "md", loading, fullWidth }: CommonProps, extra?: string) {
  return [
    "ds-button",
    `ds-button--${variant}`,
    `ds-button--${size}`,
    loading && "ds-button--loading",
    fullWidth && "ds-button--full",
    extra,
  ]
    .filter(Boolean)
    .join(" ");
}

function Content({ loading, loadingLabel, icon, children }: CommonProps) {
  if (loading) {
    return (
      <>
        <span className="ds-button__spinner" aria-hidden="true" />
        <span>{loadingLabel ?? children}</span>
      </>
    );
  }
  return (
    <>
      {icon && <span className="ds-button__icon">{icon}</span>}
      <span>{children}</span>
    </>
  );
}

export function Button(props: ButtonProps | LinkProps) {
  const { variant, size, loading, loadingLabel, icon, fullWidth, children, className, ...rest } = props;
  const common = { variant, size, loading, loadingLabel, icon, fullWidth, children };

  if ("href" in rest && rest.href !== undefined) {
    const anchor = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <a {...anchor} className={classes(common, className)} aria-busy={loading || undefined}>
        <Content {...common} />
      </a>
    );
  }

  const button = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      type="button"
      {...button}
      className={classes(common, className)}
      disabled={button.disabled || loading}
      aria-busy={loading || undefined}
    >
      <Content {...common} />
    </button>
  );
}
