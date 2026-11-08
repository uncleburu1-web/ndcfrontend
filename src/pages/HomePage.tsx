/**
 * Home page (interim, until the home-page unit has its own spec): what NDCConnect is, the main ways in, and the next
 * few events. Replaces the "NDCConnect is being built" placeholder. Public; nothing personal is shown.
 */
import { Link } from "react-router-dom";
import { UpcomingStrip } from "../events/UpcomingStrip";
import "./HomePage.css";

const WAYS_IN = [
  { to: "/candidates", title: "Candidates", text: "See who is running, their plans and their updates." },
  { to: "/news", title: "News", text: "Official announcements and news from members." },
  { to: "/events", title: "Events", text: "Rallies, town halls and meetings near you." },
  { to: "/communities", title: "Communities", text: "Talk with members in your state, LGA and ward." },
  { to: "/states", title: "States", text: "Candidates, events and news for each state." },
  { to: "/join", title: "Join NDC", text: "Apply for party membership." },
];

export default function HomePage() {
  return (
    <div className="page-shell home">
      <section className="home-hero" aria-labelledby="home-title">
        <h1 id="home-title">Politics that doesn’t stop after election day</h1>
        <p>Follow candidates, hear from the party, join your community and take part in campaigns, all in one place.</p>
        <div className="home-actions">
          <Link className="home-cta" to="/candidates">Find candidates</Link>
          <Link className="home-cta home-cta--secondary" to="/events">See events</Link>
        </div>
      </section>

      <nav aria-label="Ways in">
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

      <UpcomingStrip query="" title="Coming up" limit={3} more="/events" />
    </div>
  );
}
