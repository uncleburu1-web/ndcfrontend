/** /states — the 36 states and the FCT, with public counts (spec 12 §4.4). */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApi } from "../../auth/session";
import { useRequest } from "../../candidates/useRequest";
import { Banner, Button, Skeleton } from "../../components/ui";
import type { StateSummary } from "../../search/types";
import "../../search/search.css";

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export default function StatesPage() {
  const api = useApi();
  const res = useRequest("states", (signal) => api<{ results: StateSummary[] }>("/states/", { anonymous: true, signal }));
  useEffect(() => {
    document.title = "States | NDCConnect";
  }, []);
  return (
    <div className="states-page">
      <h1>States</h1>
      <p className="news-meta">Candidates, news and candidate posts for each state and the FCT.</p>
      {res.error ? (
        <Banner tone="error" action={<Button size="sm" variant="secondary" onClick={res.retry}>Try again</Button>}>{res.error.message}</Banner>
      ) : !res.data ? (
        <Skeleton width="100%" height={300} />
      ) : (
        <ul className="states-list">
          {res.data.results.map((s) => (
            <li key={s.state}>
              <Link to={`/states/${s.state}`}>
                <strong>{s.label}</strong>
                <span>{plural(s.candidates, "candidate", "candidates")} · {plural(s.news, "news story", "news stories")}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
