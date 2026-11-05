/** /account/volunteering — spec 18 §9: your applications, decisions and updates from campaigns; Withdraw. */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../../auth/api";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, EmptyState, Skeleton, useToast } from "../../components/ui";
import { formatDate } from "../../lib/format";
import type { MyVolunteering } from "../../events/types";
import { VOLUNTEER_ROLE_WORDS } from "../../events/types";
import "../../events/events.css";

export default function AccountVolunteeringPage() {
  const api = useApi();
  const toast = useToast();
  const res = useRequest("my-volunteering", (signal) => api<MyVolunteering>("/me/volunteering/", { signal }));
  const [data, setData] = useState<MyVolunteering | null>(null);
  useEffect(() => { setData(res.data); }, [res.data]);
  useEffect(() => { document.title = "Volunteering | NDCConnect"; }, []);
  const withdraw = async (id: string) => {
    if (!window.confirm("Withdraw your application? The campaign stops seeing your details.")) return;
    try {
      const a = await api<MyVolunteering["results"][number]>(`/me/volunteering/${id}/withdraw/`, { method: "POST" });
      setData((d) => d && { ...d, results: d.results.map((x) => (x.id === id ? a : x)) });
      toast.show({ tone: "success", message: "Withdrawn." });
    } catch (err) {
      toast.show({ tone: "error", message: err instanceof ApiError ? err.message : "That didn’t work." });
    }
  };
  if (res.error) return <div className="ev-page ev-narrow"><Banner tone="error">{res.error.message}</Banner></div>;
  if (!data) return <div className="ev-page ev-narrow"><Skeleton width="100%" height={200} /></div>;
  return (
    <div className="ev-page ev-narrow">
      <header>
        <p className="article-back"><Link to="/account">← Account</Link></p>
        <h1>Volunteering</h1>
        <p>Only you and the campaign you applied to can see this.</p>
      </header>
      {data.results.length === 0 ? <EmptyState title="You haven’t applied to volunteer" action={<Button href="/candidates">Find a candidate</Button>} /> : (
        <ul className="ev-cards">
          {data.results.map((a) => (
            <li key={a.id} className="ev-box">
              <h2 className="ev-card__title"><Link to={`/candidates/${String(a.candidate.slug)}`}>{String(a.candidate.full_name)}</Link></h2>
              <p className="ev-meta"><span className="ev-chip">{a.status_label}</span> {a.roles.map((r) => VOLUNTEER_ROLE_WORDS[r] ?? r).join(", ")}
                · applied {formatDate(a.created_at)}</p>
              {a.decline_reason && <p>{a.decline_reason}</p>}
              {(a.status === "pending" || a.status === "accepted") && <div><Button size="sm" variant="ghost" onClick={() => void withdraw(a.id)}>Withdraw</Button></div>}
            </li>
          ))}
        </ul>
      )}
      {data.updates.length > 0 && (
        <section aria-labelledby="vu-h">
          <h2 id="vu-h">Updates from campaigns</h2>
          <ul className="ev-updates">{data.updates.map((u, i) => <li key={i}><p>{String(u.text)}</p>
            <p className="ev-meta">{String(u.candidate)} · {formatDate(String(u.created_at), { withTime: true })}</p></li>)}</ul>
        </section>
      )}
    </div>
  );
}
