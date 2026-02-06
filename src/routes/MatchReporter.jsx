
// user story #11 - reporter side - to be worked on more for further iteration
// shows a match report page when someone clicks view match report
// reads all the match data from firestore (scores, cards, time, etc.)
// creates a  text summary of the game - more to be added for lineup
// displays it in a white box on the page


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
import { doc, getDoc } from "firebase/firestore";

export default function MatchReporter() {
  // gets the competition type, competition id, and fixture id from the url
  const { competitionType, competitionId, fixtureId } = useParams();
  
  // lets us navigate back to the home page
  const navigate = useNavigate();
  
  // stores the match data, loading status, and any errors
  const [fixture, setFixture] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
          setFixture({ id: snap.id, ...snap.data() });
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

  // user story #11 - takes all the match data and builds a text report
  // this function creates a readable summary of the game with scores, cards, and other details
  function generateReport(fx) {
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

  // generates the report text from the match data
  const report = generateReport(fixture);

  // displays the match report page with header and summary box
  return (
    <div style={{ maxWidth: 800, margin: "2rem auto", padding: "1rem" }}>
      <header style={{ marginBottom: "2rem" }}>
        <button onClick={() => navigate("/")} style={{ marginBottom: "1rem" }}>
          ← Back to Home
        </button>
        <h1>Match Report</h1>
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
