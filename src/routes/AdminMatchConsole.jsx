// src/routes/AdminMatchConsole.jsx
// Google Firebase (2025), "Get data with Cloud Firestore" - https://firebase.google.com/docs/firestore/query-data/listen and
// "Listen to real-time updates with Cloud Firestore" - https://firebase.google.com/docs/firestore/query-data/listen documentation.
// Used as a guide for using collection(), query(), getDocs(), onSnapshot() and updateDoc()
// in the admin match console. - Iteration 2


// the main admin control panel for live matches.
// admins can
// choose a game to update
// start/stop/reset the match clock
// update goals, points, cards for both teams
// update the match status - FH, SH, FT
// Changes are saved to Firestore and displayed on the home page.

import React, { useEffect, useState } from "react";
import { useAuth } from "../AuthContext.jsx"; // useauth gives the current logged in user from authcontext
import { auth, db } from "../firebase"; // auth used for loggin out, db lets us talk to firestore
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp, // Stores time when clock is started
} from "firebase/firestore";

// Map admin emails to the club name they are allowed to update - only allowed to update for their club
const ADMIN_CLUBS = {
  "kilbrittaingaa@oneclub.com": "Kilbrittain",
  "ballygunnergaa@oneclub.com": "Ballygunner",
};

function AdminMatchConsole() {
  // currentuser is logged in admin
  const { currentUser } = useAuth();

  const [fixtures, setFixtures] = useState([]); // list of fixtures admin can see
  const [loadingFixtures, setLoadingFixtures] = useState(true); // loading message flag for users
  const [fixturesError, setFixturesError] = useState(""); // error message if fixture fails to load

  const [selectedFixtureId, setSelectedFixtureId] = useState(""); // id of the fixture the admin clicks
  const [selectedFixture, setSelectedFixture] = useState(null); // data from selected fixture from firestore

  const [actionError, setActionError] = useState(""); // error for actions like updating score, cards etc.

  const [elapsedSeconds, setElapsedSeconds] = useState(0); // number of seconds match clock has been running
  const [isClockRunning, setIsClockRunning] = useState(false); // truw or false for is clock is still running for game

  const handleLogout = () => { // when admin clicks logout, signs them out of FB auth
    auth.signOut();
  };

  // works out which club this admin is allowed to manage based off their email - if none, returns null
  const clubName = currentUser
    ? ADMIN_CLUBS[currentUser.email] ?? null
    : null;

  // Google Firebase (2025), "Get data with Cloud Firestore" - https://firebase.google.com/docs/firestore/query-data/listen
  // Lines 64-110 ~
  // used this to assist with the chaging of championship/fixtures path and filter by the admin's club
  // Iteration 2
  // Load fixtures that this admin is allowed to see
  useEffect(() => {
    async function loadFixtures() {
      setLoadingFixtures(true);
      setFixturesError("");

      // Firestore query to get Munster Championship fixtures ordered by date
      try {
        const q = query(
          collection(
            db,
            "Championship",
            "munster-championship",
            "fixtures"
          ),
          orderBy("date", "asc")
        );

        // runs query once and gets all matching documents
        const snap = await getDocs(q);
        // turns each firestore document into a plain JS object with an id
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // If this admin is tied to a club, only show games where that club is home or away, if no clubname show all fixtures
        const filtered =
          clubName
            ? all.filter(
                (f) =>
                  f.homeTeam === clubName || f.awayTeam === clubName
              )
            : all;

        setFixtures(filtered);
      } catch (err) {
        // if anything goes wrong, log error and show frienldy message
        // Crucial for testing - itertaion 3
        console.error(err);
        setFixturesError("Could not load fixtures for admin console.");
      } finally {
        setLoadingFixtures(false);
      }
    }

    // calls inner function
    loadFixtures();
  }, [clubName]); // reruns if clubname changes for different admin

  // Subscribe to currently selected fixture
  useEffect(() => {
    // if no fixture selected, clears everythign and clock stops
    if (!selectedFixtureId) {
      setSelectedFixture(null);
      setElapsedSeconds(0);
      setIsClockRunning(false);
      return;
    }

    // reference to fiture doc in firestore
    const fixtureRef = doc(
      db,
      "Championship",
      "munster-championship",
      "fixtures",
      selectedFixtureId
    );

    // onsnapshot listens to live changes in firestore - runs everytime fixture is updated
    const unsubscribe = onSnapshot(fixtureRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();

        // Used ChatGPT to help generate code that would allow the clock to show for both the adminmatchconsole
        // and the home page for supporters. https://chatgpt.com/share/69209f75-a680-8004-ba40-c34a911b6e4f
        // lines 140 - 179 ~
        // base seconds stored in Firestore
        const base =
          typeof data.clockSeconds === "number" ? data.clockSeconds : 0;

        let total = base;

        // if running and we have a start timestamp, add time since it started
        if (data.clockRunning && data.clockStartedAt?.toDate) {
          const startedMs = data.clockStartedAt.toDate().getTime();
          const extra = Math.floor((Date.now() - startedMs) / 1000);
          if (extra > 0) total += extra;
        }

        // saves latest fixture data and clock info into state
        setSelectedFixture({ id: snap.id, ...data });
        setElapsedSeconds(total);
        setIsClockRunning(!!data.clockRunning);
      } else {
        // if documnet no longer exists, clear everything
        setSelectedFixture(null);
        setElapsedSeconds(0);
        setIsClockRunning(false);
      }
    });

    // when changing fixture or leaving page, stop listening
    return () => unsubscribe();
  }, [selectedFixtureId]);

  // Local ticking for the clock in admin view (UI only – no Firestore writes)
  useEffect(() => {
    if (!isClockRunning) return;

    // creates interval that adds 1 second every second
    const id = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    // stops interval when the clock stops
    return () => clearInterval(id);
  }, [isClockRunning]);

  //  SCORE HELPERS (goals & points) - ensures there are always numbers, even if firestore field missing
  function getScores() {
    const homeGoals =
      typeof selectedFixture?.homeGoals === "number"
        ? selectedFixture.homeGoals
        : 0;
    const homePoints =
      typeof selectedFixture?.homePoints === "number"
        ? selectedFixture.homePoints
        : 0;
    const awayGoals =
      typeof selectedFixture?.awayGoals === "number"
        ? selectedFixture.awayGoals
        : 0;
    const awayPoints =
      typeof selectedFixture?.awayPoints === "number"
        ? selectedFixture.awayPoints
        : 0;

    return { homeGoals, homePoints, awayGoals, awayPoints };
  }

  // https://www.w3schools.com/JS//js_typeof.asp
  // Lines 206-228
  // Read through these then made my own version to make usre missing Firestore fields dont
  // break my display and avoids not a number
  // CARD HELPERS (yellow/red) - awlays a number if, even if firestore field missing
  function getCards() {
    const homeYellow =
      typeof selectedFixture?.homeYellowCards === "number"
        ? selectedFixture.homeYellowCards
        : 0;
    const homeRed =
      typeof selectedFixture?.homeRedCards === "number"
        ? selectedFixture.homeRedCards
        : 0;
    const awayYellow =
      typeof selectedFixture?.awayYellowCards === "number"
        ? selectedFixture.awayYellowCards
        : 0;
    const awayRed =
      typeof selectedFixture?.awayRedCards === "number"
        ? selectedFixture.awayRedCards
        : 0;

    return { homeYellow, homeRed, awayYellow, awayRed };
  }

  // updates the score in firestore
  // team for home and away team
  // scoretype for goal or point
  // delta for +1 or -1
  async function changeScore(team, scoreType, delta) {
    if (!selectedFixtureId || !selectedFixture) return; // no fixture slected - do nothing
    setActionError("");

    // gets current score from helper
    let { homeGoals, homePoints, awayGoals, awayPoints } = getScores();

    // decides which value to change based on team and score type
    if (team === "home") {
      if (scoreType === "goal") {
        // never below 0
        homeGoals = Math.max(0, homeGoals + delta);
      } else {
        homePoints = Math.max(0, homePoints + delta);
      }
    } else {
      if (scoreType === "goal") {
        awayGoals = Math.max(0, awayGoals + delta);
      } else {
        awayPoints = Math.max(0, awayPoints + delta);
      }
    }

    try {
      // reference to this fixture in firestore
      const fixtureRef = doc(
        db,
        "Championship",
        "munster-championship",
        "fixtures",
        selectedFixtureId
      );
      // save updated scores to firestore
      await updateDoc(fixtureRef, {
        homeGoals,
        homePoints,
        awayGoals,
        awayPoints,
      });
    } catch (err) {
      console.error(err);
      setActionError("Could not update score.");
    }
  }

  // updates cards in firestore
  async function changeCards(team, cardType, delta) {
    if (!selectedFixtureId || !selectedFixture) return;
    setActionError("");

    // gets current cards count from helper
    let { homeYellow, homeRed, awayYellow, awayRed } = getCards();

    // decide which counter to change
    if (team === "home") {
      if (cardType === "yellow") {
        homeYellow = Math.max(0, homeYellow + delta);
      } else {
        homeRed = Math.max(0, homeRed + delta);
      }
    } else {
      if (cardType === "yellow") {
        awayYellow = Math.max(0, awayYellow + delta);
      } else {
        awayRed = Math.max(0, awayRed + delta);
      }
    }

    try {
      const fixtureRef = doc(
        db,
        "Championship",
        "munster-championship",
        "fixtures",
        selectedFixtureId
      );
      // saves updated cards counts to firestore
      await updateDoc(fixtureRef, {
        homeYellowCards: homeYellow,
        homeRedCards: homeRed,
        awayYellowCards: awayYellow,
        awayRedCards: awayRed,
      });
    } catch (err) {
      console.error(err);
      setActionError("Could not update cards.");
    }
  }

  // update the match status - FH, FT etc.
  async function changeStatus(status) {
    if (!selectedFixtureId) return;
    setActionError("");

    try {
      const fixtureRef = doc(
        db,
        "Championship",
        "munster-championship",
        "fixtures",
        selectedFixtureId
      );
      // save the new status e.g. half time
      await updateDoc(fixtureRef, { status });
    } catch (err) {
      console.error(err);
      setActionError("Could not update status.");
    }
  }

  // Used ChatGPT to assist with the stop/start/reset behvaiour for the match clock
  // https://chatgpt.com/share/69209f75-a680-8004-ba40-c34a911b6e4f lines: 343 - 423 ~
  // I adapted the pattern to align with the fixture schema
  // formats clock as minutes:seconds for display
  function formatClock(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  // start the clock for fixture
  async function startClock() {
    if (!selectedFixtureId) return;
    // marks clock run in local state
    setIsClockRunning(true);

    const fixtureRef = doc(
      db,
      "Championship",
      "munster-championship",
      "fixtures",
      selectedFixtureId
    );

    // in firestore:
    // clockrunning goes to true and stores exact server time the clock started - clockStartedAt
    await updateDoc(fixtureRef, {
      clockRunning: true,
      clockStartedAt: serverTimestamp(),
    }).catch(console.error);
  }

  // stops clock for fixture
  async function stopClock() {
    if (!selectedFixtureId) return;
    // stops local ticking
    setIsClockRunning(false);

    const fixtureRef = doc(
      db,
      "Championship",
      "munster-championship",
      "fixtures",
      selectedFixtureId
    );

    // save the total elapsed time and clear the start time
    await updateDoc(fixtureRef, {
      clockRunning: false,
      clockSeconds: elapsedSeconds,
      clockStartedAt: null,
    }).catch(console.error);
  }

  // resets clock back to 0 for this fixture
  async function resetClock() {
    if (!selectedFixtureId) return;
    setIsClockRunning(false);
    setElapsedSeconds(0);

    const fixtureRef = doc(
      db,
      "Championship",
      "munster-championship",
      "fixtures",
      selectedFixtureId
    );
    // resets firestore clock fields
    await updateDoc(fixtureRef, {
      clockRunning: false,
      clockSeconds: 0,
      clockStartedAt: null,
    }).catch(console.error);
  }

  // Back to list button handler
  // clears the selected game and retunrs to list of fixtures
  function closeCurrentGame() {
    setSelectedFixtureId("");
    setSelectedFixture(null);
    setElapsedSeconds(0);
    setIsClockRunning(false);
    setActionError("");
  }

  // formats one fixture as home vs away and date
  function formatFixtureRow(fix) {
    const home = fix.homeTeam || "Home";
    const away = fix.awayTeam || "Away";

    let dateText = "";
    if (fix.date?.toDate) {
      const d = fix.date.toDate();
      dateText = d.toLocaleString();
    }

    return `${home} vs ${away}${dateText ? " – " + dateText : ""}`;
  }

  const { homeGoals, homePoints, awayGoals, awayPoints } = getScores();
  const homeScoreLabel = `${homeGoals}:${homePoints}`;
  const awayScoreLabel = `${awayGoals}:${awayPoints}`;

  const { homeYellow, homeRed, awayYellow, awayRed } = getCards();

  const homeName = selectedFixture?.homeTeam || "Home";
  const awayName = selectedFixture?.awayTeam || "Away";
  const clockIsOver30 = elapsedSeconds > 30 * 60;

  return (
    <div style={{ maxWidth: 900, margin: "2rem auto" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h2>Admin Match Console</h2>
        <div>
          {/* Show which email is logged in */}
          <span style={{ marginRight: "1rem" }}>
            Logged in as: {currentUser?.email}
          </span>
          {/* Logout button */}
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* Choose game to update */}
      <section style={{ marginBottom: "2rem" }}>
        <h3>1. Choose a Munster game to update</h3>

        {/* Show loading, error, or list of fixtures */}
        {loadingFixtures && <p>Loading fixtures…</p>}
        {fixturesError && <p style={{ color: "red" }}>{fixturesError}</p>}

        {/* No fixtures found for this admin */}
        {!loadingFixtures && fixtures.length === 0 && !fixturesError && (
          <p>
            No fixtures found for{" "}
            <strong>{clubName ?? "this admin"}</strong> in Munster Championship.
          </p>
        )}

        {/* Show fixtures list when we have some */}
        {!loadingFixtures && fixtures.length > 0 && (
          <div
            style={{
              borderRadius: "8px",
              background: "#ffffff",
              padding: "1rem",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            }}
          >
            {fixtures.map((fix) => (
              <div
                key={fix.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0.5rem 0",
                  borderBottom: "1px solid #eee",
                }}
              >
                {/* Text summary of the game */}
                <span>{formatFixtureRow(fix)}</span>
                {/* Button to open this match in the console */}
                <button
                  onClick={() => setSelectedFixtureId(fix.id)}
                  style={{ marginLeft: "1rem" }}
                >
                  {selectedFixtureId === fix.id ? "Viewing" : "Open match"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Updates the selected match */}
      <section>
        <h3>2. Update match</h3>

        {/* If no match is selected yet, show help text */}
        {!selectedFixture && <p>Click “Open match” on a game above.</p>}

        {/* Once a match is selected, show all controls */}
        {selectedFixture && (
          <div
            style={{
              borderRadius: "8px",
              background: "#ffffff",
              padding: "1rem",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            }}
          >
            {/* Top bar: which match is currently open + back button */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.75rem",
              }}
            >
              <p style={{ margin: 0 }}>
                You are updating:{" "}
                <strong>
                  {homeName} vs {awayName}
                </strong>
              </p>
              <button onClick={closeCurrentGame}>Back to game list</button>
            </div>

            {/* Summary of current score */}
            <p>
              Score:{" "}
              <strong>
                {homeScoreLabel} – {awayScoreLabel}
              </strong>
            </p>

            {/* Summary of current match status */}
            <p>
              Status:{" "}
              <strong>{selectedFixture.status || "not started"}</strong>
            </p>

            {/* Summary of yellow and red cards for each team */}
            <p style={{ marginTop: 4 }}>
              Cards:{" "}
              <strong>
                {homeName}: {homeYellow}Y / {homeRed}R
              </strong>{" "}
              |{" "}
              <strong>
                {awayName}: {awayYellow}Y / {awayRed}R
              </strong>
            </p>

            {/* Match clock controls */}
            <div style={{ marginTop: "1rem" }}>
              <h4>Match clock</h4>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  marginBottom: "0.5rem",
                }}
              >
                {/* Clock display, turns red after 30:00 */}
                <span
                  style={{
                    fontSize: "1.8rem",
                    fontWeight: "bold",
                    fontVariantNumeric: "tabular-nums",
                    color: clockIsOver30 ? "red" : "inherit",
                  }}
                >
                  {formatClock(elapsedSeconds)}
                </span>

                {/* Buttons to control the clock */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={startClock}>Start clock</button>
                  <button onClick={stopClock}>Stop</button>
                  <button onClick={resetClock}>Reset</button>
                </div>
              </div>
              <p style={{ fontSize: 12, opacity: 0.8 }}>
                Clock value is shared with the home page and turns red once it
                goes past 30:00.
              </p>
            </div>

            {/* Score buttons for adding points and goals */}
            <div style={{ marginTop: "1rem" }}>
              <h4>Score buttons</h4>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                <button onClick={() => changeScore("home", "point", +1)}>
                  + {homeName} point
                </button>
                <button onClick={() => changeScore("home", "goal", +1)}>
                  + {homeName} goal
                </button>
                <button onClick={() => changeScore("away", "point", +1)}>
                  + {awayName} point
                </button>
                <button onClick={() => changeScore("away", "goal", +1)}>
                  + {awayName} goal
                </button>
              </div>
            </div>

            {/* Correction buttons for admin incase wrong score updated */}
            <div style={{ marginTop: "1rem" }}>
              <h4>Score Correction</h4>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                <button onClick={() => changeScore("home", "point", -1)}>
                  - {homeName} point
                </button>
                <button onClick={() => changeScore("home", "goal", -1)}>
                  - {homeName} goal
                </button>
                <button onClick={() => changeScore("away", "point", -1)}>
                  - {awayName} point
                </button>
                <button onClick={() => changeScore("away", "goal", -1)}>
                  - {awayName} goal
                </button>
              </div>
            </div>

            {/* Card buttons for yellow and reds*/}
            <div style={{ marginTop: "1rem" }}>
              <h4>Card buttons</h4>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                <button onClick={() => changeCards("home", "yellow", +1)}>
                  + {homeName} yellow
                </button>
                <button onClick={() => changeCards("home", "red", +1)}>
                  + {homeName} red
                </button>
                <button onClick={() => changeCards("away", "yellow", +1)}>
                  + {awayName} yellow
                </button>
                <button onClick={() => changeCards("away", "red", +1)}>
                  + {awayName} red
                </button>
              </div>
            </div>

            {/* Card correction buttons to remove cards if added by mistake */}
            <div style={{ marginTop: "1rem" }}>
              <h4>Card correction</h4>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                  marginBottom: "0.5rem",
                }}
              >
                <button onClick={() => changeCards("home", "yellow", -1)}>
                  - {homeName} yellow
                </button>
                <button onClick={() => changeCards("home", "red", -1)}>
                  - {homeName} red
                </button>
                <button onClick={() => changeCards("away", "yellow", -1)}>
                  - {awayName} yellow
                </button>
                <button onClick={() => changeCards("away", "red", -1)}>
                  - {awayName} red
                </button>
              </div>
            </div>

            {/* Match status buttons - HT, FT etc. */}
            <div style={{ marginTop: "1rem" }}>
              <h4>Match status</h4>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <button onClick={() => changeStatus("first half")}>
                  Start / First half
                </button>
                <button onClick={() => changeStatus("half time")}>
                  Half time
                </button>
                <button onClick={() => changeStatus("second half")}>
                  Second half
                </button>
                <button onClick={() => changeStatus("full time")}>
                  Full time
                </button>
              </div>
            </div>

            {/* Show any error from updating scores/cards/status */}
            {actionError && (
              <p style={{ color: "red", marginTop: "0.5rem" }}>
                {actionError}
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

export default AdminMatchConsole;
