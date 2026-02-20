// user story 10
//
// this page shows match and a timeline of events during the game
// it displays goals, points, cards, and status changes as they happen in real time
// the match clock updates every second and shows how long the game has been running
// all data comes from firestore and updates automatically when admins make changes in the admin console
//
// ui design reference: https://mui.com/material-ui/react-timeline/
// uses material ui timeline component api to display events for the live timeline
// timeline uses alternating layout - home team events appear on one side, away team events on the other side
//
// - app.jsx - routing
// - home.jsx - has view live timeline buttons that navigate to this page for each game
// - adminmatchconsole.jsx - creates the events that appear in this timeline when admins update scores, cards, or status
// - matchreporter.jsx - also reads the same events subcollection to show the timeline in the match report


// react hooks for managing state and side effects
import { useEffect, useState } from "react";
// react router hooks for reading url parameters and navigating between pages
import { useParams, useNavigate } from "react-router-dom";
// firebase database connection
import { db } from "../firebase";
// firestore functions for reading live data from the database
import {
  doc, // gets a single document reference
  onSnapshot, // listens for real-time updates to a document or collection
  collection, // gets a collection reference
  query, // builds a query to filter or sort data
  orderBy, // sorts the results by a field
} from "firebase/firestore";
// material ui timeline components - reference: https://mui.com/material-ui/react-timeline/
import Timeline from "@mui/lab/Timeline";
import TimelineItem from "@mui/lab/TimelineItem";
import TimelineSeparator from "@mui/lab/TimelineSeparator";
import TimelineConnector from "@mui/lab/TimelineConnector";
import TimelineContent from "@mui/lab/TimelineContent";
import TimelineOppositeContent from "@mui/lab/TimelineOppositeContent";
import TimelineDot from "@mui/lab/TimelineDot";

