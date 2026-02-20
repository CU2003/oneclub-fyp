
// user story #11 - reporter side - to be worked on more for further iteration
// shows a match report page when someone clicks view match report
// reads all the match data from firestore (scores, cards, time, etc.)
// creates a  text summary of the game - more to be added for lineup
// displays it in a white box on the page
// uses the live events timeline that is created by the admin match console
// lets the reporter include the same time based events (scores, cards, status) in the written report that supporters see on the live timeine

// user story #18 - reporter side - show who verified the result and when so the journalist can cite it
// implemented in generateReport (verification block): appends "Result verified by: [name] on [date] at [time]" to the report
// adminmatchconsole.jsx writes verifiedBy and verifiedAt when an admin publishes; this file reads them and formats for the report

// home.jsx - has the view match report button that links to this page
// adminmatchconsole.jsx - has publish/unpublish buttons and view match report button
// app.jsx - creates a route for when someone visits the page

// reference: https://reactrouter.com/en/main/hooks/use-params
// lines 22-33 - used react router's useParams to read competition type, competition id, and fixture id from the url
// lines 22-33 - used useNavigate to create a button that takes users back to the home page

// reference: https://react.dev/reference/react/useState and https://react.dev/reference/react/useEffect
// lines 21-30 - used useState to store the fixture data, loading state, and error messages
// lines 34-70 - used useEffect to load the fixture data when the page loads or when the url parameters change

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db } from "../firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

