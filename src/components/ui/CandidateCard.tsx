/**
 * Candidate card — spec §6.10.
 * Photo, name, position sought, constituency/area, party, verified tick.
 * Optional actions slot for Vote and Donate (passed in so the card stays presentational).
 */
import type { ReactNode } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Skeleton } from "./Skeleton";
import "./CandidateCard.css";

export interface CandidateCardProps {
  name: string;
  position: string;
  area: string;
  party: string;
  photoSrc?: string;
  photoSrcSet?: string | null;
  verified?: boolean;
  href?: string;
  actions?: ReactNode;
}

export function CandidateCard({ name, position, area, party, photoSrc, photoSrcSet, verified, href, actions }: CandidateCardProps) {
  const title = href ? <a href={href}>{name}</a> : name;
  return (
    <article className="ds-candidate">
      <div className="ds-candidate__identity">
        <Avatar name={name} src={photoSrc} srcSet={photoSrcSet} size="lg" />
        <div className="ds-candidate__text">
          <h3 className="ds-candidate__name">
            {title}
            {verified && <Icon name="verified" size={18} label="Verified candidate" className="ds-candidate__verified" />}
          </h3>
          <p className="ds-candidate__position">{position}</p>
          <dl className="ds-candidate__meta">
            <div>
              <dt>Area</dt>
              <dd>{area}</dd>
            </div>
            <div>
              <dt>Party</dt>
              <dd>{party}</dd>
            </div>
          </dl>
        </div>
      </div>
      {actions && <div className="ds-candidate__actions">{actions}</div>}
    </article>
  );
}

/** Loading placeholder with the same footprint as a card. */
export function CandidateCardSkeleton() {
  return (
    <div className="ds-candidate ds-candidate--skeleton" aria-hidden="true">
      <div className="ds-candidate__identity">
        <Skeleton circle width={72} height={72} />
        <div className="ds-candidate__text ds-candidate__text--skeleton">
          <Skeleton width="70%" height={22} />
          <Skeleton width="50%" height={16} />
          <Skeleton width="60%" height={14} />
        </div>
      </div>
    </div>
  );
}