export default function FixtureTimeline() {
  // pulls the competition type, competition id, and fixture id from the url
  // this tells the page which game to load for the supporter
  const { competitionType, competitionId, fixtureId } = useParams();
  // function to navigate to different pages when buttons are clicked
  const navigate = useNavigate();

  // stores the live fixture data like teams, score, clock, and status for the game being viewed
  const [fixture, setFixture] = useState(null);
  // tracks whether we're still loading the fixture data from firestore
  const [loadingFixture, setLoadingFixture] = useState(true);
  // stores any error message if loading the fixture fails
  const [fixtureError, setFixtureError] = useState("");

  // stores the list of scoring events like goals, points, cards, and status changes
  const [events, setEvents] = useState([]);
  // tracks whether we're still loading the events from firestore
  const [loadingEvents, setLoadingEvents] = useState(true);
  // stores any error message if loading the events fails
  const [eventsError, setEventsError] = useState("");

  // shared now so we can show a live clock like on the home page
  // this value updates every second and is used to keep the match clock ticking on screen
  // pulled from home.jsx - same pattern used there for live clock updates
  const [now, setNow] = useState(Date.now());

  // tick now every second so clocks update without refreshing the page
  // pulled from home.jsx - same setInterval pattern used there
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // helper to format seconds as mm:ss for display
  // pulled from home.jsx - same function used there to format match clock times
  // takes a number of seconds and converts it to minutes:seconds format like 05:23
  function fmtClock(secs) {
    // if seconds is missing or negative, set it to zero
    if (!secs || secs < 0) secs = 0;
    // calculate how many full minutes
    const m = Math.floor(secs / 60);
    // calculate remaining seconds after removing minutes
    const s = secs % 60;
    // pad minutes with a zero if it's less than 10 (so 5 becomes 05)
    const mm = String(m).padStart(2, "0");
    // pad seconds with a zero if it's less than 10 (so 3 becomes 03)
    const ss = String(s).padStart(2, "0");
    // return formatted time like "05:23"
    return `${mm}:${ss}`;
  }

  // calculate live clock from fixture data
  // pulled from home.jsx - same function used there to calculate the current match clock time
  // starts from the stored seconds in firestore and adds any extra time since the clock started
  function getLiveClock(fx) {
    // if no fixture data, return zero time
    if (!fx) return "00:00";
    // start with the seconds stored in firestore
    let secs = fx.clockSeconds ?? 0;

    // if the clock is currently running, add the time that has passed since it started
    if (fx.clockRunning && fx.clockStartedAt) {
      // convert the start time to milliseconds (handles both firestore timestamps and regular dates)
      const startedMs = fx.clockStartedAt.toDate
        ? fx.clockStartedAt.toDate().getTime()
        : new Date(fx.clockStartedAt).getTime();
      // calculate how many seconds have passed since the clock started
      const extra = Math.floor((now - startedMs) / 1000);
      // add those extra seconds to the stored time
      if (extra > 0) secs += extra;
    }

    // format and return the final time
    return fmtClock(secs);
  }

  // subscribe to the fixture document for live updates
  // this keeps the score, status, and clock in sync with what the admin sees
  // runs whenever the url parameters change
  useEffect(() => {
    // check if we have all the required information from the url
    if (!competitionType || !competitionId || !fixtureId) {
      setFixtureError("Missing fixture information.");
      setLoadingFixture(false);
      return;
    }

    // build the path to the fixture in firestore based on competition type
    // championships go to Championship collection, leagues go to Leagues collection
    const collectionPath =
      competitionType === "championship"
        ? ["Championship", competitionId, "fixtures"]
        : ["Leagues", competitionId, "fixtures"];

    // get a reference to the specific fixture document
    const fixtureRef = doc(db, ...collectionPath, fixtureId);

    // listen for real-time updates to this fixture document
    const unsub = onSnapshot(
      fixtureRef,
      // this function runs whenever the fixture data changes in firestore
      (snap) => {
        // if the document exists, save its data to state
        if (snap.exists()) {
          setFixture({ id: snap.id, ...snap.data() });
          setFixtureError("");
        } else {
          // if document doesn't exist, clear fixture and show error
          setFixture(null);
          setFixtureError("Fixture not found.");
        }
        setLoadingFixture(false);
      },
      // runs if error
      (err) => {
        console.error("Failed to subscribe to fixture:", err);
        setFixtureError("Could not load fixture data.");
        setLoadingFixture(false);
      }
    );

    // stop listening when the component unmounts or url changes
    return () => unsub();
  }, [competitionType, competitionId, fixtureId]);

  // subscribe to scoring events subcollection for this fixture
  // this builds the live timeline by listening to all events saved under the game
  // runs whenever the url parameters change
  useEffect(() => {
    // check if we have all the required information from the url
    if (!competitionType || !competitionId || !fixtureId) {
      setEventsError("Missing fixture information.");
      setLoadingEvents(false);
      return;
    }

    // build the path to the events subcollection in firestore
    const collectionPath =
      competitionType === "championship"
        ? ["Championship", competitionId, "fixtures"]
        : ["Leagues", competitionId, "fixtures"];

    // reference: chatgpt conversation about building firestore paths with array spread and ordering
    // https://chatgpt.com/share/698cc3fb-e8c4-8004-9d27-b803ae0c4a2d
    // took code from this chat and implemneted it using my project info
    // get a reference to the events subcollection under this fixture
    const eventsCol = collection(db, ...collectionPath, fixtureId, "events");
    // create a query that sorts events by clockSeconds in ascending order
    // ordering by clockSeconds so the timeline flows in match time order
    const q = query(eventsCol, orderBy("clockSeconds", "asc"));

    // listen for real-time updates to the events collection
    const unsub = onSnapshot(
      q,
      // this function runs whenever events are added, updated, or removed
      (snap) => {
        // convert each event document to a plain object with its id
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // save all events to state so they appear in the timeline
        setEvents(list);
        setEventsError("");
        setLoadingEvents(false);
      },
      // error loading the events
      (err) => {
        console.error("Failed to subscribe to events:", err);
        setEventsError("Could not load events.");
        setLoadingEvents(false);
      }
    );

    // stop listening when the component unmounts or url changes
    return () => unsub();
  }, [competitionType, competitionId, fixtureId]);

  // default team names and scores so the page still works even if some fields are missing
  const homeName = fixture?.homeTeam || "Home";
  const awayName = fixture?.awayTeam || "Away";
  const homeGoals = fixture?.homeGoals ?? 0;
  const homePoints = fixture?.homePoints ?? 0;
  const awayGoals = fixture?.awayGoals ?? 0;
  const awayPoints = fixture?.awayPoints ?? 0;
  const status = fixture?.status || "upcoming";

  // main page layout 
  return (
    <div style={{ maxWidth: 900, margin: "2rem auto", padding: "1rem" }}>
      <header style={{ marginBottom: "1.5rem" }}>
        {/* simple back button so supporters can return to the home page */}
        <button onClick={() => navigate("/")} style={{ marginBottom: "1rem" }}>
          ← Back to Home
        </button>
        <h1 style={{ margin: 0 }}>Live Match Timeline</h1>
      </header>

      {/* fixture summary card - shows current score, status, and live match clock for this game */}
      <div
        style={{
          borderRadius: 8,
          background: "#ffffff",
          padding: "1rem 1.25rem",
          boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
          marginBottom: "1rem",
        }}
      >
        {/* reference: https://react.dev/learn/conditional-rendering - used react's conditional rendering with ternary operator to show different states (loading, error, not found, or fixture data) */}
        {loadingFixture ? (
          <p>Loading fixture…</p>
        ) : fixtureError ? (
          <p style={{ color: "red" }}>{fixtureError}</p>
        ) : !fixture ? (
          // message if fixture doesn't exist
          <p>Fixture not found.</p>
        ) : (
          <>
            {/* display team names and current score */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
                fontWeight: 700,
                fontSize: "1.1rem",
              }}
            >
              <span>{homeName}</span>
              <span>
                {homeGoals}:{homePoints} – {awayGoals}:{awayPoints}
              </span>
              <span>{awayName}</span>
            </div>

            {/* display match status and live clock */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                opacity: 0.85,
              }}
            >
              <span style={{ textTransform: "capitalize" }}>
                Status: {status}
              </span>
              <span>
                Match clock:{" "}
                <strong>{getLiveClock(fixture)}</strong>
              </span>
            </div>
          </>
        )}
      </div>

      {/* user story 14 - reference: https://chatgpt.com/share/698f5263-92fc-8004-bd06-d94790f01d1c (lines 295-336). I took code from this chat and used it for my project (made changes to suit also). Lineups displayed for supporters from fixture doc (admin entered them in match console). */}
      {/* Only show this section if the fixture has at least one team lineup. */}
      {fixture && ((Array.isArray(fixture.homeLineup) && fixture.homeLineup.length > 0) || (Array.isArray(fixture.awayLineup) && fixture.awayLineup.length > 0)) ? (
        <div
          style={{
            borderRadius: 8,
            background: "#ffffff",
            padding: "1rem 1.25rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
            marginBottom: "1rem",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Team Lineups</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            {/* If the home team has a lineup, show the team name and a numbered list of players. */}
            {Array.isArray(fixture.homeLineup) && fixture.homeLineup.length > 0 && (
              <div>
                <h4 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "0.95rem", fontWeight: 700 }}>
                  {homeName}
                </h4>
                <ol style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
                  {fixture.homeLineup.map((player, index) => (
                    <li key={index}>{player}</li>
                  ))}
                </ol>
              </div>
            )}
            {/* If the away team has a lineup, show the team name and a numbered list of players. */}
            {Array.isArray(fixture.awayLineup) && fixture.awayLineup.length > 0 && (
              <div>
                <h4 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "0.95rem", fontWeight: 700 }}>
                  {awayName}
                </h4>
                <ol style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
                  {fixture.awayLineup.map((player, index) => (
                    <li key={index}>{player}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* timeline panel */}
      <div
        style={{
          borderRadius: 8,
          background: "#ffffff",
          padding: "1rem 1.25rem",
          boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Timeline</h3>

        {/* reference: https://react.dev/learn/conditional-rendering - used react's conditional rendering to show different states (loading, error, empty, or events list) */}
        {loadingEvents && <p>Loading events…</p>}
        {eventsError && (
          <p style={{ color: "red", marginTop: 4 }}>{eventsError}</p>
        )}
        {!loadingEvents && !eventsError && events.length === 0 && (
          <p className="muted" style={{ margin: 0 }}>
            No scoring events recorded yet.
          </p>
        )}

        {!loadingEvents && !eventsError && events.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Timeline sx={{ maxWidth: "600px", width: "100%" }}>
              {/* each event from firestore becomes one row in the timeline */}
              {events.map((ev, index) => {
              // match clock time when this event happened (e.g. 06:23)
              const clock = fmtClock(ev.clockSeconds ?? 0);
              // used to show the right team name and to style opposite content
              const isHome = ev.team === "home";
              // score, card, or status - default to score for older data that might not have type
              const eventType = ev.type || "score";

              let mainText = "";
              let detailText = "";
              let oppositeContent = "";

              // build text for score events - who scored, which team, and score at that moment
              if (eventType === "score") {
                const typeLabel =
                  ev.scoreType === "goal"
                    ? "goal"
                    : ev.scoreType === "point"
                    ? "point"
                    : "score";
                mainText = `${ev.playerName || "Unknown player"} – ${typeLabel}`;
                oppositeContent = isHome ? homeName : awayName; // show team name on opposite side
                detailText =
                  ev.scoreLabel ||
                  `${homeName} ${ev.homeGoals ?? ""}-${ev.homePoints ?? ""} ${awayName} ${
                    ev.awayGoals ?? ""
                  }-${ev.awayPoints ?? ""}`;
              // build text for card events - red or yellow, which team, and card counts
              } else if (eventType === "card") {
                const cardWord =
                  ev.cardType === "red"
                    ? "Red card"
                    : ev.cardType === "yellow"
                    ? "Yellow card"
                    : "Card";
                const teamLabel = ev.team
                  ? ev.team === "home"
                    ? homeName
                    : ev.team === "away"
                    ? awayName
                    : ""
                  : "";
                mainText = cardWord;
                oppositeContent = teamLabel || ""; // show team name on opposite side
                detailText = `Cards: ${homeName} Y${ev.homeYellow ?? 0}/R${
                  ev.homeRed ?? 0
                } • ${awayName} Y${ev.awayYellow ?? 0}/R${ev.awayRed ?? 0}`;
              // build text for status events - e.g. half time, full time
              } else if (eventType === "status") {
                mainText = `Status changed to ${ev.status || ""}`;
                oppositeContent = clock; // show time on opposite side for status events
                detailText = "";
              // fallback for any other event type
              } else {
                mainText = "Match update";
                oppositeContent = "";
                detailText = "";
              }

              // dot color for this event - goals green, points blue, red card red, yellow card amber, status purple
              // reference: https://mui.com/material-ui/react-timeline/ - using TimelineDot color prop for different event types
              let dotColor = "grey";
              
              if (eventType === "score") {
                if (ev.scoreType === "goal") {
                  dotColor = "success"; // green for goals
                } else {
                  dotColor = "primary"; // blue for points
                }
              } else if (eventType === "card") {
                if (ev.cardType === "red") {
                  dotColor = "error"; // red for red cards
                } else if (ev.cardType === "yellow") {
                  // yellow is not a standard MUI color, so we'll use a custom color
                  dotColor = "warning"; // amber/yellow for yellow cards
                }
              } else if (eventType === "status") {
                dotColor = "secondary"; // purple for status changes
              }

              // determine which side to show content on based on team
              // home team events go on the right, away team events go on the left
              // status events alternate naturally
              const isHomeEvent = eventType !== "status" && isHome;
              const isAwayEvent = eventType !== "status" && !isHome && ev.team;

              // one timeline row per event - key helps react track which item changed
              return (
                <TimelineItem key={ev.id}>
                  {/* left side of the row - team name for scores/cards, or match time for status events */}
                  {oppositeContent && (
                    <TimelineOppositeContent
                      sx={{
                        flex: 0.2,
                        textAlign: "right",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: isHomeEvent || isAwayEvent ? "#1e293b" : "#64748b",
                          fontVariantNumeric: eventType === "status" ? "tabular-nums" : "normal",
                        }}
                      >
                        {oppositeContent}
                      </div>
                    </TimelineOppositeContent>
                  )}
                  {/* middle column - coloured dot and vertical line down to the next event */}
                  <TimelineSeparator>
                    <TimelineDot 
                      color={dotColor === "warning" ? undefined : dotColor}
                      sx={dotColor === "warning" ? { backgroundColor: "#f59e0b" } : {}}
                    />
                    {/* connector only between items, not after the last one */}
                    {index < events.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>
                  {/* right side of the row - match time, event text, and optional detail line */}
                  <TimelineContent>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", marginBottom: detailText ? "0.25rem" : 0 }}>
                      {/* match clock time when the event happened */}
                      <span
                        style={{
                          fontSize: "0.75rem",
                          color: "#64748b",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {clock}
                      </span>
                    
                      <span
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 600,
                          color: "#1e293b",
                        }}
                      >
                        {mainText}
                      </span>
                    </div>
                    {detailText && (
                      <div
                        style={{
                          fontSize: "0.8125rem",
                          color: "#64748b",
                        }}
                      >
                        {detailText}
                      </div>
                    )}
                  </TimelineContent>
                </TimelineItem>
              );
            })}
            </Timeline>
          </div>
        )}
      </div>
    </div>
  );
}

