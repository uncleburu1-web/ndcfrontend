/**
 * Clerk's `appearance`, mapped to the 01 design-system tokens (spec §7.4).
 * Values are READ from the CSS custom properties at runtime, so there are no colour
 * literals here and `npm run check:tokens` keeps passing. If the tokens change,
 * Clerk follows.
 */

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function clerkAppearance() {
  return {
    variables: {
      colorPrimary: token("--action-primary-bg"),
      colorPrimaryForeground: token("--action-primary-fg"),
      colorDanger: token("--tone-error-fg"),
      colorSuccess: token("--tone-success-fg"),
      colorWarning: token("--tone-warning-fg"),
      colorBackground: token("--surface"),
      colorForeground: token("--text"),
      colorMutedForeground: token("--text-muted"),
      colorInput: token("--surface"),
      colorInputForeground: token("--text"),
      colorBorder: token("--border-control"),
      colorRing: token("--focus-ring"),
      fontFamily: token("--font-family"),
      fontSize: token("--text-base"),
      borderRadius: token("--radius-md"),
    },
  };
}
