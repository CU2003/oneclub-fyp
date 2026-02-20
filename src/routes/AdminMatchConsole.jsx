// src/routes/AdminMatchConsole.jsx
// google firebase (2025), "get data with cloud firestore" - https://firebase.google.com/docs/firestore/query-data/listen and
// "listen to real-time updates with cloud firestore" - https://firebase.google.com/docs/firestore/query-data/listen documentation.
// used as a guide for using collection(), query(), getDocs(), onSnapshot() and updateDoc()
// in the admin match console. - iteration 2

// reference: https://firebase.google.com/docs/firestore/query-data/get-data#get_a_document
// line 77, grabbed staright from link.  it loads the admin's club
// name from their profile in Firestore so the admin console only shows fixtures for their club

// the main admin control panel for live matches.
// admins can
// choose a game to update
// start/stop/reset the match clock
// update goals, points, cards for both teams
// update the match status - fh, sh, ft
// changes are saved to firestore and displayed on the home page
// lets the admin control the live match clock and create timeline events (scores, cards, status) that supporters see on the supporter views

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx"; // useauth gives the current logged in user from authcontext
import { auth, db } from "../firebase"; // auth used for loggin out, db lets us talk to firestore
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  getDoc, // reads the admin user profile from Firestore users (uid)
  onSnapshot,
  updateDoc,
  serverTimestamp, // stores time when clock is started
  addDoc, // user story 13 - create fixtures
  deleteDoc, // used to remove scoring events when corrections are made
} from "firebase/firestore";

// admins clubs is loaded from firestore (users/uid)

