/**
 * Home page (interim, until the home-page unit has its own spec): what NDCConnect is, the main ways in, and the next
 * few events. Replaces the "NDCConnect is being built" placeholder. Public; nothing personal is shown.
 */
import { Link } from "react-router-dom";
import { UpcomingStrip } from "../events/UpcomingStrip";
import "./HomePage.css";
import { t } from "../i18n";

const WAYS_IN = [
  { to: "/candidates", get title() { return t("homePage.candidates"); }, get text() { return t("homePage.see-who-is-running-their-plans"); } },
  { to: "/news", get title() { return t("homePage.news"); }, get text() { return t("homePage.official-announcements-and-news-from-members"); } },
  { to: "/events", get title() { return t("homePage.events"); }, get text() { return t("homePage.rallies-town-halls-and-meetings-near"); } },
  { to: "/communities", get title() { return t("homePage.communities"); }, get text() { return t("homePage.talk-with-members-in-your-state"); } },
  { to: "/states", get title() { return t("homePage.states"); }, get text() { return t("homePage.candidates-events-and-news-for-each"); } },
  { to: "/join", get title() { return t("homePage.join-ndc"); }, get text() { return t("homePage.apply-for-party-membership"); } },
];

export default function HomePage() {
  return (
    <div className="page-shell home">
      <section className="home-hero" aria-labelledby="home-title">
        <h1 id="home-title">{t("homePage.politics-that-doesn-t-stop-after")}</h1>
        <p>{t("homePage.follow-candidates-hear-from-the-party")}</p>
        <div className="home-actions">
          <Link className="home-cta" to="/candidates">{t("homePage.find-candidates")}</Link>
          <Link className="home-cta home-cta--secondary" to="/events">{t("homePage.see-events")}</Link>
        </div>
      </section>

      <nav aria-label={t("homePage.ways-in")}>
        <ul className="home-ways">
          {WAYS_IN.map((w) => (
            <li key={w.to}>
              <Link to={w.to}>
                <span className="home-way-title">{w.title}</span>
                <span className="home-way-text">{w.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <UpcomingStrip query="" title={t("homePage.coming-up")} limit={3} more="/events" />
    </div>
  );
}
