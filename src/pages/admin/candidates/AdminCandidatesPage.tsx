/** /admin/candidates — every candidate record, any status (spec 03 §8.3). */
import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useApi } from "../../../auth/session";
import type { AdminCandidate, Paginated } from "../../../candidates/types";
import { useRequest } from "../../../candidates/useRequest";
import { Banner, Button, EmptyState, Pagination, Select, Skeleton, StatusBadge, TextField } from "../../../components/ui";
import { formatDate } from "../../../lib/format";
import { POSITIONS, STATES } from "../../../lib/nigeria";
import "./admin.css";
import { AdminNav } from "../AdminNav";
import { t } from "../../../i18n";

export default function AdminCandidatesPage() {
  const api = useApi();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const page = Math.max(1, Number(params.get("page") ?? 1) || 1);
  const qs = params.toString();

  useEffect(() => {
    document.title = t("admin.candidates-admin-ndcconnect");
  }, []);

  const { data, error, loading, retry } = useRequest(`admin-list?${qs}`, (signal) =>
    api<Paginated<AdminCandidate>>(`/admin/candidates/${qs ? `?${qs}` : ""}`, { signal })
  );

  const update = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    if (k !== "page") next.delete("page");
    setParams(next);
  };

  return (
    <div className="adm-page">
      <AdminNav current="candidates" />
      <header className="adm-page__head">
        <div>
          <h1>{t("admin.candidates")}</h1>
          <p className="adm-page__lead">{t("admin.only-verified-candidates-can-be-published")}</p>
        </div>
        <Button href="/admin/candidates/new">{t("admin.add-candidate")}</Button>
      </header>

      <form className="adm-filters" role="search" aria-label={t("admin.filter-candidates")} onSubmit={(e: FormEvent) => { e.preventDefault(); update("q", search.trim()); }}>
        <Select label={t("admin.status")} value={params.get("status") ?? ""} onChange={(e) => update("status", e.target.value)}
          options={[{ value: "", label: t("admin.any-status") }, { value: "draft", label: t("admin.draft") }, { value: "published", label: t("admin.published") },
            { value: "unpublished", label: t("admin.unpublished") }, { value: "archived", label: t("admin.archived") }]} />
        <Select label={t("admin.office")} value={params.get("position") ?? ""} onChange={(e) => update("position", e.target.value)}
          options={[{ value: "", label: t("admin.all-offices") }, ...POSITIONS.map((p) => ({ value: p.value, label: p.label }))]} />
        <Select label={t("admin.state")} value={params.get("state") ?? ""} onChange={(e) => update("state", e.target.value)}
          options={[{ value: "", label: t("admin.all-states") }, ...STATES]} />
        <div className="adm-filters__search">
          <TextField label={t("admin.search")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.name-area-or-slug")} />
          <Button type="submit" variant="secondary">{t("admin.search")}</Button>
        </div>
      </form>

      {error ? (
        <Banner tone="error" title={t("admin.we-couldn-t-load-candidates")} action={<Button variant="secondary" size="sm" onClick={retry}>{t("admin.try-again-2")}</Button>}>{error.message}</Banner>
      ) : loading && !data ? (
        <div aria-busy="true" className="adm-skeleton"><span className="visually-hidden">{t("admin.loading")}</span><Skeleton height={40} /><Skeleton height={40} /><Skeleton height={40} /></div>
      ) : data && data.results.length === 0 ? (
        <EmptyState title={t("admin.no-candidates-match")} action={<Button href="/admin/candidates/new">{t("admin.add-candidate")}</Button>}>{t("admin.change-the-filters-or-add-the")}</EmptyState>
      ) : data ? (
        <>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr><th scope="col">{t("admin.name")}</th><th scope="col">{t("admin.office")}</th><th scope="col">{t("admin.area")}</th><th scope="col">{t("admin.status")}</th><th scope="col">{t("admin.verification")}</th><th scope="col">{t("admin.updated-3")}</th></tr>
              </thead>
              <tbody>
                {data.results.map((c) => (
                  <tr key={c.id}>
                    <th scope="row"><Link to={`/admin/candidates/${c.id}`}>{c.full_name}</Link></th>
                    <td>{c.position_label}</td>
                    <td>{c.area_display}</td>
                    <td><StatusBadge set="candidate" status={c.status} /></td>
                    <td><StatusBadge set="verification" status={c.is_verified ? "verified" : "not_verified"} /></td>
                    <td>{formatDate(c.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={Math.ceil(data.count / 20)} onChange={(p) => update("page", p > 1 ? String(p) : "")} />
        </>
      ) : null}
    </div>
  );
}