function AdminMatchConsole() {
  // currentuser is logged in admin
  const { currentUser, userDoc } = useAuth();
  const navigate = useNavigate();

  const [fixtures, setFixtures] = useState([]); // list of fixtures admin can see
  const [loadingFixtures, setLoadingFixtures] = useState(true); // loading message flag for users
  const [fixturesError, setFixturesError] = useState(""); // error message if fixture fails to load

  const [selectedFixtureId, setSelectedFixtureId] = useState(""); // id of the fixture the admin clicks
  const [selectedFixture, setSelectedFixture] = useState(null); // data from selected fixture from firestore

  const [actionError, setActionError] = useState(""); // error for actions like updating score, cards etc.

  const [elapsedSeconds, setElapsedSeconds] = useState(0); // number of seconds match clock has been running
  const [isClockRunning, setIsClockRunning] = useState(false); // true or false for is clock is still running for game

  // user story 13 - create fixture form (pre-match details)
  // these are like boxes that store the information the admin types into the form
  const [newAwayTeam, setNewAwayTeam] = useState("");
  const [newDateTime, setNewDateTime] = useState("");
  const [newVenue, setNewVenue] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  

  // user story 14 - admin enters lineups prior to the game so reporters and supporters can see who is playing
  // reference: https://chatgpt.com/share/698f5263-92fc-8004-bd06-d94790f01d1c (lines 66-72)
  // I took code from this chat and used it for my project (made changes to suit also).
  // newHomeLineup / newAwayLineup: text from the create-fixture form (one player per line). Parsed and saved as arrays when the admin creates a new game.
  const [newHomeLineup, setNewHomeLineup] = useState("");
  const [newAwayLineup, setNewAwayLineup] = useState("");
  // editingHomeLineup / editingAwayLineup: text for the Team Lineups section when editing an existing fixture. loaded from fixture then saved using save lineups.
  const [editingHomeLineup, setEditingHomeLineup] = useState("");
  const [editingAwayLineup, setEditingAwayLineup] = useState("");
  // pending scoring event confirmation (team, type, and previewed score)
  const [pendingScore, setPendingScore] = useState(null);
  const [pendingScorer, setPendingScorer] = useState("");
  const [showScorerModal, setShowScorerModal] = useState(false);
  const [scorerError, setScorerError] = useState("");
  
  // verifier name input for when admin publishes a match
  const [verifierName, setVerifierName] = useState("");

  // club name is loaded from the admins firestore profile
  const [clubName, setClubName] = useState(null);
  const [loadingClubName, setLoadingClubName] = useState(true);

  const handleLogout = () => {
    // when admin clicks logout, signs them out of FB auth
    auth.signOut();
  };

  // loads this admin's club from Firestore user doc:
  // users/uid include role, admin, club and clubname

  useEffect(() => {
    let cancelled = false;

    async function loadClubName() {
      setLoadingClubName(true);

      // if no one logged in, can't load anything.
      if (!currentUser) {
        setClubName(null);
        setLoadingClubName(false);
        return;
      }

      try {
        // prefer the already-subscribed firestore profile from authcontext (userDoc)
        const data = userDoc;

        if (!data) {
          if (!cancelled) {
            setClubName(null);
            setLoadingClubName(false);
          }
          return;
        }

        // prefer structured club field like "UCC_ID" then fall back to clubName
        if (typeof data.club === "string" && data.club.trim()) {
          const raw = data.club.trim();
          const derived = raw.endsWith("_ID") ? raw.replace(/_ID$/, "") : raw;
          if (!cancelled) {
            setClubName(derived);
            setLoadingClubName(false);
          }
          return;
        }

        if (typeof data.clubName === "string" && data.clubName.trim()) {
          if (!cancelled) {
            setClubName(data.clubName.trim());
            setLoadingClubName(false);
          }
          return;
        }

        // no club info
        if (!cancelled) {
          setClubName(null);
          setLoadingClubName(false);
        }
      } catch (err) {
        console.error("Failed to load admin club from Firestore:", err);
        if (!cancelled) {
          setClubName(null);
          setLoadingClubName(false);
        }
      }
    }

    loadClubName();
    return () => {
      cancelled = true;
    };
  }, [currentUser, userDoc]);

  // reference: https://chatgpt.com/share/698627f9-e168-8004-b59c-687532595a16
  // lines 143-151, 161-234
  // used code to assist me with building the firestore path using useMemo and creating fixtures
  // got help with understanding how to build dynamic firestore collection paths as arrays, using useMemo to optimize path calculation,and adapting the create fixture form to work with my data structure
  
  // reference: https://chatgpt.com/share/69863241-da6c-8004-b905-14311d38b234
  // lines 148-156 - got help with building  firestore paths based on admin's competition info from their profile
  // this ensures each admin only sees and creates fixtures for their own competition
  // admin's associated competition determines where fixtures are stored.
  // this figures out where in firestore to save the games based on what competition the admin is in
  // for example, if the admin is in "sigerson-cup", games go to Championship/sigerson-cup/fixtures
  // if the admin is in "munster-championship", games go to Championship/munster-championship/fixtures
  const fixtureCollectionPath = useMemo(() => {
    const type = userDoc?.competitionType || "championship";
    const id = userDoc?.competitionId || "munster-championship";

    if (type === "championship") return ["Championship", id, "fixtures"];
    if (type === "league") return ["Leagues", id, "fixtures"];
    // fallback
    return ["Championship", "munster-championship", "fixtures"];
  }, [userDoc?.competitionType, userDoc?.competitionId]);

  const competitionLabel = useMemo(() => {
    const type = userDoc?.competitionType || "championship";
    const id = userDoc?.competitionId || "munster-championship";
    return `${type}: ${id}`;
  }, [userDoc?.competitionType, userDoc?.competitionId]);

  // user story 13 - this function runs when the admin clicks "save fixture"
  // it takes all the information from the form and saves it to firestore as a new game
  async function handleCreateFixture(e) {
    e.preventDefault();
    setCreateError("");
    setCreateSuccess("");

    // check if the admin has a club set up in their profile
    // if not, show an error and stop
    if (!clubName) {
      setCreateError("Your club is not set on your admin profile.");
      return;
    }
    // check if the admin entered an opponent team name
    // if not, show an error and stop
    if (!newAwayTeam.trim()) {
      setCreateError("Please enter an opponent.");
      return;
    }
    // check if the admin picked a date and time
    // if not, show an error and stop
    if (!newDateTime) {
      setCreateError("Please choose a date and time.");
      return;
    }

    // turn the date and time the admin picked into a proper date object
    const matchDate = new Date(newDateTime);
    // check if the date is valid
    // if not, show an error and stop
    if (Number.isNaN(matchDate.getTime())) {
      setCreateError("Date/time is not valid.");
      return;
    }

    try {
      // figure out where in firestore to save this game
      // uses the fixtureCollectionPath we calculated earlier
      const fixturesCol = collection(db, ...fixtureCollectionPath);
      
      // user story 14 - reference: https://chatgpt.com/share/698f5263-92fc-8004-bd06-d94790f01d1c (lines 226-245)
      // I took code from this chat and used it for my project (made changes to suit also).
      // parse lineup text (one player per line) into arrays for Firestore
      // split by newline, trim each line, drop empty lines; reporters and supporters read these from the fixture doc
      const homeLineupArray = newHomeLineup
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);
      const awayLineupArray = newAwayLineup
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      // create a new game document in firestore with all the information
      await addDoc(fixturesCol, {
        homeTeam: clubName,  // the admin's club is always the home team
        awayTeam: newAwayTeam.trim(),  // the opponent the admin typed in
        date: matchDate,  // when the game will be played
        venue: newVenue.trim() || null,  // where the game will be played (optional)

        // user story 14 - save lineups on the fixture so MatchReporter and FixtureTimeline can show who is playing
        homeLineup: homeLineupArray.length > 0 ? homeLineupArray : null,
        awayLineup: awayLineupArray.length > 0 ? awayLineupArray : null,

        // baseline match fields (so it behaves like Kilbrittain fixtures)
        // start everything at zero since the game hasn't been played yet
        homeGoals: 0,
        homePoints: 0,
        awayGoals: 0,
        awayPoints: 0,
        homeYellowCards: 0,
        homeRedCards: 0,
        awayYellowCards: 0,
        awayRedCards: 0,

        status: "upcoming",  // the game hasn't started yet
        clockRunning: false,  // the match clock isn't running
        clockSeconds: 0,  // the clock starts at zero
        clockStartedAt: null,  // the clock hasn't been started yet
      });

      // if we get here, the game was created successfully
      // show a success message and clear the form
      setCreateSuccess("Fixture created.");
      setNewAwayTeam("");
      setNewDateTime("");
      setNewVenue("");
      // user story 14 - clear lineup state after fixture creation (lines 275-276)
      setNewHomeLineup("");
      setNewAwayLineup("");
    } catch (err) {
      // if something goes wrong, log it and show an error message
      console.error("Failed to create fixture:", err);
      setCreateError("Could not create fixture. Check Firestore rules and try again.");
    }
  }

  // google firebase (2025), "get data with cloud firestore" - https://firebase.google.com/docs/firestore/query-data/listen
  // lines 64-110 ~
  // used this to assist with the changing of championship/fixtures path and filter by the admin's club
  // iteration 2
  // load fixtures that this admin is allowed to see
  useEffect(() => {
    async function loadFixtures() {
      setLoadingFixtures(true);
      setFixturesError("");

      // wait until we know the admin's clubName before filtering
      // otherwise the list may briefly show "all fixtures"
      if (loadingClubName) return;

      // firestore query to get fixtures ordered by date
      try {
        const q = query(
          collection(db, ...fixtureCollectionPath),
          orderBy("date", "asc")
        );

        // runs query once and gets all matching documents
        const snap = await getDocs(q);
        // turns each firestore document into a plain js object with an id
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // if this admin is tied to a club, only show games where that club is home or away
        // if clubName is null, show all fixtures (you can change to block access if you prefer).
        const filtered = clubName
          ? all.filter((f) => f.homeTeam === clubName || f.awayTeam === clubName)
          : all;

        setFixtures(filtered);
      } catch (err) {
        // if anything goes wrong, log error and show frienldy message
        // crucial for testing
        console.error(err);
        setFixturesError("Could not load fixtures for admin console.");
      } finally {
        setLoadingFixtures(false);
      }
    }

    loadFixtures();
  }, [clubName, loadingClubName]); // depends on loaded clubName

  // subscribe to currently selected fixture
  useEffect(() => {
    // if no fixture selected, clears everythign and clock stops
    if (!selectedFixtureId) {
      setSelectedFixture(null);
      setElapsedSeconds(0);
      setIsClockRunning(false);
      setVerifierName(""); // clear verifier name when no fixture selected
      return;
    }

    // reference to fiture doc in firestore
    const fixtureRef = doc(
      db,
      ...fixtureCollectionPath,
      selectedFixtureId
    );

    // onsnapshot listens to live changes in firestore - runs everytime fixture is updated
    const unsubscribe = onSnapshot(fixtureRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();

        // used chatgpt to help generate code that would allow the clock to show for both the adminmatchconsole
        // and the home page for supporters. https://chatgpt.com/share/69209f75-a680-8004-ba40-c34a911b6e4f
        // lines 140 - 179 ~
        // user story 10 - keeps the admin clock in sync with the supporter clocks on the home page and fixture timeline
        // works out total elapsed seconds from the base clock value and the time since clockstartedat so every screen shows the same time
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
        
        // user story 14 - reference: https://chatgpt.com/share/698f5263-92fc-8004-bd06-d94790f01d1c (lines 372-383)
        // I took code from this chat and used it for my project (made changes to suit also).
        // load lineups from fixture into editing state (convert arrays back to text, one per line)
        // when admin selects a fixture, populate the Team Lineups textareas so they can edit and save
        if (Array.isArray(data.homeLineup)) {
          setEditingHomeLineup(data.homeLineup.join("\n"));
        } else {
          setEditingHomeLineup("");
        }
        if (Array.isArray(data.awayLineup)) {
          setEditingAwayLineup(data.awayLineup.join("\n"));
        } else {
          setEditingAwayLineup("");
        }
      } else {
        // if documnet no longer exists, clear everything
        setSelectedFixture(null);
        setElapsedSeconds(0);
        setIsClockRunning(false);
        // user story 14 - clear lineup state when fixture document deleted (lines 395-396)
        setEditingHomeLineup("");
        setEditingAwayLineup("");
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

  // reference: https://chatgpt.com/share/698dd95f-c4bc-8004-abb2-f58a3426cc2b
  // used this chatgpt example to follow a pattern where scores, cards and status updates are all saved as events in one subcollection under each game
  // also used it to confirm scores in a popup with a frozen clock time, and to remove the latest matching event when undoing scores or cards so the supporter timeline stays accurate
  // lines 456-663 - took and implemented the pattern for confirming scores in a popup, freezing the clock time, saving score events, and undoing the latest matching score event
  // lines 672-788 and 794-831 - took and implemented the pattern for adding card events, undoing the latest matching card event, and logging status change events into the same events subcollection for the supporter timeline
  // user story 3 and 5 - updates the score in firestore
  // team can be "home" or "away"
  // scoreType can be "goal" or "point"
  // delta is +1 to add a score, or -1 to remove one (for corrections)
  // playerName is optional - used when logging who scored
  // eventClockSeconds lets us freeze the clock time at the moment the admin clicked the button
  async function changeScore(team, scoreType, delta, playerName, eventClockSeconds) {
    if (!selectedFixtureId || !selectedFixture) return; // no fixture selected - do nothing
    setActionError("");

    // gets current score from helper function
    let { homeGoals, homePoints, awayGoals, awayPoints } = getScores();

    // decides which value to change based on team and score type
    if (team === "home") {
      if (scoreType === "goal") {
        // never let the score go below 0
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
        ...fixtureCollectionPath,
        selectedFixtureId
      );
      // save updated scores to firestore so supporters see them instantly
      await updateDoc(fixtureRef, {
        homeGoals,
        homePoints,
        awayGoals,
        awayPoints,
      });

      // log scoring event only when adding scores (not corrections)
      // and only if a player name is provided
      // user story 10 - when a new score is added, create a timeline event so supporters can see who scored, the score at that moment, and the match time
      // clockseconds stores the frozen time from when the admin clicked the score button so the timeline time does not keep moving after the popup
      if (delta > 0 && playerName) {
        // work out the team names for a readable score label
        const eventHomeName = selectedFixture.homeTeam || "Home";
        const eventAwayName = selectedFixture.awayTeam || "Away";

        // create a subcollection "events" under this fixture to store scoring events
        const eventsCol = collection(
          db,
          ...fixtureCollectionPath,
          selectedFixtureId,
          "events"
        );

        const clockAtEvent =
          typeof eventClockSeconds === "number"
            ? eventClockSeconds
            : elapsedSeconds;

        await addDoc(eventsCol, {
          type: "score",
          team,
          playerName,
          scoreType,
          // clock time when the score was recorded
          clockSeconds: clockAtEvent,
          createdAt: serverTimestamp(),
          // snapshot of the score at this moment
          homeGoals,
          homePoints,
          awayGoals,
          awayPoints,
          // readable combined score string for reporters
          scoreLabel: `${eventHomeName} ${homeGoals}-${homePoints} ${eventAwayName} ${awayGoals}-${awayPoints}`,
        });
      }

      // when making a correction (delta < 0), try to remove the most recent
      // matching scoring event from the timeline so supporters don't see
      // scores that were undone by the admin
      // user story 10 - this keeps the live timeline clean so supporters only see scores that still count after admin corrections
      if (delta < 0) {
        try {
          const eventsCol = collection(
            db,
            ...fixtureCollectionPath,
            selectedFixtureId,
            "events"
          );
          const snap = await getDocs(eventsCol);
          if (!snap.empty) {
            const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            // only look at events for this team + scoreType
            const matching = all
              .filter(
                (ev) => ev.team === team && ev.scoreType === scoreType
              )
              .sort((a, b) => {
                // newest by clockSeconds, then by createdAt if available
                const aClock =
                  typeof a.clockSeconds === "number" ? a.clockSeconds : 0;
                const bClock =
                  typeof b.clockSeconds === "number" ? b.clockSeconds : 0;
                if (aClock !== bClock) return bClock - aClock;
                const aCreated = a.createdAt?.toMillis
                  ? a.createdAt.toMillis()
                  : 0;
                const bCreated = b.createdAt?.toMillis
                  ? b.createdAt.toMillis()
                  : 0;
                return bCreated - aCreated;
              });
            const toDelete = matching[0];
            if (toDelete) {
              const evRef = doc(
                db,
                ...fixtureCollectionPath,
                selectedFixtureId,
                "events",
                toDelete.id
              );
              await deleteDoc(evRef);
            }
          }
        } catch (innerErr) {
          console.error("Failed to remove scoring event for correction:", innerErr);
          // do not surface this to the admin UI; score correction has already applied
        }
      }
    } catch (err) {
      console.error(err);
      setActionError("Could not update score.");
    }
  }

  // opens a confirmation popup when admin clicks a score button
  // this lets them choose the scorer from the lineup and see the updated score before saving
  // user story 10 - prepares the scoring popup with a frozen clock time and preview of the new score
  // this is how we capture the exact moment of the score and link it to a player for the supporter timeline
  function openScorerConfirm(team, scoreType) {
    if (!selectedFixture) return;

    // start from current scores
    let { homeGoals, homePoints, awayGoals, awayPoints } = getScores();

    // simulate adding one score so we can show the updated score in the popup
    if (team === "home") {
      if (scoreType === "goal") {
        homeGoals = homeGoals + 1;
      } else {
        homePoints = homePoints + 1;
      }
    } else {
      if (scoreType === "goal") {
        awayGoals = awayGoals + 1;
      } else {
        awayPoints = awayPoints + 1;
      }
    }

    setPendingScore({
      team,
      scoreType,
      homeGoals,
      homePoints,
      awayGoals,
      awayPoints,
      // freeze the clock time at the moment the admin clicked the score button
      clockSeconds: elapsedSeconds,
    });
    setPendingScorer("");
    setScorerError("");
    setShowScorerModal(true);
  }

  // confirm button in the popup - saves the score and logs event
  // user story 10 - once the admin picks a player and confirms, this calls changescore with the frozen clock time so the event shows in the live timeline
  async function confirmScoringEvent() {
    if (!pendingScore) return;
    if (!pendingScorer) {
      setScorerError("Please select a player.");
      return;
    }

    try {
      await changeScore(
        pendingScore.team,
        pendingScore.scoreType,
        +1,
        pendingScorer,
        pendingScore.clockSeconds
      );
      setShowScorerModal(false);
      setPendingScore(null);
      setPendingScorer("");
      setScorerError("");
    } catch (err) {
      console.error(err);
      setScorerError("Could not save scoring event. Try again.");
    }
  }

  function cancelScoringEvent() {
    setShowScorerModal(false);
    setPendingScore(null);
    setPendingScorer("");
    setScorerError("");
  }

  // user story 3 and 5 - updates cards in firestore
  // team can be "home" or "away"
  // cardType can be "yellow" or "red"
  // delta is +1 to add a card, or -1 to remove one (for corrections)
  async function changeCards(team, cardType, delta) {
    if (!selectedFixtureId || !selectedFixture) return;
    setActionError("");

    // gets current cards count from helper function
    let { homeYellow, homeRed, awayYellow, awayRed } = getCards();

    // decide which counter to change based on team and card type
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
        ...fixtureCollectionPath,
        selectedFixtureId
      );
      // saves updated cards counts to firestore so supporters see them instantly
      await updateDoc(fixtureRef, {
        homeYellowCards: homeYellow,
        homeRedCards: homeRed,
        awayYellowCards: awayYellow,
        awayRedCards: awayRed,
      });

      // when adding a card (delta > 0), log a card event in the timeline
      // user story 10 - card events go into the same events list so supporters can see bookings on the live timeline with the match time and running totals
      if (delta > 0) {
        try {
          const eventsCol = collection(
            db,
            ...fixtureCollectionPath,
            selectedFixtureId,
            "events"
          );
          await addDoc(eventsCol, {
            type: "card",
            team,
            cardType,
            clockSeconds: elapsedSeconds,
            createdAt: serverTimestamp(),
            homeYellow,
            homeRed,
            awayYellow,
            awayRed,
          });
        } catch (innerErr) {
          console.error("Failed to log card event:", innerErr);
        }
      }

      // when correcting a card (delta < 0), remove the most recent matching card event
      // user story 10 - this stops old card events from staying on the supporter timeline when an admin has undone them
      if (delta < 0) {
        try {
          const eventsCol = collection(
            db,
            ...fixtureCollectionPath,
            selectedFixtureId,
            "events"
          );
          const snap = await getDocs(eventsCol);
          if (!snap.empty) {
            const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const matching = all
              .filter(
                (ev) =>
                  ev.type === "card" &&
                  ev.team === team &&
                  ev.cardType === cardType
              )
              .sort((a, b) => {
                const aClock =
                  typeof a.clockSeconds === "number" ? a.clockSeconds : 0;
                const bClock =
                  typeof b.clockSeconds === "number" ? b.clockSeconds : 0;
                if (aClock !== bClock) return bClock - aClock;
                const aCreated = a.createdAt?.toMillis
                  ? a.createdAt.toMillis()
                  : 0;
                const bCreated = b.createdAt?.toMillis
                  ? b.createdAt.toMillis()
                  : 0;
                return bCreated - aCreated;
              });
            const toDelete = matching[0];
            if (toDelete) {
              const evRef = doc(
                db,
                ...fixtureCollectionPath,
                selectedFixtureId,
                "events",
                toDelete.id
              );
              await deleteDoc(evRef);
            }
          }
        } catch (innerErr) {
          console.error("Failed to remove card event for correction:", innerErr);
        }
      }
    } catch (err) {
      console.error(err);
      setActionError("Could not update cards.");
    }
  }

  // user story 4 - update the match status (first half, half time, second half, full time)
  // this is called when the admin clicks one of the status buttons
  async function changeStatus(status) {
    if (!selectedFixtureId) return;
    setActionError("");

    try {
      const fixtureRef = doc(
        db,
        ...fixtureCollectionPath,
        selectedFixtureId
      );
      // save the new status to firestore so supporters see it instantly
      await updateDoc(fixtureRef, { status });

      // log a status change event so supporters can see it in the timeline
      // user story 10 - each status change is stored with the clock time so the live timeline shows when the game moved between stages
      try {
        const eventsCol = collection(
          db,
          ...fixtureCollectionPath,
          selectedFixtureId,
          "events"
        );
        await addDoc(eventsCol, {
          type: "status",
          status,
          clockSeconds: elapsedSeconds,
          createdAt: serverTimestamp(),
        });
      } catch (innerErr) {
        console.error("Failed to log status event:", innerErr);
      }
    } catch (err) {
      console.error(err);
      setActionError("Could not update status.");
    }
  }

  // reference: https://firebase.google.com/docs/firestore/manage-data/add-data#update-documents
  // lines 534 - 559 - updateDoc - when the admin clicks publish or unpublish, it finds the fixture document in firestore and updates just the published field to true or false
  // this lets admins toggle whether a match is published or not by setting published to true or false
  
  // user story #11 - publish/unpublish match
  // this publishes the match so detailed stats are hidden on home page
  // when a match is published, it means the detailed stats (cards, clock) are hidden on the home page
  // only the final score and teams are shown, and users can click "view match report" to see everything
  // also stores who verified the result and when, so club secretaries can see verification info
  // admin can enter their name before publishing to specify who verified the result
  async function publishMatch() {
    // if no game is selected, don't do anything
    if (!selectedFixtureId) return;
    setActionError("");

    // check if admin entered a verifier name
    const nameToUse = verifierName.trim() || clubName || currentUser?.email || "Admin";

    try {
      // find the game in firestore
      const fixtureRef = doc(
        db,
        ...fixtureCollectionPath,
        selectedFixtureId
      );
      // user story 18 - reference: https://stackoverflow.com/questions/60056185/convert-firestore-timestamp-to-date-into-different-format (timestamp format used when displaying verifiedAt; here we store serverTimestamp())
      // set published to true, which tells the home page to hide detailed stats
      // also store who verified (admin's entered name or club name) and when (server timestamp)
      // this lets journalist/reporters see who verified the result when viewing the match report
      await updateDoc(fixtureRef, { 
        published: true,
        verifiedBy: nameToUse,
        verifiedAt: serverTimestamp(),
      });
      // clear the verifier name input after successful publish
      setVerifierName("");
    } catch (err) {
      // if something goes wrong, log it and show an error
      console.error(err);
      setActionError("Could not publish match.");
    }
  }

  // user story #11 - unpublishes the match so detailed stats are shown again on home page
  // when a match is unpublished, all the detailed stats (cards, clock) are shown on the home page again
  // this is useful if the admin made a mistake and wants to fix something
  // clears verification info when unpublishing so it can be re-verified when published again
  
  async function unpublishMatch() {
    // if no game is selected, don't do anything
    if (!selectedFixtureId) return;
    setActionError("");

    try {
      // find the game in firestore
      const fixtureRef = doc(
        db,
        ...fixtureCollectionPath,
        selectedFixtureId
      );
      // set published to false, which tells the home page to show all detailed stats again
      // user story 18 - reference: same as publish (verifiedBy/verifiedAt). also clear verification info since the match is being unpublished
      await updateDoc(fixtureRef, { 
        published: false,
        verifiedBy: null,
        verifiedAt: null,
      });
    } catch (err) {
      // if something goes wrong, log it and show an error
      console.error(err);
      setActionError("Could not unpublish match.");
    }
  }

  // used chatgpt to assist with the stop/start/reset behaviour for the match clock
  // https://chatgpt.com/share/69209f75-a680-8004-ba40-c34a911b6e4f lines: 343 - 423 ~
  // i adapted the pattern to align with the fixture schema
  // user story 10 - formats clock as minutes:seconds for display (e.g. 15:30)
  // converts total seconds into a readable time format
  function formatClock(secs) {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return `${mm}:${ss}`;
  }

  // user story 10 - start the clock for the selected fixture
  // when the admin clicks "start clock", it saves the current server time to the database
  // this lets supporters see the clock counting up in real-time
  async function startClock() {
    if (!selectedFixtureId) return;
    // marks clock as running in local state
    setIsClockRunning(true);

    const fixtureRef = doc(
      db,
      ...fixtureCollectionPath,
      selectedFixtureId
    );

    // in firestore, set clockRunning to true and store the exact server time when it started
    // this lets us calculate how much time has passed even if the page hasn't refreshed
    await updateDoc(fixtureRef, {
      clockRunning: true,
      clockStartedAt: serverTimestamp(),
    }).catch(console.error);
  }

  // user story 10 - stop the clock for the fixture
  // when the admin clicks "stop", it pauses the clock and saves how much time has elapsed
  async function stopClock() {
    if (!selectedFixtureId) return;
    // stops local ticking
    setIsClockRunning(false);

    const fixtureRef = doc(
      db,
      ...fixtureCollectionPath,
      selectedFixtureId
    );

    // save the total elapsed time to the database and clear the start time
    // this way if the admin starts it again later, it continues from where it stopped
    await updateDoc(fixtureRef, {
      clockRunning: false,
      clockSeconds: elapsedSeconds,
      clockStartedAt: null,
    }).catch(console.error);
  }

  // user story 10 - reset the clock back to 00:00 for this fixture
  // when the admin clicks "reset", it clears the clock and starts it fresh
  async function resetClock() {
    if (!selectedFixtureId) return;
    setIsClockRunning(false);
    setElapsedSeconds(0);

    const fixtureRef = doc(
      db,
      ...fixtureCollectionPath,
      selectedFixtureId
    );
    // reset all clock fields in firestore back to zero
    await updateDoc(fixtureRef, {
      clockRunning: false,
      clockSeconds: 0,
      clockStartedAt: null,
    }).catch(console.error);
  }

  // back to list button handler
  // clears the selected game and returns to list of fixtures
  function closeCurrentGame() {
    setSelectedFixtureId("");
    setSelectedFixture(null);
    setElapsedSeconds(0);
    setIsClockRunning(false);
    setActionError("");
    // user story 14 - clear lineup state when closing fixture (lines 1006-1007)
    setEditingHomeLineup("");
    setEditingAwayLineup("");
    setVerifierName(""); // clear verifier name when closing fixture
  }
  
  // user story 14 - reference: https://chatgpt.com/share/698f5263-92fc-8004-bd06-d94790f01d1c (lines 1014-1045)
  // I took code from this chat and used it for my project (made changes to suit also).
  // save lineups for existing fixture
  async function saveLineups() {
    if (!selectedFixtureId) return;
    setActionError("");
    
    try {
      // parse lineups from text input (one player per line)
      const homeLineupArray = editingHomeLineup
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);
      const awayLineupArray = editingAwayLineup
        .split("\n")
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      const fixtureRef = doc(
        db,
        ...fixtureCollectionPath,
        selectedFixtureId
      );
      
      await updateDoc(fixtureRef, {
        homeLineup: homeLineupArray.length > 0 ? homeLineupArray : null,
        awayLineup: awayLineupArray.length > 0 ? awayLineupArray : null,
      });
      
      setActionError(""); // Clear any previous errors
      // Success - the onSnapshot will update the UI automatically
    } catch (err) {
      console.error(err);
      setActionError("Could not save lineups.");
    }
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

  // ui
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
          {/* show which email is logged in */}
          <span style={{ marginRight: "1rem" }}>
            Logged in as: {currentUser?.email}
          </span>
          {/* logout button */}
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>
      

      {/* reference: https://www.w3schools.com/html/html_forms.asp */}
      {/* lines 701-796 - used w3schools html forms documentation to help me build the form structure */}
      {/* and how to handle form submission in react */}
      {/* user story 13 - create a fixture for this admin's club */}
      <section style={{ marginBottom: "2rem" }}>
        <h3>0. Create a new fixture</h3>

        <form
          onSubmit={handleCreateFixture}
          style={{
            borderRadius: "8px",
            background: "#ffffff",
            padding: "1rem",
            boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            display: "grid",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <label style={{ fontSize: 14, flex: 1, minWidth: 180 }}>
              Home team (your club)
              <input
                type="text"
                value={clubName || ""}
                readOnly
                style={{
                  display: "block",
                  marginTop: 4,
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  background: "#f9fafb",
                }}
              />
            </label>

            <label style={{ fontSize: 14, flex: 1, minWidth: 180 }}>
              Away team (opponent)
              <input
                type="text"
                value={newAwayTeam}
                onChange={(e) => setNewAwayTeam(e.target.value)}
                style={{
                  display: "block",
                  marginTop: 4,
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <label style={{ fontSize: 14 }}>
              Date &amp; time
              <input
                type="datetime-local"
                value={newDateTime}
                onChange={(e) => setNewDateTime(e.target.value)}
                style={{
                  display: "block",
                  marginTop: 4,
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
              />
            </label>

            <label style={{ fontSize: 14, flex: 1, minWidth: 180 }}>
              Venue (optional)
              <input
                type="text"
                value={newVenue}
                onChange={(e) => setNewVenue(e.target.value)}
                style={{
                  display: "block",
                  marginTop: 4,
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                }}
              />
            </label>
          </div>
          
          {/* user story 14 - reference: https://chatgpt.com/share/698f5263-92fc-8004-bd06-d94790f01d1c (lines 1178-1219) - lineups input, one player per line. I took code from this chat and used it for my project (made changes to suit also). */}
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <label style={{ fontSize: 14, flex: 1, minWidth: 300 }}>
              {clubName} Lineup (one player per line, optional)
              <textarea
                value={newHomeLineup}
                onChange={(e) => setNewHomeLineup(e.target.value)}
                placeholder="1. Player Name&#10;2. Player Name&#10;3. Player Name&#10;..."
                style={{
                  display: "block",
                  marginTop: 4,
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  minHeight: "120px",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </label>
            
            <label style={{ fontSize: 14, flex: 1, minWidth: 300 }}>
              {newAwayTeam || "Away Team"} Lineup (one player per line, optional)
              <textarea
                value={newAwayLineup}
                onChange={(e) => setNewAwayLineup(e.target.value)}
                placeholder="1. Player Name&#10;2. Player Name&#10;3. Player Name&#10;..."
                style={{
                  display: "block",
                  marginTop: 4,
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #ddd",
                  minHeight: "120px",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </label>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button type="submit" disabled={!clubName}>
              Save fixture
            </button>
            {createSuccess && (
              <span style={{ fontSize: 13, color: "green" }}>{createSuccess}</span>
            )}
            {createError && (
              <span style={{ fontSize: 13, color: "red" }}>{createError}</span>
            )}
          </div>
        </form>
      </section>

      {/* choose game to update */}
      <section style={{ marginBottom: "2rem" }}>
        <h3>1. Choose a game to update</h3>

        {/* show loading, error, or list of fixtures */}
        {loadingFixtures && <p>Loading fixtures…</p>}
        {fixturesError && <p style={{ color: "red" }}>{fixturesError}</p>}

        {/* no fixtures found for this admin */}
        {!loadingFixtures && fixtures.length === 0 && !fixturesError && (
          <p>
            No fixtures found for{" "}
            <strong>{clubName ?? "this admin"}</strong> in Munster Championship.
          </p>
        )}

        {/* show fixtures list when we have some */}
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
                {/* text summary of the game */}
                <span>{formatFixtureRow(fix)}</span>
                {/* button to open this match in the console */}
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

      {/* updates the selected match */}
      <section>
        <h3>2. Update match</h3>

        {/* if no match is selected yet, show help text */}
        {!selectedFixture && <p>Click "Open match" on a game above.</p>}

        {/* once a match is selected, show all controls */}
        {selectedFixture && (
          <div
            style={{
              borderRadius: "8px",
              background: "#ffffff",
              padding: "1rem",
              boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
            }}
          >
            {/* top bar: which match is currently open + back button */}
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

            {/* summary of current score */}
            <p>
              Score:{" "}
              <strong>
                {homeScoreLabel} – {awayScoreLabel}
              </strong>
            </p>

            {/* summary of current match status */}
            <p>
              Status: <strong>{selectedFixture.status || "not started"}</strong>
            </p>

            {/* summary of yellow and red cards for each team */}
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

            {/* user story 10 - match clock controls */}
            {/* admins can start, stop, and reset the match clock during a game */}
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
                {/* clock display, turns red after 30 minutes to show extra time */}
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

                {/* buttons to control the clock - start makes it count up, stop pauses it, reset goes back to 00:00 */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={startClock}>Start clock</button>
                  <button onClick={stopClock}>Stop</button>
                  <button onClick={resetClock}>Reset</button>
                </div>
              </div>
            </div>

            {/* user story 3 - score buttons for adding points and goals */}
            {/* when the admin clicks these buttons, it opens a confirmation popup to log the scorer and save the score */}
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
                <button onClick={() => openScorerConfirm("home", "point")}>
                  + {homeName} point
                </button>
                <button onClick={() => openScorerConfirm("home", "goal")}>
                  + {homeName} goal
                </button>
                <button onClick={() => openScorerConfirm("away", "point")}>
                  + {awayName} point
                </button>
                <button onClick={() => openScorerConfirm("away", "goal")}>
                  + {awayName} goal
                </button>
              </div>
            </div>

            {/* user story 5 - correction buttons for admin in case wrong score updated */}
            {/* if the admin added a score by mistake, they can click these buttons to remove it */}
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

            {/* user story 3 - card buttons for yellow and red cards */}
            {/* when the admin clicks these buttons, it adds 1 to the card count and saves it to the database */}
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

            {/* user story 5 - card correction buttons to remove cards if added by mistake */}
            {/* if the admin added a card by mistake, they can click these buttons to remove it */}
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

            {/* user story 4 - match status buttons */}
            {/* the admin clicks these to update what stage the game is at (first half, half time, etc.) */}
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
            
            {/* user story 14 - reference: https://chatgpt.com/share/698f5263-92fc-8004-bd06-d94790f01d1c (lines 1514-1566) - lineups editing for existing fixtures. I took code from this chat and used it for my project (made changes to suit also). */}
            <div style={{ marginTop: "1rem" }}>
              <h4>Team Lineups</h4>
              <p style={{ fontSize: "0.9rem", opacity: 0.7, marginBottom: "0.5rem" }}>
                Enter one player per line. Leave empty if not available.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <label style={{ fontSize: 14, flex: 1, minWidth: 300 }}>
                  {homeName} Lineup
                  <textarea
                    value={editingHomeLineup}
                    onChange={(e) => setEditingHomeLineup(e.target.value)}
                    placeholder="1. Player Name&#10;2. Player Name&#10;3. Player Name&#10;..."
                    style={{
                      display: "block",
                      marginTop: 4,
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #ddd",
                      minHeight: "120px",
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                </label>
                
                <label style={{ fontSize: 14, flex: 1, minWidth: 300 }}>
                  {awayName} Lineup
                  <textarea
                    value={editingAwayLineup}
                    onChange={(e) => setEditingAwayLineup(e.target.value)}
                    placeholder="1. Player Name&#10;2. Player Name&#10;3. Player Name&#10;..."
                    style={{
                      display: "block",
                      marginTop: 4,
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px solid #ddd",
                      minHeight: "120px",
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                </label>
              </div>
              <button 
                onClick={saveLineups}
                style={{ marginTop: "0.5rem" }}
              >
                Save Lineups
              </button>
            </div>

            {/* user story #11 - publish/unpublish and view report for completed games */}
            {/* only show these buttons if the game status is "full time" (game is finished) */}
            {selectedFixture?.status === "full time" && (
              <div style={{ marginTop: "1rem" }}>
                <h4>Publish Match</h4>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                  {/* if the game is already published, show who verified it and the unpublish button */}
                  {selectedFixture?.published ? (
                    <>
                      {/* user story 18 - show who verified and when (admin UI) */}
                      {/* reference: https://stackoverflow.com/questions/60056185/convert-firestore-timestamp-to-date-into-different-format */}
                      {/* shows the name of the admin who verified the result and the date and time they did it. */}
                      {/* when an admin has already published a match, this appears above the unpublish button so they can see who verified it and when.*/}
                      {selectedFixture?.verifiedBy && (
                        <div style={{ 
                          padding: "0.5rem 1rem", 
                          background: "#f3f4f6", 
                          borderRadius: "6px",
                          fontSize: "0.9rem",
                          textAlign: "center"
                        }}>
                          {/* verifier name stored when admin published */}
                          Verified by: <strong>{selectedFixture.verifiedBy}</strong>
                          {/* if we have a verification time, show it below the name (e.g. "Jan 28, 2026, 2:30 PM") */}
                          {selectedFixture?.verifiedAt?.toDate && (
                            <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "0.25rem" }}>
                              {(() => {
                                try {
                                  // Firestore timestamp -> JS Date so we can format it
                                  const date = selectedFixture.verifiedAt.toDate();
                                  return date.toLocaleString([], {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  });
                                } catch {
                                  return "";
                                }
                              })()}
                            </div>
                          )}
                        </div>
                      )}
                      <button
                        onClick={unpublishMatch}
                        style={{
                          padding: "0.75rem 1.5rem",
                          fontSize: "1rem",
                          fontWeight: 600,
                          background: "#ef4444",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        Unpublish Match
                      </button>
                    </>
                  ) : (
                    <>
                      {/* admin can enter their name before publishing to specify who verified the result */}
                      <input
                        type="text"
                        value={verifierName}
                        onChange={(e) => setVerifierName(e.target.value)}
                        placeholder="Verified By:"
                        style={{
                          padding: "0.5rem",
                          fontSize: "0.95rem",
                          border: "1px solid #ddd",
                          borderRadius: "4px",
                          width: "100%",
                          maxWidth: "300px",
                        }}
                      />
                      <button
                        onClick={publishMatch}
                        style={{
                          padding: "0.75rem 1.5rem",
                          fontSize: "1rem",
                          fontWeight: 600,
                          background: "#10b981",
                          color: "white",
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                        }}
                      >
                        Publish Match
                      </button>
                    </>
                  )}

                  {/* user story #11 - this button takes the admin to the match report page */}
                  {/* it uses the competition info from the admin's profile to build the correct url */}
                  <button
                    onClick={() => {
                      const competitionType = userDoc?.competitionType || "championship";
                      const competitionId = userDoc?.competitionId || "munster-championship";
                      navigate(`/report/${competitionType}/${competitionId}/${selectedFixtureId}`);
                    }}
                    style={{
                      padding: "0.75rem 1.5rem",
                      fontSize: "1rem",
                      fontWeight: 600,
                      background: "#3b82f6",
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    View Match Report
                  </button>
                </div>
              </div>
            )}

            {/* show any error from updating scores/cards/status */}
            {actionError && (
              <p style={{ color: "red", marginTop: "0.5rem" }}>
                {actionError}
              </p>
            )}
          </div>
        )}
      </section>

      {/* user story 14 - reference: https://chatgpt.com/share/698f5263-92fc-8004-bd06-d94790f01d1c (lines 1770-1804) - scorer dropdown from lineup. I took code from this chat and used it for my project (made changes to suit also). */}
      {/* scoring confirmation popup - appears on top of the page when logging a new score */}
      {showScorerModal && pendingScore && selectedFixture && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              padding: "1rem 1.25rem",
              borderRadius: 8,
              maxWidth: 420,
              width: "90%",
              boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
            }}
          >
            <h4 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
              Confirm score
            </h4>
            <p style={{ margin: "0.25rem 0" }}>
              <strong>
                {pendingScore.team === "home" ? homeName : awayName}{" "}
                {pendingScore.scoreType === "goal" ? "goal" : "point"}
              </strong>
            </p>
            <p style={{ margin: "0.25rem 0" }}>
              Time:{" "}
              <strong>
                {formatClock(
                  typeof pendingScore.clockSeconds === "number"
                    ? pendingScore.clockSeconds
                    : elapsedSeconds
                )}
              </strong>
            </p>
            <p style={{ margin: "0.25rem 0" }}>
              Updated score:{" "}
              <strong>
                {homeName} {pendingScore.homeGoals}-{pendingScore.homePoints}{" "}
                {awayName} {pendingScore.awayGoals}-{pendingScore.awayPoints}
              </strong>
            </p>

            <div style={{ marginTop: "0.75rem" }}>
              <p style={{ marginBottom: 4 }}>Select scorer:</p>
              <div
                style={{
                  maxHeight: 160,
                  overflowY: "auto",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  padding: "0.5rem",
                  background: "#f9fafb",
                }}
              >
                {(pendingScore.team === "home"
                  ? selectedFixture.homeLineup || []
                  : selectedFixture.awayLineup || []
                ).length === 0 && (
                  <p style={{ fontSize: 13, margin: 0 }}>
                    No lineup entered for this team. Close and add a lineup
                    first.
                  </p>
                )}
                {(pendingScore.team === "home"
                  ? selectedFixture.homeLineup || []
                  : selectedFixture.awayLineup || []
                ).map((player) => (
                  <label
                    key={player}
                    style={{
                      display: "block",
                      fontSize: 14,
                      cursor: "pointer",
                      marginBottom: 2,
                    }}
                  >
                    <input
                      type="radio"
                      name="scorer"
                      value={player}
                      checked={pendingScorer === player}
                      onChange={(e) => {
                        setPendingScorer(e.target.value);
                        setScorerError("");
                      }}
                      style={{ marginRight: 6 }}
                    />
                    {player}
                  </label>
                ))}
              </div>
              {scorerError && (
                <p style={{ color: "red", fontSize: 13, marginTop: 4 }}>
                  {scorerError}
                </p>
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: "0.5rem",
                marginTop: "0.75rem",
              }}
            >
              <button onClick={cancelScoringEvent}>Cancel</button>
              <button onClick={confirmScoringEvent}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminMatchConsole;
