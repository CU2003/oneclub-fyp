// file controls the main home page for oneclub
// responsible for displaying fixtures, live scores, match clock, and favourited content
// tbc - reporter further iteration
// score updates made by admins appear instantly for supporters
// live match clocks stay in sync across all devices
// favourite clubs and fixtures update without refreshing the page

// user story 10 
// this file shows live match clocks on the home page and provides "view live timeline" buttons that navigate to the detailed timeline page

// reference: https://firebase.google.com/docs/firestore/query-data/get-data
// used firestore's getDoc to read club documents from the database.
// loads club names from favourite club IDs so we can match them against team names and show upcoming games for clubs the user has favourited.


import { useNavigate, Link } from "react-router-dom"; // allows us to move between pages
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
import AdSidebar from "./AdSidebar.jsx"; // left sidebar ads/sponsors from firestore (selectable via advertisements collection)

export default function Home() {
  const nav = useNavigate(); // nav function to change page
  const { currentUser, userDoc } = useAuth(); // firebase Auth user + firestore user profile

  // checking if user is admin by reading their role from Firestore
  // the admin list lives in userService.js and gets saved to the database when they log in
  // no need to keep a copy of admin emails here - just check what's in the database
  const isAdmin = userDoc?.role === "admin";

  // league fixtures
  const [carberyJuniorAFixtures, setCarberyJuniorAFixtures] = useState([]); // all carbery junior a league fixtures (same style as munster/sigerson)
  const [redfmDiv6Fixtures, setRedfmDiv6Fixtures] = useState([]); // all redfm division 6 league fixtures

  // all Munster fixtures for featured team (Kilbrittain)
  const [munsterFixtures, setMunsterFixtures] = useState([]);
  // this is a box that stores all the sigerson cup games
  const [sigersonCupFixtures, setSigersonCupFixtures] = useState([]);

  // storing the clubs the user has favourited
  // pulling this from their profile in Firestore - it's an array of club IDs
  const favouriteClubIds = userDoc?.favouriteClubIds || []; // club IDs the user has favourited
  const [favouriteFixtures, setFavouriteFixtures] = useState([]); // fixtures for favourited clubs
  const [favLoading, setFavLoading] = useState(false); // loading state while being fetched

  // user story 10 - shared "now" value so clocks can tick on screen
  // this updates every second to keep the match clock displaying the current time
  const [now, setNow] = useState(Date.now());

  // iteration 6 - published reporter news (visible on home); list of reports to show in the right sidebar
  const [publishedNews, setPublishedNews] = useState([]);

  // only show munster fixtures for this featured team
  const FEATURED_MUNSTER_TEAMS = ["Kilbrittain"];

  // user story 10 - tick now every second so the UI clock updates
  // reference: https://chatgpt.com/share/69209f75-a680-8004-ba40-c34a911b6e4f 
  // grabbed this code from chatgpt - used to keep admin clock input and supporter views in sync with the clock state
  // creates a timer that runs every second and updates the "now" value
  // cleanup stops the timer when the component is removed
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // load all carbery junior a league fixtures (same pattern as sigerson cup / munster)
  useEffect(() => {
    const q = query(
      collection(db, "Leagues", "west-cork-junior-a", "fixtures"),
      orderBy("date", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setCarberyJuniorAFixtures(all);
    });
    return () => unsub();
  }, []);

  // load all redfm division 6 league fixtures (same pattern as other competitions)
  useEffect(() => {
    const q = query(
      collection(db, "Leagues", "redfm-division-6", "fixtures"),
      orderBy("date", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setRedfmDiv6Fixtures(all);
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

      // keeping only games where Kilbrittain are playing
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

  // reference: https://chatgpt.com/share/698654d0-163c-8004-8ed7-17dbebaba6ac
  // what i did: used this chatgpt example to help with flexible name matching for favourites and querying multiple firestore collections, then adapted it for my club ids, competitions, and combined fixtures list
  // finding upcoming games for clubs the user likes
  // searches through Munster Championship and Sigerson Cup (and Carbery Junior A is separate)
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

        // Carbery Junior A League (west-cork-junior-a) - so Kilbrittain etc. show in favourites
        // favourites section only shows upcoming games, same as munster and sigerson
        const wcJuniorAQ = query(
          collection(db, "Leagues", "west-cork-junior-a", "fixtures"),
          where("date", ">=", nowDate),
          orderBy("date", "asc")
        );
        const wcJuniorAUnsub = onSnapshot(wcJuniorAQ, (snap) => {
          const wcFixtures = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((fx) => {
              const homeLower = (fx.homeTeam || "").toLowerCase().trim();
              const awayLower = (fx.awayTeam || "").toLowerCase().trim();
              return (
                clubNames.includes(fx.homeTeam) ||
                clubNames.includes(fx.awayTeam) ||
                clubNameLower.some(
                  (name) =>
                    homeLower.includes(name) || awayLower.includes(name)
                )
              );
            });
          setFavouriteFixtures((prev) => {
            const combined = [
              ...prev.filter(
                (f) => !f.source || f.source !== "wc-junior-a"
              ),
              ...wcFixtures.map((f) => ({ ...f, source: "wc-junior-a" })),
            ];
            const unique = combined.filter(
              (f, idx, arr) =>
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
        unsubs.push(wcJuniorAUnsub);

        // redfm division 6 league - favourites section only shows upcoming games, same as others
        const redfmQ = query(
          collection(db, "Leagues", "redfm-division-6", "fixtures"),
          where("date", ">=", nowDate),
          orderBy("date", "asc")
        );
        const redfmUnsub = onSnapshot(redfmQ, (snap) => {
          const redfmFixtures = snap.docs
            .map((d) => ({ id: d.id, ...d.data() }))
            .filter((fx) => {
              const homeLower = (fx.homeTeam || "").toLowerCase().trim();
              const awayLower = (fx.awayTeam || "").toLowerCase().trim();
              return (
                clubNames.includes(fx.homeTeam) ||
                clubNames.includes(fx.awayTeam) ||
                clubNameLower.some(
                  (name) =>
                    homeLower.includes(name) || awayLower.includes(name)
                )
              );
            });
          setFavouriteFixtures((prev) => {
            const combined = [
              ...prev.filter(
                (f) => !f.source || f.source !== "redfm-div6"
              ),
              ...redfmFixtures.map((f) => ({ ...f, source: "redfm-div6" })),
            ];
            const unique = combined.filter(
              (f, idx, arr) =>
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
        unsubs.push(redfmUnsub);

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

  // iteration 6 - load published reporter reports from firestore (visibleOnHome true),
  // listen for updates so the list stays in sync.
  // reports stay visible on the home page until the reporter deletes them in the reporter dashboard.
  // note: not ordering by publishedAt here so we avoid needing a composite firestore index; simple visibility is enough.
  useEffect(() => {
    const q = query(
      collection(db, "news"),
      where("visibleOnHome", "==", true)
    );
    const unsub = onSnapshot(q, (snap) => {
      setPublishedNews(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  // converting firestore timestamps into readable dates
  // reference: https://www.w3schools.com/jsref/jsref_tolocalestring.asp lines 107-129 ~
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


  // iteration 6 - format timestamp as relative time for the news sidebar
  // reference: https://stackoverflow.com/questions/3177836/how-to-format-time-since-xxx-e-g-4-minutes-ago-similar-to-stack-exchange-sites
  // what i did: used the idea of comparing seconds since a date and returning human readable strings like just now or minutes ago,
  // then adapted it for firestore timestamps and short labels like m ago, h ago, d ago, and a short date fallback
  // took code from reference
  const relativeTime = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const secs = Math.floor((Date.now() - d.getTime()) / 1000);
    if (secs < 60) return "just now";
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
    if (secs < 2592000) return `${Math.floor(secs / 86400)}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };
  // user story 10 - format the seconds like mm:ss for clocks
  // takes a number of seconds and converts it to minutes:seconds format like 05:23
  // this function is also used in fixturetimeline.jsx
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
  // this function is also used in fixturetimeline.jsx
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

  // completed games (full time or published) are treated as past games
  // copied the same idea from earlier competitions: keep the home page focused on live and upcoming fixtures,
  // and use the club page results section to show past games and full time scores. this helper checks a fixture's status and published flag.
  const isCompleted = (fx) => {
    const raw = (fx.status || "").trim();
    const status = raw.toLowerCase().replace(/\s+/g, " "); // normalize spaces (e.g. "full  time", non-breaking space)
    const fullTimeVariants = ["full time", "fulltime", "ft", "full-time"];
    const isFullTime = fullTimeVariants.includes(status);
    const isPublished = fx.published === true || fx.published === "true";
    return isFullTime || isPublished;
  };
  // only show upcoming or live games on the home page;
  // completed or published games are hidden here and shown on the club page instead.
  const munsterShown = (munsterFixtures || []).filter((fx) => !isCompleted(fx));
  const sigersonShown = sigersonCupFixtures.filter((fx) => !isCompleted(fx));
  const carberyShown = (carberyJuniorAFixtures || []).filter((fx) => !isCompleted(fx));
  const redfmShown = (redfmDiv6Fixtures || []).filter((fx) => !isCompleted(fx));
  const favouritesShown = favouriteFixtures.filter((fx) => !isCompleted(fx));

  // if no fixtures return a message
  if (!munsterFixtures) return <p className="muted">No fixtures loaded...</p>;

  return (
    <div className="layout">
      {/* left sidebar - shows selected ads/sponsors from firestore "advertisements" collection */}
      <aside className="left" aria-label="Sponsors">
        <AdSidebar position="home-left" />
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
            ) : favouritesShown.length === 0 ? (
              <p className="muted">
                No upcoming fixtures found for your favourites yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* rendering each game with team names, score, what competition it's in, when it's on, live timer, and card counts */}
                {favouritesShown.map((fx) => {
                  const homeGoals = fx.homeGoals ?? 0;
                  const homePoints = fx.homePoints ?? 0;
                  const awayGoals = fx.awayGoals ?? 0;
                  const awayPoints = fx.awayPoints ?? 0;

                  // reads where the fixture comes from (for report/timeline links) and sets the right competition type and id
                  // this maps the fixture source to the correct competition type and id
                  // so the view live timeline button can open the correct live timeline page for that game
                  let compType = null;
                  let compId = null;
                  if (fx.source === "munster") {
                    compType = "championship";
                    compId = "munster-championship";
                  } else if (fx.source === "sigerson") {
                    compType = "championship";
                    compId = "sigerson-cup";
                  } else if (fx.source === "wc-junior-a") {
                    compType = "league";
                    compId = "west-cork-junior-a";
                  } else if (fx.source === "redfm-div6") {
                    compType = "league";
                    compId = "redfm-division-6";
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
                      {/* top row - home team, combined score, away team (same as Munster/Sigerson/Carbery) */}
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

                      {/* card count for both teams - only show if not published */}
                      {/* cards for both teams - only show if game is not published so supporters must open the report later to see cards */}
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
                      {/* match date and status (upcoming, live, full time) */}
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

                      {/* live match clock - only show if not published */}
                      {/* live match clock for carbery games - only show when not published */}
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

                      {/* view report button for completed & published games */}
                      {compType && compId && fx.published && (fx.status || "").toLowerCase().trim() === "full time" && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button
                            className="chip"
                            onClick={() => nav(`/report/${compType}/${compId}/${fx.id}`)}
                          >
                            View Match Report
                          </button>
                        </div>
                      )}

                      {/* button to open the live timeline page; label changes to "Show Match Timeline" once match is published (reporter feedback) */}
                      {compType && compId && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                          <button
                            className="chip"
                            onClick={() =>
                              nav(`/fixture/${compType}/${compId}/${fx.id}`)
                            }
                          >
                            {fx.published ? "Show Match Timeline" : "Show Live Match Updates"}
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
                            Admin: Update Games
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

        {/* Munster Championship games panel */}
        <div className="panel">
          <div className="panel-head">Munster Championship</div>
          <div className="panel-body">
            {munsterShown.length === 0 && ( // if no munster matches show below (full-time games hidden, shown on club page)
              <p className="muted">
                No Munster fixtures yet for Kilbrittain…
              </p>
            )}

            {munsterShown.length > 0 && ( // if we have munster fixtures show them in a list
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {munsterShown.map((fx) => {
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

                      {/* card count for both teams - only show if not published */}
                      {/* reference: https://react.dev/learn/conditional-rendering - used react's conditional rendering to show or hide card counts based on whether the match is published */}
                      {/* in simple english: if the munster game is not published, I show the yellow and red card totals; once it is published, this whole cards row is hidden */}
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

                      {/* user story 10 - live match clock - only show if not published */}
                      {/* reference: https://react.dev/learn/conditional-rendering - used react's conditional rendering to show or hide the match clock based on whether the match is published */}
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

                      {/* user story #11 - view report button for completed & published games */}
                      {/* when a game is finished and published, supporters can click this to see the full match report */}
                      {/* reference: https://react.dev/learn/conditional-rendering - used react's conditional rendering to show the view report button only when the game is published and finished */}
                      {/* when the carbery game is finished and published, supporters can click to view the full match report */}
                      {fx.published && fx.status === "full time" && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button
                            className="chip"
                            onClick={() => nav(`/report/championship/munster-championship/${fx.id}`)}
                          >
                            View Match Report
                          </button>
                        </div>
                      )}

                      {/* user story 10 - supporter button to open the live timeline page for this munster championship game */}
                      {/* supporter button to open the live timeline page for this carbery league game */}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                        <button
                          className="chip"
                          onClick={() =>
                            nav(`/fixture/championship/munster-championship/${fx.id}`)
                          }
                        >
                          {fx.published ? "Show Match Timeline" : "Show Live Match Updates"}
                        </button>
                      </div>

                      {/* admin button to update games */}
                      {/* admin button so admins can jump to the match console to update games */}
                      {isAdmin && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button
                            className="chip"
                            onClick={() => nav("/admin")}
                          >
                            Admin: Update Games
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
              {/* if there are no sigerson cup games yet (after hiding full-time/published), show a message */}
              {sigersonShown.length === 0 ? (
              <p className="muted">No Sigerson Cup fixtures yet...</p>
            ) : (
              /* if there are games, show them in a list (full-time/published shown on club page only) */
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {sigersonShown.map((fx) => {
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

                      {/* card count for both teams - only show if not published */}
                      {/* reference: https://react.dev/learn/conditional-rendering - used react's conditional rendering to show or hide card counts based on whether the match is published */}
                      {/* when the sigerson game is still live (not published), I show the card totals here; when it is published, React stops rendering this cards section */}
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

                      {/* user story 10 - live match clock - only show if not published */}
                      {/* reference: https://react.dev/learn/conditional-rendering - used react's conditional rendering to show or hide the match clock based on whether the match is published */}
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

                      {/* view report button for completed & published games */}
                      {/* user story #11 - show a button to view the full match report when the game is finished and published */}
                      {/* this button takes the user to the match report page where they can see all the details */}
                      {fx.published && fx.status === "full time" && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button
                            className="chip"
                            onClick={() => nav(`/report/championship/sigerson-cup/${fx.id}`)}
                          >
                            View Match Report
                          </button>
                        </div>
                      )}

                      {/* user story 10 - supporter live view button to open the match timeline page for this sigerson cup game */}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                        <button
                          className="chip"
                          onClick={() =>
                            nav(`/fixture/championship/sigerson-cup/${fx.id}`)
                          }
                        >
                          {fx.published ? "Show Match Timeline" : "Show Live Match Updates"}
                        </button>
                      </div>

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

        {/* carbery junior a league panel: same layout as munster championship / sigerson cup; shows score, cards and live clock when not published, view report when published, live timeline button, admin button */}
        <div className="panel">
          <div className="panel-head">Carbery Junior A League</div>
          <div className="panel-body">
            {carberyShown.length === 0 ? (
              <p className="muted">No Carbery Junior A League fixtures yet...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {carberyShown.map((fx) => {
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

                      {fx.published && fx.status === "full time" && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button
                            className="chip"
                            onClick={() => nav(`/report/league/west-cork-junior-a/${fx.id}`)}
                          >
                            View Match Report
                          </button>
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                        <button
                          className="chip"
                          onClick={() =>
                            nav(`/fixture/league/west-cork-junior-a/${fx.id}`)
                          }
                        >
                          {fx.published ? "Show Match Timeline" : "Show Live Match Updates"}
                        </button>
                      </div>

                      {isAdmin && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button className="chip" onClick={() => nav("/admin")}>
                            Admin: Update Games
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

        {/* redfm division 6 league panel: same layout as carbery; shows score, cards and live clock when not published, view report when published, live timeline button, admin button */}
        {/* copied the previous league panel code so redfm division 6 behaves the same as other competitions on the home page */}
        <div className="panel">
          <div className="panel-head">RedFM Division 6 League</div>
          <div className="panel-body">
            {redfmShown.length === 0 ? (
              <p className="muted">No RedFM Division 6 fixtures yet...</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {redfmShown.map((fx) => {
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

                      {fx.published && fx.status === "full time" && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                          <button
                            className="chip"
                            onClick={() => nav(`/report/league/redfm-division-6/${fx.id}`)}
                          >
                            View Match Report
                          </button>
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                        <button
                          className="chip"
                          onClick={() =>
                            nav(`/fixture/league/redfm-division-6/${fx.id}`)
                          }
                        >
                          {fx.published ? "Show Match Timeline" : "Show Live Match Updates"}
                        </button>

                        {isAdmin && (
                          <button
                            className="chip"
                            onClick={() => nav("/admin")}
                          >
                            Admin: Update Games
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* iteration 6 - right sidebar news card; shows published reporter reports from firestore,
      each link goes to full report page; empty message when no reports yet */}
      <aside className="right" aria-label="News">
        <div className="card">
          <h2 className="card-title">News</h2>
          {publishedNews.length === 0 ? (
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              No published reports yet. Reports from the Reporter dashboard appear here when published.
            </p>
          ) : (
            /* iteration 6 - list of links to news report pages; each shows title, relative time,
            author */
            publishedNews.map((item) => (
              <Link
                key={item.id}
                to={`/news/${item.id}`}
                className="news-item"
                style={{
                  display: "grid",
                  gridTemplateColumns: "64px 1fr",
                  gap: "10px",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: "1px solid #e2e8f0",
                  textDecoration: "none",
                  color: "inherit",
                  cursor: "pointer",
                }}
              >
                {/* iteration 6 - cover image if present, otherwise placeholder thumb; title, relative time, author shown next to it */}
                {item.coverImageUrl ? (
                  <img
                    src={item.coverImageUrl}
                    alt={item.title || "Report cover"}
                    style={{
                      width: 64,
                      height: 48,
                      borderRadius: 8,
                      objectFit: "cover",
                      border: "1px solid #e2e8f0",
                    }}
                  />
                ) : (
                  <div
                    className="thumb"
                    style={{ width: 64, height: 48, borderRadius: 8, background: "#f1f5f9", border: "1px solid #e2e8f0" }}
                    aria-hidden
                  />
                )}
                <div>
                  <div className="news-title">{item.title || "Untitled"}</div>
                  <div className="news-meta">
                    {relativeTime(item.publishedAt)}
                    {item.author ? ` · ${item.author}` : " · OneClub"}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
