/**
 * Donate button — spec §6.2. A primary button with the fixed label "Donate".
 * Placement rules (header on desktop, bottom bar on mobile, every candidate profile)
 * live in SiteHeader and CandidateCard. Never place it so that it reads as a
 * prerequisite for Vote/Follow.
 */
import { Button } from "./Button";
import { Icon } from "./Icon";

interface DonateButtonProps {
  href?: string;
  onClick?: () => void;
  size?: "md" | "sm";
  fullWidth?: boolean;
  className?: string;
}

export function DonateButton({ href, onClick, size = "md", fullWidth, className }: DonateButtonProps) {
  const common = { variant: "primary" as const, size, fullWidth, className, icon: <Icon name="heart" size={18} /> };
  return href ? (
    <Button {...common} href={href}>
      Donate
    </Button>
  ) : (
    <Button {...common} onClick={onClick}>
      Donate
    </Button>
  );
}
