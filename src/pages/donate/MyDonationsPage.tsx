/** /my-donations — sign-in only (spec 05 §4.4, FR-044). */
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../../auth/session";
import type { Paginated } from "../../candidates/types";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Pagination, Skeleton, StatusBadge } from "../../components/ui";
import { designationText, formatKobo } from "../../donations/money";
import type { MyDonation } from "../../donations/types";
import { formatDate } from "../../lib/format";
import "./donate.css";

export default function MyDonationsPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const res = useRequest(`my-donations:${page}`, (signal) => api<Paginated<MyDonation>>(`/me/donations/${page > 1 ? `?page=${page}` : ""}`, { signal }));
  useEffect(() => {
    document.title = "My donations | NDCConnect";
  }, []);

  return (
    <div className="donate-page">
      <header className="donate-page__head">
        <h1>My donations</h1>
        <p className="donate-page__lead">Donations you made while signed in. Only you can see this list.</p>
      </header>
      {res.error ? (
        <Banner tone="error" title="We couldn’t load your donations" action={<Button variant="secondary" size="sm" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : res.loading && !res.data ? (
        <Skeleton width="100%" height={80} />
      ) : res.data && res.data.count === 0 ? (
        <EmptyState title="No donations yet" action={<Button href="/donate">Donate</Button>}>Donations you make while signed in appear here.</EmptyState>
      ) : res.data ? (
        <>
          <ul className="donation-list">
            {res.data.results.map((d) => (
              <li key={d.reference} className="donation-row">
                <div>
                  <p className="donation-row__amount">{formatKobo(d.net_kobo)}</p>
                  <p className="donation-row__meta">{designationText(d)} · {formatDate(d.paid_at ?? d.created_at)}</p>
                  {d.status === "successful" && <p className="donation-row__meta">Shown publicly as “{d.public_label}”</p>}
                </div>
                <div className="donation-row__side">
                  <StatusBadge set="donation" status={d.status} />
                  <Link to={`/donate/receipt/${d.reference}`}>Receipt</Link>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={page} pageCount={Math.ceil(res.data.count / 20)} onChange={(p) => setParams(p > 1 ? { page: String(p) } : {})} label="Donation pages" />
        </>
      ) : null}
    </div>
  );
}