export default function MatchReporter() {
  // gets the competition type, competition id, and fixture id from the url
  const { competitionType, competitionId, fixtureId } = useParams();
  
  // lets us navigate back to the home page
  const navigate = useNavigate();
  
  // stores the match data, loading status, and any errors
  const [fixture, setFixture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // stores the timeline events for this fixture for the reporter export
  const [events, setEvents] = useState([]);

  // user story #11 - loads the match data from firestore when the page loads
  // this gets all the game information (scores, cards, time, etc.) so we can show it in the report
  useEffect(() => {
    async function loadFixture() {
      // checks if we have all the required information from the url
      if (!competitionType || !competitionId || !fixtureId) {
        setError("Missing fixture information.");
        setLoading(false);
        return;
      }

      try {
        // figures out which firestore collection to look in based on competition type
        const collectionPath =
          competitionType === "championship"
            ? ["Championship", competitionId, "fixtures"]
            : ["Leagues", competitionId, "fixtures"];

        // creates a reference to the match document and reads it from firestore
        // built the collection path dynamically based on the competition type and id from the url
        // so the same page works for different competitions like munster championship or sigerson cup
        const fixtureRef = doc(db, ...collectionPath, fixtureId);
        const snap = await getDoc(fixtureRef);

        // saves the match data if it exists, otherwise shows an error
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          setFixture(data);

          // loads the events subcollection so the reporter export can include the live timeline
          // user story 10 - loads the events for this game so the report can show the live timeine
          // this pulls the same score, card and status events that the supporter timeline page uses
          const eventsCol = collection(db, ...collectionPath, fixtureId, "events");
          // order by clockseconds so the events are in match time order and dont jump around
          const q = query(eventsCol, orderBy("clockSeconds", "asc"));
          const eventsSnap = await getDocs(q);
          // turn the event documents into a plain list we can pass into the report builder
          const list = eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setEvents(list);
        } else {
          setError("Fixture not found.");
        }
      } catch (err) {
        // handles any errors that occur while loading
        console.error("Failed to load fixture:", err);
        setError("Could not load fixture data.");
      } finally {
        setLoading(false);
      }
    }

    loadFixture();
  }, [competitionType, competitionId, fixtureId]);

  // helper to format seconds as mm:ss for the timeline
  // user story 10 - used to show the match time beside each event in the report timeine
  // same style as the live clock on other pages so all the times match up even if they come from different screens
  function fmtClock(secs) {
    if (!secs || secs < 0) secs = 0;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  // user story #11 - takes all the match data and builds a text report
  // this function creates a readable summary of the game with scores, cards, lineups, and timeline
  function generateReport(fx, eventsList = []) {
    if (!fx) return "";

    // gets the scores for both teams, using 0 if they don't exist
    const homeGoals = fx.homeGoals ?? 0;
    const homePoints = fx.homePoints ?? 0;
    const awayGoals = fx.awayGoals ?? 0;
    const awayPoints = fx.awayPoints ?? 0;
    
    // calculates total points (goals worth 3 points each, regular points worth 1)
    const homeTotal = homeGoals * 3 + homePoints;
    const awayTotal = awayGoals * 3 + awayPoints;

    // gets the card counts for both teams, using 0 if they don't exist
    const homeYellow = fx.homeYellowCards ?? 0;
    const homeRed = fx.homeRedCards ?? 0;
    const awayYellow = fx.awayYellowCards ?? 0;
    const awayRed = fx.awayRedCards ?? 0;

    // reference: chatgpt - used for building the match report text string
    // lines 74-159 - got help with structuring the report, handling conditional sections, pluralization, date formatting, and combining sections
    // https://chatgpt.com/share/697cd305-6e58-8004-816f-c64996174535
    
    // reference: https://www.w3schools.com/jsref/jsref_tolocalestring.asp
    // lines 111-119 - formats the date into a readable string like "monday, january 28, 2026"
    // used javascripts toLocaleDateString method to format firestore timestamps into readable dates
    // first converted the firestore timestamp to a javascript date object using the toDate() method
    let dateStr = "";
    if (fx.date?.toDate) {
      const d = fx.date.toDate();
      dateStr = d.toLocaleDateString([], {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    // converts match duration from seconds to minutes
    let durationStr = "";
    if (fx.clockSeconds) {
      const minutes = Math.floor(fx.clockSeconds / 60);
      durationStr = `${minutes} minutes`;
    }

    // reference: https://chatgpt.com/share/698619f9-6afc-8004-896d-8903ffe7b76a
    // lines 132 - 175
    // used to grab code to assist me with determining the winner and building the match report text string
    // got help with calculating totals, winner logic, and structuring the report
    // determines the winner by comparing total points
    let winner = "";
    if (homeTotal > awayTotal) {
      winner = fx.homeTeam;
    } else if (awayTotal > homeTotal) {
      winner = fx.awayTeam;
    } else {
      winner = "Draw";
    }

    // builds the report text line by line
    let report = `Match Report\n\n`;
    report += `${fx.homeTeam} vs ${fx.awayTeam}\n`;
    if (dateStr) report += `${dateStr}\n`;
    if (fx.venue) report += `Venue: ${fx.venue}\n`;
    report += `\n`;

    report += `Final Score:\n`;
    report += `${fx.homeTeam}: ${homeGoals}-${homePoints} (${homeTotal} points)\n`;
    report += `${fx.awayTeam}: ${awayGoals}-${awayPoints} (${awayTotal} points)\n`;
    report += `\n`;

    report += `Result: ${winner} ${winner !== "Draw" ? "won" : ""}\n`;
    report += `\n`;

    // adds card information only if there were cards shown
    const totalCards = homeYellow + homeRed + awayYellow + awayRed;
    if (totalCards > 0) {
      report += `Discipline:\n`;
      report += `${fx.homeTeam}: ${homeYellow} yellow card${homeYellow !== 1 ? "s" : ""}, ${homeRed} red card${homeRed !== 1 ? "s" : ""}\n`;
      report += `${fx.awayTeam}: ${awayYellow} yellow card${awayYellow !== 1 ? "s" : ""}, ${awayRed} red card${awayRed !== 1 ? "s" : ""}\n`;
      report += `\n`;
    }

    // adds match duration if available
    if (durationStr) {
      report += `Match Duration: ${durationStr}\n`;
    }

    report += `\n`;
    report += `Match Status: ${fx.status || "Completed"}\n`;
    
    // user story 14 - reference: https://chatgpt.com/share/698f5263-92fc-8004-bd06-d94790f01d1c (lines 212-230)
    // I took code from this chat and used it for my project (made changes to suit also).
    // Lineups displayed in report from fixture doc. Get the list of players for each team from the fixture (the admin entered these in the match console).
    const homeLineup = fx.homeLineup;
    const awayLineup = fx.awayLineup;
    // If the home team has a lineup, add a heading and then each player on a new line with a number (1. 2. 3. etc).
    if (Array.isArray(homeLineup) && homeLineup.length > 0) {
      report += `\n`;
      report += `${fx.homeTeam} Lineup:\n`;
      homeLineup.forEach((player, index) => {
        report += `${index + 1}. ${player}\n`;
      });
    }
    // If the away team has a lineup, add a heading and then each player on a new line with a number (1. 2. 3. etc).
    if (Array.isArray(awayLineup) && awayLineup.length > 0) {
      report += `\n`;
      report += `${fx.awayTeam} Lineup:\n`;
      awayLineup.forEach((player, index) => {
        report += `${index + 1}. ${player}\n`;
      });
    }

    // reference: https://chatgpt.com/share/698de13f-d1ac-8004-a30b-4ed659c9d851
    // used chatgpt to loop over a list of events, format the clock time as mm:ss, and build different text for score, card and status events
    // i then changed the code to work with my own event fields like homegoals, homepoints, status and scorelabel, and to match the gaa wording i wanted in the report
    // adds live timeline if events are available
    // user story 10 - this loops over the saved events and turns them into readable lines for the report
    // it uses the same data as the supporter timeline so both views are telling the same storey about when things happend
    if (Array.isArray(eventsList) && eventsList.length > 0) {
      report += `\n`;
      report += `Timeline:\n`;

      eventsList.forEach((ev) => {
        const clock = fmtClock(ev.clockSeconds ?? 0);
        const isHome = ev.team === "home";
        const eventType = ev.type || "score"; // default old events to "score"

        let mainText = "";
        let detailText = "";

        if (eventType === "score") {
          const typeLabel =
            ev.scoreType === "goal"
              ? "goal"
              : ev.scoreType === "point"
              ? "point"
              : "score";
          const teamName = isHome ? fx.homeTeam : fx.awayTeam;
          mainText = `${ev.playerName || "Unknown player"} – ${typeLabel} for ${teamName}`;
          detailText =
            ev.scoreLabel ||
            `${fx.homeTeam} ${ev.homeGoals ?? ""}-${ev.homePoints ?? ""} ` +
              `${fx.awayTeam} ${ev.awayGoals ?? ""}-${ev.awayPoints ?? ""}`;
        } else if (eventType === "card") {
          const cardWord =
            ev.cardType === "red"
              ? "Red card"
              : ev.cardType === "yellow"
              ? "Yellow card"
              : "Card";
          const teamLabel = ev.team
            ? ev.team === "home"
              ? fx.homeTeam
              : ev.team === "away"
              ? fx.awayTeam
              : ""
            : "";
          mainText = teamLabel ? `${cardWord} for ${teamLabel}` : cardWord;
          detailText = `Cards: ${fx.homeTeam} Y${fx.homeYellowCards ?? 0}/R${
            fx.homeRedCards ?? 0
          } • ${fx.awayTeam} Y${fx.awayYellowCards ?? 0}/R${fx.awayRedCards ?? 0}`;
        } else if (eventType === "status") {
          mainText = `Status changed to ${ev.status || ""}`;
          detailText = "";
        } else {
          // fallback for unknown event types
          mainText = "Match update";
          detailText = "";
        }

        if (detailText) {
          report += `${clock} – ${mainText} (${detailText})\n`;
        } else {
          report += `${clock} – ${mainText}\n`;
        }
      });
    }

    // adds verification info if the match was verified by an admin
    // user story 18
    // reference: https://stackoverflow.com/questions/60056185/convert-firestore-timestamp-to-date-into-different-format
    // took the code from that post (toDate() then toLocaleDateString/toLocaleTimeString)
    // and adapted it for this project to format the verification timestamp for the report line
    if (fx.verifiedBy && fx.verifiedAt?.toDate) {
      try {
        // turn firestore timestamp into a javascript date so we can format it
        const verifiedDate = fx.verifiedAt.toDate();
        // full date e.g. monday, january 28, 2026
        const verifiedDateStr = verifiedDate.toLocaleDateString([], {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });
        // time e.g. 2:30 PM
        const verifiedTimeStr = verifiedDate.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        });
        report += `\n`;
        // line the journalist can cite in their write-up
        report += `Result verified by: ${fx.verifiedBy} on ${verifiedDateStr} at ${verifiedTimeStr}\n`;
      } catch (err) {
        // if date formatting fails, just show the verified by name
        report += `\n`;
        report += `Result verified by: ${fx.verifiedBy}\n`;
      }
    }

    return report;
  }

  // shows a loading message while fetching the match data
  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: "2rem auto", padding: "1rem" }}>
        <p>Loading match data...</p>
      </div>
    );
  }

  // shows an error message if something went wrong or the match wasn't found
  if (error || !fixture) {
    return (
      <div style={{ maxWidth: 800, margin: "2rem auto", padding: "1rem" }}>
        <p style={{ color: "red" }}>{error || "Fixture not found"}</p>
        <button onClick={() => navigate("/")}>Back to Home</button>
      </div>
    );
  }

  // generates the report text from the match data, including live timeline events
  const report = generateReport(fixture, events);

  // lets reporters export the match report (including timeline) as a .txt file
  function handleExport() {
    if (!fixture || !report) return;

    const homeName = fixture.homeTeam || "Home";
    const awayName = fixture.awayTeam || "Away";

    // try to include a simple date prefix in the filename if we have a date
    let datePart = "";
    if (fixture.date?.toDate) {
      try {
        const d = fixture.date.toDate();
        datePart = d.toISOString().slice(0, 10); // YYYY-MM-DD
      } catch {
        datePart = "";
      }
    }

    const safeHome = String(homeName).replace(/[^a-z0-9]+/gi, "-");
    const safeAway = String(awayName).replace(/[^a-z0-9]+/gi, "-");
    const baseName = `${safeHome}-vs-${safeAway}-report`;
    const filename = `${datePart ? `${datePart}-` : ""}${baseName}.txt`;

    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // displays the match report page with header, summary box, and export option
  return (
    <div style={{ maxWidth: 800, margin: "2rem auto", padding: "1rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <button onClick={() => navigate("/")} style={{ marginBottom: "1rem" }}>
          ← Back to Home
        </button>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <h1 style={{ margin: 0 }}>Match Report</h1>
          {fixture.published ? (
            <button
              type="button"
              onClick={handleExport}
              className="chip"
              style={{
                fontSize: "0.85rem",
                padding: "0.4rem 0.85rem",
                whiteSpace: "nowrap",
              }}
            >
              Export report (.txt)
            </button>
          ) : (
            <span
              style={{
                fontSize: "0.8rem",
                opacity: 0.75,
                textAlign: "right",
              }}
            >
              Match not published yet. Admin must publish before export.
            </span>
          )}
        </div>
      </header>

      <div
        style={{
          background: "#ffffff",
          padding: "1.5rem",
          borderRadius: "8px",
          border: "2px solid #1e40af",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "1rem", fontWeight: "bold" }}>Match Summary</h3>
        <pre
          style={{
            whiteSpace: "pre-wrap",
            fontFamily: "inherit",
            fontSize: "0.95rem",
            lineHeight: "1.6",
            margin: 0,
            fontWeight: "bold",
          }}
        >
          {report}
        </pre>
      </div>
    </div>
  );
}
