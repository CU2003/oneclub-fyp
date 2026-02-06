// file controls the main home page for oneclub
// responsible for displaying fixtures, live scores, match clock, and favourited content
// tbc - reporter further iteration
// score updates made by admins appear instantly for supporters
// live match clocks stay in sync across all devices
// favourite clubs and fixtures update without refreshing the page

// reference: https://firebase.google.com/docs/firestore/query-data/get-data
// used firestore's getDoc to read club documents from the database.
// loads club names from favourite club IDs so we can match them against team names and show upcoming games for clubs the user has favourited.


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
  doc, // used to load club info from firestore
  getDoc, // used to read the club doc
} from "firebase/firestore";
import { useAuth } from "../AuthContext.jsx";  // gives current logged in user

// images for news section - to be changed when reporter worked on - further iteration
import kilbrittainImg from "../assets/Kilbrittain.png";
import barryroeImg from "../assets/Barryroe.png";


export default function Home() {
  const nav = useNavigate(); // nav function to change page
  const { currentUser, userDoc } = useAuth(); // firebase Auth user + firestore user profile

  // checking if user is admin by reading their role from Firestore
  // the admin list lives in userService.js and gets saved to the database when they log in
  // no need to keep a copy of admin emails here - just check what's in the database
  const isAdmin = userDoc?.role === "admin";

  // league fixtures
  const [pshNextFixture, setPshNextFixture] = useState(null); // next premier senior hurling fixture
  const [psfNextFixture, setPsfNextFixture] = useState(null); // next premier senior football fixture

  // all Munster fixtures for featured teams (Kilbrittain, Ballygunner)
  const [munsterFixtures, setMunsterFixtures] = useState([]);
  // this is a box that stores all the sigerson cup games
  const [sigersonCupFixtures, setSigersonCupFixtures] = useState([]);

  // storing the clubs the user has favourited
  // pulling this from their profile in Firestore - it's an array of club IDs
  const favouriteClubIds = userDoc?.favouriteClubIds || []; // club IDs the user has favourited
  const [favouriteFixtures, setFavouriteFixtures] = useState([]); // fixtures for favourited clubs
  const [favLoading, setFavLoading] = useState(false); // loading state while being fetched

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

  // loading the next premier senior hurling fixture
  useEffect(() => {
    const nowDate = new Date();
    const q = query(
      collection(db, "Leagues", "premier-senior-hurling", "fixtures"),
      where("date", ">=", nowDate), // only future fixtures
      orderBy("date", "asc"),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => { // watching for updates in real-time
      setPshNextFixture(snap.docs[0]?.data() ?? null);
    });
    return () => unsub();
  }, []);

  // fetching the next premier senior football fixture
  useEffect(() => {
    const nowDate = new Date();
    const q = query(
      collection(db, "Leagues", "premier-senior-football", "fixtures"),
      where("date", ">=", nowDate),
      orderBy("date", "asc"),
      limit(1)
    );
    const unsub = onSnapshot(q, (snap) => { // receiving live updates from database
      setPsfNextFixture(snap.docs[0]?.data() ?? null);
    });
    return () => unsub();
  }, []);

  // getting munster championship fixtures for featured teams
  useEffect(() => {
    const q = query(
      collection(db, "Championship", "munster-championship", "fixtures"),
      orderBy("date", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      // keeping only games where kilbrittain or ballygunner are playing
      const filtered = all.filter((fx) =>
        FEATURED_MUNSTER_TEAMS.includes(fx.homeTeam) ||
        FEATURED_MUNSTER_TEAMS.includes(fx.awayTeam)
      );

      setMunsterFixtures(filtered);
    });

    return () => unsub();
  }, []);

  // user story #11 - load sigerson cup fixtures
  // this runs when the page loads
  // it gets all the sigerson cup games from firestore and watches for changes
  // if a new game is added or a score is updated, it automatically updates on the page
  useEffect(() => {
    // create a query to get all sigerson cup games, sorted by date
    const q = query(
      collection(db, "Championship", "sigerson-cup", "fixtures"),
      orderBy("date", "asc")
    );


    // whenever something changes (new game, score update, etc.), this runs
    const unsub = onSnapshot(q, (snap) => {
      // turn all the game documents into a list we can use
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // save the list of games so we can show them on the page
      setSigersonCupFixtures(all);
    });

    // stop watching when the page is closed or the user navigates away
    return () => unsub();
  }, []);

  // finding upcoming games for clubs the user likes
  // searches through Munster Championship, Premier Senior Hurling, and Premier Senior Football
  // only shows games where one of their favourite clubs is playing
  // updates automatically whenever scores change in the database
  useEffect(() => {
    if (!currentUser) {
      setFavouriteFixtures([]);
      return;
    }

    if (!favouriteClubIds || favouriteClubIds.length === 0) {
      setFavouriteFixtures([]);
      return;
    }

    setFavLoading(true);
    const nowDate = new Date();

    async function loadFavouriteFixtures() {
      try {
        // first, grab the actual club names from the database
        // favourites store IDs like "Kilbrittain_ID" but fixtures use names like "Kilbrittain"
        // gotta convert the IDs to names so we can find matching games
        const clubNames = [];
        const clubNameLower = []; // also store lowercase versions for flexible matching
        
        for (const clubId of favouriteClubIds.slice(0, 10)) {
          try {
            const clubRef = doc(db, "clubs", clubId);
            const clubSnap = await getDoc(clubRef);
            if (clubSnap.exists()) {
              const clubData = clubSnap.data();
              // matching the club name against the team names in fixtures
              if (clubData.name) {
                const fullName = clubData.name.trim();
                clubNames.push(fullName);
                clubNameLower.push(fullName.toLowerCase());
                
                // some clubs have long names but fixtures use short versions
                // like "University College Cork" in the database but "UCC" in fixtures
                // so we make a short version from the first letter of each word
                const words = fullName.split(/\s+/);
                if (words.length > 1) {
                  const abbreviation = words.map(w => w[0]).join("").toUpperCase();
                  // only add the short version if it's different and at least 2 letters
                  if (abbreviation.length >= 2 && abbreviation !== fullName.toUpperCase()) {
                    clubNames.push(abbreviation);
                    clubNameLower.push(abbreviation.toLowerCase());
                  }
                }
              }
            } else {
              console.warn(`Club document ${clubId} does not exist in Firestore`);
            }
          } catch (err) {
            console.warn(`Failed to load club ${clubId}:`, err);
          }
        }
        

        if (clubNames.length === 0) {
          setFavouriteFixtures([]);
          setFavLoading(false);
          return;
        }

        // now searching for fixtures across different competitions
        // checking multiple collections to catch all the games
        const unsubs = [];

        // looking through Munster Championship games
        const munsterQ = query(
          collection(db, "Championship", "munster-championship", "fixtures"),
          where("date", ">=", nowDate),
          orderBy("date", "asc")
        );
        const munsterUnsub = onSnapshot(munsterQ, (snap) => {
          const munsterFixtures = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((fx) => {
              const homeLower = (fx.homeTeam || "").toLowerCase().trim();
              const awayLower = (fx.awayTeam || "").toLowerCase().trim();
              // match by exact name or case-insensitive partial match
              return clubNames.includes(fx.homeTeam) || clubNames.includes(fx.awayTeam) ||
                     clubNameLower.some(name => homeLower.includes(name) || awayLower.includes(name));
            });
          
          // combining munster fixtures with fixtures from other competitions
          setFavouriteFixtures((prev) => {
            const combined = [...prev.filter((f) => !f.source || f.source !== "munster"), ...munsterFixtures.map((f) => ({ ...f, source: "munster" }))];
            // getting rid of any duplicate games and putting them in date order
            const unique = combined.filter((f, idx, arr) => 
              arr.findIndex((other) => other.id === f.id) === idx
            );
            return unique
              .sort((a, b) => {
                const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
                const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
                return dateA - dateB;
              })
              .slice(0, 15);
          });
          setFavLoading(false);
        });
        unsubs.push(munsterUnsub);

        // checking Premier Senior Hurling fixtures
        const pshQ = query(
          collection(db, "Leagues", "premier-senior-hurling", "fixtures"),
          where("date", ">=", nowDate),
          orderBy("date", "asc")
        );
        const pshUnsub = onSnapshot(pshQ, (snap) => {
          const pshFixtures = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((fx) => {
              const homeLower = (fx.homeTeam || "").toLowerCase().trim();
              const awayLower = (fx.awayTeam || "").toLowerCase().trim();
              // match by exact name or case-insensitive partial match
              return clubNames.includes(fx.homeTeam) || clubNames.includes(fx.awayTeam) ||
                     clubNameLower.some(name => homeLower.includes(name) || awayLower.includes(name));
            });
          
          // adding premier senior hurling fixtures to the mix
          setFavouriteFixtures((prev) => {
            const combined = [...prev.filter((f) => !f.source || f.source !== "psh"), ...pshFixtures.map((f) => ({ ...f, source: "psh" }))];
            const unique = combined.filter((f, idx, arr) => 
              arr.findIndex((other) => other.id === f.id) === idx
            );
            return unique
              .sort((a, b) => {
                const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
                const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
                return dateA - dateB;
              })
              .slice(0, 15);
          });
        });
        unsubs.push(pshUnsub);

        // scanning Premier Senior Football fixtures
        const psfQ = query(
          collection(db, "Leagues", "premier-senior-football", "fixtures"),
          where("date", ">=", nowDate),
          orderBy("date", "asc")
        );
        const psfUnsub = onSnapshot(psfQ, (snap) => {
          const psfFixtures = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((fx) => {
              const homeLower = (fx.homeTeam || "").toLowerCase().trim();
              const awayLower = (fx.awayTeam || "").toLowerCase().trim();
              // match by exact name or case-insensitive partial match
              return clubNames.includes(fx.homeTeam) || clubNames.includes(fx.awayTeam) ||
                     clubNameLower.some(name => homeLower.includes(name) || awayLower.includes(name));
            });
          
          // mixing in premier senior football fixtures
          setFavouriteFixtures((prev) => {
            const combined = [...prev.filter((f) => !f.source || f.source !== "psf"), ...psfFixtures.map((f) => ({ ...f, source: "psf" }))];
            const unique = combined.filter((f, idx, arr) => 
              arr.findIndex((other) => other.id === f.id) === idx
            );
            return unique
              .sort((a, b) => {
                const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
                const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
                return dateA - dateB;
              })
              .slice(0, 15);
          });
        });
        unsubs.push(psfUnsub);

        // reference: https://chatgpt.com/share/698654d0-163c-8004-8ed7-17dbebaba6ac
        // lines 324-373 - got help with querying multiple firestore collections and matching fixture team names to favourite club names
        // also got help with combining fixtures from different collections and removing duplicates
        // Took code directly from chat gpt also
        // checking sigerson cup fixtures
        const sigersonQ = query(
          collection(db, "Championship", "sigerson-cup", "fixtures"),
          where("date", ">=", nowDate),
          orderBy("date", "asc")
        );
        const sigersonUnsub = onSnapshot(sigersonQ, (snap) => {
          const allSigerson = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          
          const sigersonFixtures = allSigerson.filter((fx) => {
            const homeTeam = (fx.homeTeam || "").trim();
            const awayTeam = (fx.awayTeam || "").trim();
            const homeLower = homeTeam.toLowerCase();
            const awayLower = awayTeam.toLowerCase();
            
            // checking if this game matches any of the user's favourite clubs
            // we try a few different ways to match in case names are slightly different
            // first check if the team names match exactly (same capital letters)
            const exactMatch = clubNames.includes(homeTeam) || clubNames.includes(awayTeam);
            
            // then check if they match when we ignore capital letters
            const exactMatchLower = clubNameLower.includes(homeLower) || clubNameLower.includes(awayLower);
            
            // finally check if one name contains the other (like "University College Cork" contains "UCC")
            const partialMatch = clubNameLower.some(name => {
              return homeLower.includes(name) || awayLower.includes(name) ||
                     name.includes(homeLower) || name.includes(awayLower);
            });
            
            // if any of these match, show this game in the favourites section
            const matches = exactMatch || exactMatchLower || partialMatch;
            return matches;
          });
          
          // adding sigerson cup fixtures to the mix
          setFavouriteFixtures((prev) => {
            const combined = [...prev.filter((f) => !f.source || f.source !== "sigerson"), ...sigersonFixtures.map((f) => ({ ...f, source: "sigerson" }))];
            const unique = combined.filter((f, idx, arr) => 
              arr.findIndex((other) => other.id === f.id) === idx
            );
            return unique
              .sort((a, b) => {
                const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
                const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
                return dateA - dateB;
              })
              .slice(0, 15);
          });
        });
        unsubs.push(sigersonUnsub);

        // cleaning up - stop listening to database changes when done
        // important to unsubscribe so we don't keep listening after logout or when favourites change
        return () => {
          unsubs.forEach((unsub) => unsub());
        };
      } catch (err) {
        console.error("Failed to load favourite fixtures:", err);
        setFavouriteFixtures([]);
        setFavLoading(false);
        return () => {}; // Return empty cleanup on error
      }
    }

    let cleanupFn = () => {};
    loadFavouriteFixtures().then((fn) => {
      if (fn) cleanupFn = fn;
    });

    return () => {
      cleanupFn();
    };
  }, [currentUser, favouriteClubIds.join("|")]);

  // converting firestore timestamps into readable dates
  // reference: https://www.w3schools.com/jsref/jsref_tolocalestring.asp Lines 107-129 ~
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

  // user story 10 - calculate the current time on the match clock
  // takes the base seconds from the database and adds any extra time since the clock started
  // this makes sure the clock shows the right time even if the page hasn't refreshed
  const getLiveClock = (fx) => {
    if (!fx) return "00:00";
    let secs = fx.clockSeconds ?? 0;

    // if the clock is running, add the time that has passed since it started
    if (fx.clockRunning && fx.clockStartedAt) {
      const startedMs = fx.clockStartedAt.toDate
        ? fx.clockStartedAt.toDate().getTime()
        : new Date(fx.clockStartedAt).getTime();

      const extra = Math.floor((now - startedMs) / 1000);
      if (extra > 0) secs += extra;
    }

    return fmtClock(secs);
  };

  // if no fixtures return a message
  if (!munsterFixtures) return <p className="muted">No fixtures loaded...</p>;

  return (
    <div className="layout">
      {/* left sidebar */}
      <aside className="left" aria-label="League selectors">
        <div className="card">
          <details className="select select-dropdown" open> {/* hurling league drop down */}
            <summary aria-haspopup="listbox" aria-expanded="true">
              Hurling leagues ▾
            </summary>
            <ul className="menu" role="listbox" aria-label="Hurling leagues">
              <li
                role="option"
                tabIndex={0}
                className="menu-item--active"
                onClick={() => nav("/league/premier-senior-hurling")}
              >
                Premier Senior Hurling
              </li>
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

          <details className="select select-dropdown"> {/* football league drop down */}
            <summary aria-haspopup="listbox" aria-expanded="false">
              Football leagues ▾
            </summary>
            <ul className="menu" role="listbox" aria-label="Football leagues">
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

      {/* centre */}
      <section className="center" aria-label="Fixtures">
        {/* user story 7 - panel that lists games for clubs the user has favourited */}
        {/* this shows upcoming fixtures for any clubs the supporter has added to their favourites */}
        <div className="panel">
          <div className="panel-head">Favourites</div>
          <div className="panel-body">
            {!currentUser ? (
              <p className="muted">
                Log in to favourite a club and see upcoming fixtures here.
              </p>
            ) : favouriteClubIds.length === 0 ? (
              <p className="muted">
                No favourites yet. Go to a club page and tap ☆ Favourite.
              </p>
            ) : favLoading ? (
              <p className="muted">Loading your upcoming fixtures…</p>
            ) : favouriteFixtures.length === 0 ? (
              <p className="muted">
                No upcoming fixtures found for your favourites yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* rendering each game with team names, score, what competition it's in, when it's on, live timer, and card counts */}
                {favouriteFixtures.map((fx) => {
                  const homeGoals = fx.homeGoals ?? 0;
                  const homePoints = fx.homePoints ?? 0;
                  const awayGoals = fx.awayGoals ?? 0;
                  const awayPoints = fx.awayPoints ?? 0;
                  const hasScore = homeGoals > 0 || homePoints > 0 || awayGoals > 0 || awayPoints > 0;

                  return (
                    <div
                      key={fx.id}
                      style={{
                        borderRadius: 10,
                        background: "var(--panel-subtle, #f8fafc)",
                        padding: "10px 12px",
                      }}
                    >
                      {/* team names and scoreline in goals:points format */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 4,
                          fontWeight: 600,
                        }}
                      >
                        <span>{fx.homeTeam}</span>
                        {hasScore ? (
                          <span>
                            {homeGoals}:{homePoints} – {awayGoals}:{awayPoints}
                          </span>
                        ) : (
                          <span>vs</span>
                        )}
                        <span>{fx.awayTeam}</span>
                      </div>

                      {/* displaying what league or championship this match belongs to */}
                      {fx.source && (
                        <div
                          style={{
                            fontSize: 11,
                            opacity: 0.7,
                            marginBottom: 4,
                            textTransform: "uppercase",
                            fontWeight: 600,
                          }}
                        >
                          {fx.source === "munster" && "Munster Championship"}
                          {fx.source === "psh" && "Premier Senior Hurling"}
                          {fx.source === "psf" && "Premier Senior Football"}
                        </div>
                      )}

                      {/* match date/time and what stage the game is at */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          opacity: 0.85,
                          marginBottom: fx.clockRunning ? 4 : 0,
                        }}
                      >
                        <span>{fx.date ? fmtDate(fx.date) : ""}</span>
                        <span style={{ textTransform: "capitalize" }}>
                          {fx.status || "Upcoming"}
                        </span>
                      </div>

                      {/* reference: https://react.dev/learn/conditional-rendering */}
                      {/* line 604 - used react's conditional rendering to show or hide the match clock based on whether the match is published */}
                      {/* live timer that counts up during the match - refreshes each second - only show if not published */}
                      {/* user story #11 - only show the match clock if the game is not published */}
                      {/* if the game is published, hide the clock so users have to view the match report to see it */}
                      {!fx.published && fx.clockRunning && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 12,
                            opacity: 0.85,
                            marginTop: 4,
                            color: "var(--focus, #4ade80)",
                            fontWeight: 600,
                          }}
                        >
                          <span>Live</span>
                          <span>{getLiveClock(fx)}</span>
                        </div>
                      )}

                      {/* reference: https://react.dev/learn/conditional-rendering */}
                      {/* line 624 - used react's conditional rendering to show or hide card counts based on whether the match is published */}
                      {/* card counts for home and away teams - only shows if there are any cards and not published */}
                      {/* user story #11 - only show card counts if the game is not published */}
                      {/* if the game is published, hide the cards so users have to view the match report to see them */}
                      {!fx.published && (fx.homeYellowCards > 0 || fx.homeRedCards > 0 || fx.awayYellowCards > 0 || fx.awayRedCards > 0) && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 11,
                            opacity: 0.75,
                            marginTop: 4,
                          }}
                        >
                          <span>
                            Cards: Y{fx.homeYellowCards ?? 0} / R{fx.homeRedCards ?? 0}
                          </span>
                          <span>
                            Cards: Y{fx.awayYellowCards ?? 0} / R{fx.awayRedCards ?? 0}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
                  const homeGoals = fx.homeGoals ?? 0;
                  const homePoints = fx.homePoints ?? 0;
                  const awayGoals = fx.awayGoals ?? 0;
                  const awayPoints = fx.awayPoints ?? 0;

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
                          {homeGoals}:{homePoints} – {awayGoals}:{awayPoints}
                        </span>
                        <span>{fx.awayTeam}</span>
                      </div>

                      {/* reference: https://react.dev/learn/conditional-rendering */}
                      {/* line 700 - used react's conditional rendering to show or hide card counts based on whether the match is published */}
                      {/* card count for both teams - only show if not published */}
                      {!fx.published && (
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
                            Cards: Y{fx.homeYellowCards ?? 0} / R{fx.homeRedCards ?? 0}
                          </span>
                          <span>
                            Cards: Y{fx.awayYellowCards ?? 0} / R{fx.awayRedCards ?? 0}
                          </span>
                        </div>
                      )}

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

                      {/* reference: https://react.dev/learn/conditional-rendering */}
                      {/* line 734 - used react's conditional rendering to show or hide the match clock based on whether the match is published */}
                      {/* live match clock - only show if not published */}
                      {!fx.published && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 12,
                            opacity: 0.85,
                          }}
                        >
                          <span>Match clock</span>
                          <span>{getLiveClock(fx)}</span>
                        </div>
                      )}

                      {/* user story #11 - view report button for completed games */}
                      {/* when a game is finished, supporters can click this to see the full match report */}
                      {fx.status === "full time" && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button
                            className="chip"
                            onClick={() => nav(`/report/championship/munster-championship/${fx.id}`)}
                          >
                            View Match Report
                          </button>
                        </div>
                      )}

                      {/* admin button to update games */}
                      {isAdmin && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button
                            className="chip"
                            onClick={() => nav("/admin")}
                          >
                            Admin: update games
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* user story #11 - sigerson cup panel */}
        {/* this panel shows all the sigerson cup games (college football championship) */}
        {/* games are loaded from firestore and displayed here automatically */}
        <div className="panel">
            <div className="panel-head">Sigerson Cup</div>
            <div className="panel-body">
              {/* if there are no sigerson cup games yet, show a message */}
              {sigersonCupFixtures.length === 0 ? (
              <p className="muted">No Sigerson Cup fixtures yet...</p>
            ) : (
              /* if there are games, show them in a list */
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sigersonCupFixtures.map((fx) => {
                  const homeGoals = fx.homeGoals ?? 0;
                  const homePoints = fx.homePoints ?? 0;
                  const awayGoals = fx.awayGoals ?? 0;
                  const awayPoints = fx.awayPoints ?? 0;

                  return (
                    <div
                      key={fx.id}
                      style={{
                        borderRadius: 10,
                        background: "var(--panel-subtle, #f8fafc)",
                        padding: "10px 12px",
                      }}
                    >
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
                          {homeGoals}:{homePoints} – {awayGoals}:{awayPoints}
                        </span>
                        <span>{fx.awayTeam}</span>
                      </div>

                      {/* reference: https://react.dev/learn/conditional-rendering */}
                      {/* line 821 - used react's conditional rendering to show or hide card counts based on whether the match is published */}
                      {/* card count for both teams - only show if not published */}
                      {!fx.published && (
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
                            Cards: Y{fx.homeYellowCards ?? 0} / R{fx.homeRedCards ?? 0}
                          </span>
                          <span>
                            Cards: Y{fx.awayYellowCards ?? 0} / R{fx.awayRedCards ?? 0}
                          </span>
                        </div>
                      )}

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
                          {fx.status || "upcoming"}
                        </span>
                      </div>

                      {/* reference: https://react.dev/learn/conditional-rendering */}
                      {/* line 857 - used react's conditional rendering to show or hide the match clock based on whether the match is published */}
                      {/* live match clock - only show if not published */}
                      {!fx.published && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 12,
                            opacity: 0.85,
                          }}
                        >
                          <span>Match clock</span>
                          <span>{getLiveClock(fx)}</span>
                        </div>
                      )}

                      {/* view report button for completed games */}
                      {/* user story #11 - show a button to view the full match report when the game is finished */}
                      {/* this button takes the user to the match report page where they can see all the details */}
                      {fx.status === "full time" && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button
                            className="chip"
                            onClick={() => nav(`/report/championship/sigerson-cup/${fx.id}`)}
                          >
                            View Match Report
                          </button>
                        </div>
                      )}

                      {/* admin button to update games */}
                      {isAdmin && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button className="chip" onClick={() => nav("/admin")}>
                            Admin: update games
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>

        {/* premier senior hurling */}
        <div className="panel">
          <div className="panel-head">Premier Senior Hurling</div>
          <div className="panel-body">
            {!pshNextFixture ? (
              <p className="muted">No fixtures yet...</p>
            ) : (
              <div style={{ opacity: 0.8 }}>
                Next fixture: {pshNextFixture.homeTeam} vs {pshNextFixture.awayTeam}{" "}
                on {fmtDate(pshNextFixture.date)}
              </div>
            )}
          </div>
        </div>

        {/* Premier Senior Football */}
        <div className="panel">
          <div className="panel-head">Premier Senior Football</div>
          <div className="panel-body">
            {!psfNextFixture ? (
              <p className="muted">No fixtures yet...</p>
            ) : (
              <div style={{ opacity: 0.8 }}>
                Next fixture: {psfNextFixture.homeTeam} vs {psfNextFixture.awayTeam}{" "}
                on {fmtDate(psfNextFixture.date)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* right sidebar */}
      <aside className="right" aria-label="News">
        <div className="card">
          <h2 className="card-title">News</h2>

          <div className="news-item">
            <img src={kilbrittainImg} alt="Kilbrittain" className="news-img" />
            <div>
              <div className="news-title">
                Kilbrittain win the county after a hard-fought battle vs the Glen
              </div>
              <div className="news-meta">4d ago · OneClub</div>
            </div>
          </div>

          <div className="news-item">
            <img src={barryroeImg} alt="Barryroe" className="news-img" />
            <div>
              <div className="news-title">Charlie Kenny leads Barryroe to victory</div>
              <div className="news-meta">12h ago · OneClub</div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
