
import { useNavigate } from "react-router-dom"; // allows us to move between pages
import { useEffect, useState } from "react"; // react hooks for side affects and storing state
import { db } from "../firebase"; // connection for firestore
import { // firestore functions for reading live data
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
} from "firebase/firestore";
import { useAuth } from "../AuthContext.jsx";  // gives current logged in user

// images for news section - to be changed when reporter worked on - further iteration
import kilbrittainImg from "../assets/Kilbrittain.png";
import barryroeImg from "../assets/Barryroe.png";

export default function Home() {
  const nav = useNavigate(); // nav function to change page
  const { currentUser } = useAuth(); // currentUser from AuthContext

  const ADMIN_EMAILS = [ // list of email allowed to see admin button
    "kilbrittaingaa@oneclub.com",
    "ballygunnergaa@oneclub.com",
  ];
  const isAdmin = currentUser && ADMIN_EMAILS.includes(currentUser.email); // checks if email are allowed to access admin button

  // league fixtures
  const [pshNextFixture, setPshNextFixture] = useState(null); // next premier senior hurling fixture
  const [psfNextFixture, setPsfNextFixture] = useState(null); // next premier senior football fixture

  // all Munster fixtures for featured teams (Kilbrittain, Ballygunner)
  const [munsterFixtures, setMunsterFixtures] = useState([]);

  // shared "now" value so clocks can tick on screen
  const [now, setNow] = useState(Date.now());

  // only show munster fixtures that have one of these teams
  const FEATURED_MUNSTER_TEAMS = ["Kilbrittain", "Ballygunner"];

  // Grabbed this code from chatgpt - used to keep admin clock input and supporter views in sync
  // with the clock state.
  // https://chatgpt.com/share/69209f75-a680-8004-ba40-c34a911b6e4f Lines 46 - 49
  // tick "now" every second so the UI clock updates
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000); // creates timer taht runs every second
    return () => clearInterval(id); // cleanup so when component is removed stop timer
  }, []);

  //  Premier Senior Hurling next fixture
  useEffect(() => {
    const nowDate = new Date(); // current date and time
    const q = query( // firestore query
      collection(db, "Leagues", "premier-senior-hurling", "fixtures"), // looks in leagues - psh - fixtures
      where("date", ">=", nowDate), // only fixtures where date is before the now date
      orderBy("date", "asc"), // order by date
      limit(1) // limit to one result
    );
    const unsub = onSnapshot(q, (snap) => { // listens to live changes in firestore
      setPshNextFixture(snap.docs[0]?.data() ?? null); // if theres one doc use the first one, otherwise null
    });
    return () => unsub(); // stops listening when component unmounts
  }, []);

  // Premier Senior Football next fixture
  useEffect(() => {
    const nowDate = new Date(); // current date and time
    const q = query(
      collection(db, "Leagues", "premier-senior-football", "fixtures"), // looks in psh, fixtures
      where("date", ">=", nowDate), // where fixtures are before the now date
      orderBy("date", "asc"), // order by date
      limit(1) // limits to 1 result
    );
    const unsub = onSnapshot(q, (snap) => { // listens to live changes in firestore
      setPsfNextFixture(snap.docs[0]?.data() ?? null); // if theres one doc use the first one, otherwise null
    });
    return () => unsub();
  }, []);

  // loading Munster Championship fixtures
  useEffect(() => { // query for munster championship fixtures ordered by date
    const q = query(
      collection(db, "Championship", "munster-championship", "fixtures"),
      orderBy("date", "asc")
    );

    const unsub = onSnapshot(q, (snap) => { // listens to live collection
      // turns each firestore doc into a plain JS object with id + data
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // only keep fixtures where home or away is one of our featured teams
      const featured = all.filter(
        (fx) =>
          FEATURED_MUNSTER_TEAMS.includes(fx.homeTeam) ||
          FEATURED_MUNSTER_TEAMS.includes(fx.awayTeam)
      );

      setMunsterFixtures(featured); // save the filtered fixtures into state
    });

    return () => unsub(); // stops listening when the component is removed
  }, []);


  // Helper for formatting firestore timestamps into readable date/time strings
  // https://www.w3schools.com/jsref/jsref_tolocalestring.asp Lines 107-129 ~
  // turns firestore timestamp into readable date string
  const fmtDate = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString([], {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // format the seconds like mm:ss for clocks
  const fmtClock = (secs) => {
    if (!secs || secs < 0) secs = 0;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const FixtureCard = ({ fx }) => { // small component to show one league fixture card (home vs away, date, venue etc.)
    if (!fx) return <p className="muted">No fixtures yet…</p>; // no fixture - show it
    return ( // otherwise make a small card with both teams and match info
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: 8,
          alignItems: "center",
          padding: "10px 12px",
          borderRadius: 10,
          background: "var(--panel-subtle, #f8fafc)",
        }}
      >
        <div style={{ textAlign: "right", fontWeight: 600 }}>{fx.home}</div>

        <div style={{ textAlign: "center", fontSize: 12, opacity: 0.85 }}>
          <div>{fmtDate(fx.date)}</div>
          <div>{fx.venue}</div>
        </div>

        <div style={{ fontWeight: 600 }}>{fx.away}</div>

        <div
          style={{
            gridColumn: "1 / -1",
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
            fontSize: 12,
            opacity: 0.85,
          }}
        >
          <span>
            {fx.competition}
            {fx.round ? ` • ${fx.round}` : ""}
          </span>
          <span style={{ textTransform: "capitalize" }}>{fx.status}</span>
        </div>
      </div>
    );
  };

  // Layout and styling for these panels (flex columns, spacing and basic card-style blocks)
  // was inspired by W3Schools CSS Flexbox and layout examples.
  // Adapted to fit the OneClub home page design.
  // https://www.w3schools.com/css/css3_flexbox.asp + https://www.w3schools.com/css/css_website_layout.asp
  // Lines 181 - 470 ~
  // layout for home page

  return (
    <div className="layout">
      {/* left sidebar */}
      <aside className="left" aria-label="League selectors">
        <div className="card">
          <details className="select select-dropdown" open>  {/* hurling league drop down */}
            <summary aria-haspopup="listbox" aria-expanded="true">
              Hurling leagues ▾
            </summary>
            <ul className="menu" role="listbox" aria-label="Hurling leagues"> {/* navigates to Premiro senion hurling league page */}
              <li
                role="option"
                tabIndex={0}
                className="menu-item--active"
                onClick={() => nav("/league/premier-senior-hurling")}
              >
                Premier Senior Hurling
              </li>
              {/* not yet used - disabled atm until further documentation */}
              <li className="menu-item--disabled" aria-disabled="true">
                Senior A Hurling
              </li>
              <li className="menu-item--disabled" aria-disabled="true">
                Premier Intermediate Hurling
              </li>
              <li className="menu-item--disabled" aria-disabled="true">
                Intermediate A Hurling
              </li>
              <li className="menu-item--disabled" aria-disabled="true">
                Premier Junior Hurling
              </li>
            </ul>
          </details>

          <div style={{ height: 10 }} />

          {/* football leagues dropdown */}
          <details className="select select-dropdown" open>
            <summary aria-haspopup="listbox" aria-expanded="true">
              Football leagues ▾
            </summary>
            <ul className="menu" role="listbox" aria-label="Football leagues">
              {/* Navigates to premier senior football league */}
              <li
                role="option"
                tabIndex={0}
                className="menu-item--active"
                onClick={() => nav("/league/premier-senior-football")}
              >
                Premier Senior Football
              </li>
              <li className="menu-item--disabled" aria-disabled="true">
                Senior A Football
              </li>
              <li className="menu-item--disabled" aria-disabled="true">
                Premier Intermediate Football
              </li>
              <li className="menu-item--disabled" aria-disabled="true">
                Intermediate A Football
              </li>
              <li className="menu-item--disabled" aria-disabled="true">
                Premier Junior Football
              </li>
            </ul>
          </details>
        </div>
      </aside>

      {/* center column - fixtures and panels */}
      <section className="center" aria-label="Fixtures">
        <div className="toolbar"> {/* toolbar showing fixtures today and a filter button - to be worked on in further iterations  */}
          <details className="pill pill-active" style={{ position: "relative" }}>
            <summary
              style={{
                listStyle: "none",
                cursor: "pointer",
                userSelect: "none",
                outline: "none",
              }}
            >
              Today ▾
            </summary>
          </details>

          <div className="spacer" />
          <div className="chip-row" aria-label="Quick actions">
            {/* filter button - to be worked on further iterations - 3 */}
            <button className="chip" role="tab" aria-selected="false">
              Filter
            </button>
          </div>
        </div>

        {/* Munster Championship games panel */}
        <div className="panel">
          <div className="panel-head">Munster Championship</div>
          <div className="panel-body">
            {munsterFixtures.length === 0 && ( // if no munster matches show below
              <p className="muted">
                No Munster fixtures yet for Kilbrittain or Ballygunner…
              </p>
            )}

            {munsterFixtures.length > 0 && ( // if we have munster fixtures show them in a list
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {munsterFixtures.map((fx) => {
                  // cards defaulting to 0 if missing
                  const homeYC = fx.homeYellowCards ?? 0;
                  const homeRC = fx.homeRedCards ?? 0;
                  const awayYC = fx.awayYellowCards ?? 0;
                  const awayRC = fx.awayRedCards ?? 0;

                  // Live match clock gathered from chat gpt
                  // https://chatgpt.com/share/69209f75-a680-8004-ba40-c34a911b6e4f  Lines:288 - 296
                  // base seconds from Firestore
                  let secs =
                    typeof fx.clockSeconds === "number" ? fx.clockSeconds : 0;

                  // if running and we have a start timestamp, add the time since it started
                  if (fx.clockRunning && fx.clockStartedAt?.toDate) {
                    const startedMs = fx.clockStartedAt.toDate().getTime();
                    const extra = Math.floor((now - startedMs) / 1000);
                    if (extra > 0) secs += extra;
                  }

                  return (
                    <div
                      key={fx.id}
                      style={{
                        borderRadius: 10,
                        background: "var(--panel-subtle, #f8fafc)",
                        padding: "10px 12px",
                      }}
                    >
                      {/* top row - home team, combined score, away team */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                          fontWeight: 600,
                        }}
                      >
                        <span>{fx.homeTeam}</span>
                        <span>
                          {(fx.homeGoals ?? 0)}:{(fx.homePoints ?? 0)} –{" "}
                          {(fx.awayGoals ?? 0)}:{(fx.awayPoints ?? 0)}
                        </span>
                        <span>{fx.awayTeam}</span>
                      </div>

                      {/* card count for both teams */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          opacity: 0.85,
                          marginBottom: 4,
                        }}
                      >
                        <span>
                          Cards: Y{homeYC} / R{homeRC}
                        </span>
                        <span>
                          Cards: Y{awayYC} / R{awayRC}
                        </span>
                      </div>

                      {/* date + status */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          opacity: 0.85,
                          marginBottom: 4,
                        }}
                      >
                        <span>{fx.date ? fmtDate(fx.date) : ""}</span>
                        <span style={{ textTransform: "capitalize" }}>
                          {fx.status}
                        </span>
                      </div>

                      {/* live match clock */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: 12,
                          marginBottom: 4,
                        }}
                      >
                        <span>Match clock</span>
                        <span
                          style={{
                            fontWeight: 600,
                            fontVariantNumeric: "tabular-nums",
                            color: secs > 30 * 60 ? "red" : "inherit",
                          }}
                        >
                          {fmtClock(secs)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* admin button for logged in users to edit */}
                {isAdmin && (
                  <div style={{ textAlign: "right", marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => nav("/admin")}
                      style={{ fontSize: 12, padding: "4px 8px" }}
                    >
                      Admin: update games
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* League panel - premier senior football next fixture */}
        <div className="panel">
          <div className="panel-head">Premier Senior Hurling</div>
          <div className="panel-body">
            <FixtureCard fx={pshNextFixture} />
          </div>
        </div>

        {/* placeholder for future competitions - to be worked on further senior A, premier junior etc */}
        <div className="panel">
          <div className="panel-head">Premier Senior Football</div>
          <div className="panel-body">
            <FixtureCard fx={psfNextFixture} />
          </div>
        </div>

        <div className="panel">
          <div className="panel-head">Senior A</div>
          <div className="panel-body muted" />
        </div>

        <div className="panel">
          <div className="panel-head">Premier Junior</div>
          <div className="panel-body muted" />
        </div>
      </section>

      {/* placeholder - news stories - to be worked on when reporter features added in*/}
      <aside className="right" aria-label="News">
        <div className="card">
          <h2 className="card-title">News</h2>

          <article className="news" aria-label="Kilbrittain story">
            <img
              className="thumb"
              src={kilbrittainImg}
              alt="Kilbrittain crest"
              loading="lazy"
            />
            <div>
              <h3 className="news-title">
                Kilbrittain win the county after a hard-fought battle vs the
                Glen
              </h3>
              <p className="muted small">4d ago · OneClub</p>
            </div>
          </article>

          <article className="news" aria-label="Barryroe story">
            <img
              className="thumb"
              src={barryroeImg}
              alt="Barryroe players in action"
              loading="lazy"
            />
            <div>
              <h3 className="news-title">
                Charlie Kenny leads Barryroe to victory
              </h3>
              <p className="muted small">12h ago · OneClub</p>
            </div>
          </article>
        </div>
      </aside>
    </div>
  );
}
