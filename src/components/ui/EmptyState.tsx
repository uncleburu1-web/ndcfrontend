/**
 * Empty state — spec §6.11. Says what to do next; an empty screen is an invitation to act.
 */
import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import "./EmptyState.css";

interface EmptyStateProps {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon = "inbox", title, children, action }: EmptyStateProps) {
  return (
    <div className="ds-empty">
      <span className="ds-empty__icon">
        <Icon name={icon} size={28} />
      </span>
      <h3 className="ds-empty__title">{title}</h3>
      {children && <p className="ds-empty__text">{children}</p>}
      {action && <div className="ds-empty__action">{action}</div>}
    </div>
  );
}
