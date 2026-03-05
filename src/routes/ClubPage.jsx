// shows one club by id from the url (/club/:clubId). loads club from firestore,
// then loads fixtures for that club from munster, sigerson cup, and carbery junior a.
// supporters can favourite or unfavourite the club (user story 7).
// linked files: App.jsx, firebase, AuthContext, userService (add/remove favourite),
// Home.jsx (same fixture name-matching idea for favourites).

// reference: https://react.dev/reference/react/useMemo
// useMemo used to check if this club is in the user's favourites list so we only recalculate when favourites or club id changes.

// reference: https://symbolsdb.com/star-symbols (star symbol for favourite button)
// used to get the favourite star symbol (★, ☆).

import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { doc, getDoc, collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// importing functions to check if user is logged in and to add/remove favourites
import { useAuth } from "../AuthContext";
import { addFavouriteClub, removeFavouriteClub } from "../userService";

// competition collections to load fixtures from (munster championship, sigerson cup, carbery junior a)
const CLUB_FIXTURE_SOURCES = [
  { compType: "championship", compId: "munster-championship" },
  { compType: "championship", compId: "sigerson-cup" },
  { compType: "league", compId: "west-cork-junior-a" },
];

export default function ClubPage() {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const [club, setClub] = useState(null);
  const [status, setStatus] = useState("loading");
  const [clubFixtures, setClubFixtures] = useState([]);
  const [loadingClubFixtures, setLoadingClubFixtures] = useState(false);

  // getting the logged-in user and their profile which has their favourites list
  const { currentUser, userDoc } = useAuth();

  // loading the club data from firestore when the page loads or when the club ID changes
  useEffect(() => {
    async function load() {
      try {
        // asking firestore for the club document with this ID
        const snap = await getDoc(doc(db, "clubs", clubId));
        if (snap.exists()) {
          // club found - saving its data so we can display it
          setClub({ id: snap.id, ...snap.data() });
          setStatus("ready");
        } else {
          // club doesn't exist in the database
          setStatus("missing");
        }
      } catch (err) {
        // something went wrong while loading
        console.error(err);
        setStatus("error");
      }
    }
    load();
  }, [clubId]);

  // user story 7 - checking if this club is in the user's favourites list
  const favouriteClubIds = userDoc?.favouriteClubIds || [];
  // only recalculating when favourites or club ID changes
  const isFavourited = useMemo(
    () => favouriteClubIds.includes(clubId),
    [favouriteClubIds, clubId]
  );

  // checking if the logged-in user is a supporter (only supporters can favourite clubs)
  const isSupporter = userDoc?.role === "supporter";

  // reference: https://chatgpt.com/share/698654d0-163c-8004-8ed7-17dbebaba6ac
  // got help from chatgpt to understand how to build the favourites feature where users can favourite clubs
  // and see upcoming games for those clubs. learned about using arrayUnion and arrayRemove to safely add
  // and remove items from firestore arrays without duplicates, and how to query fixtures across multiple collections
  // load all fixtures for this club (including full-time); shown when club is viewed from search
  useEffect(() => {
    if (!club?.name) {
      setClubFixtures([]);
      return;
    }

    // build list of names to match: full club name plus abbreviation (e.g. first letter of each word like UCC) so fixtures with short names still match
    const fullName = club.name.trim();
    const clubNames = [fullName];
    const clubNameLower = [fullName.toLowerCase()];
    const words = fullName.split(/\s+/).filter((w) => w.length > 0);
    if (words.length > 1) {
      const abbreviation = words.map((w) => w[0]).join("").toUpperCase();
      if (abbreviation.length >= 2 && abbreviation !== fullName.toUpperCase()) {
        clubNames.push(abbreviation);
        clubNameLower.push(abbreviation.toLowerCase());
      }
    }

    // helper to check if this fixture is for this club: exact match or sensible partial match
    // also checks the venue field so junior a league games played at this club still show up under the club page
    function matchesClub(fx) {
      const home = (fx.homeTeam || "").trim();
      const away = (fx.awayTeam || "").trim();
      const venue = (fx.venue || "").trim();
      const homeLower = home.toLowerCase();
      const awayLower = away.toLowerCase();
      const venueLower = venue.toLowerCase();
      // exact matches (case-sensitive or case-insensitive)
      if (clubNames.includes(home) || clubNames.includes(away)) return true;
      if (clubNameLower.includes(homeLower) || clubNameLower.includes(awayLower) || clubNameLower.includes(venueLower)) {
        return true;
      }
      // partial matches: fixture team/venue contains the club name/abbreviation
      return clubNameLower.some(
        (n) =>
          (n && n.length >= 3) && // avoid matching on very short fragments
          (homeLower.includes(n) ||
            awayLower.includes(n) ||
            venueLower.includes(n))
      );
    }

    // fetch fixtures from each competition, keep only ones that match this club, then merge and sort
    setLoadingClubFixtures(true);
    Promise.all(
      CLUB_FIXTURE_SOURCES.map(({ compType, compId }) => {
        // point to the right firestore path (championship or league) and get all fixtures for that competition
        const col =
          compType === "championship"
            ? collection(db, "Championship", compId, "fixtures")
            : collection(db, "Leagues", compId, "fixtures");
        const q = query(col, orderBy("date", "asc"));
        return getDocs(q).then((snap) =>
          snap.docs
            .map((d) => ({ id: d.id, ...d.data(), _compType: compType, _compId: compId }))
            .filter(matchesClub)
        );
      })
    )
      .then((arrays) => {
        // flatten all results into one list and sort by date, most recent first
        const merged = arrays.flat().sort((a, b) => {
          const dateA = a.date?.toDate ? a.date.toDate().getTime() : 0;
          const dateB = b.date?.toDate ? b.date.toDate().getTime() : 0;
          return dateB - dateA; // most recent first
        });
        setClubFixtures(merged);
      })
      .catch((err) => {
        console.error("Failed to load club fixtures:", err);
        setClubFixtures([]);
      })
      .finally(() => setLoadingClubFixtures(false));
  }, [club?.name]);

  // user story 7 - function that adds or removes this club from the user's favourites
  // if the club is already favourited, clicking the button removes it
  // if the club is not favourited, clicking the button adds it
  // the button updates automatically because authcontext listens for changes in real-time
  async function toggleFavourite() {
    if (!currentUser) return;

    try {
      if (isFavourited) {
        // club is already favourited, so remove it
        await removeFavouriteClub(currentUser.uid, clubId);
      } else {
        // club is not favourited, so add it
        await addFavouriteClub(currentUser.uid, clubId);
      }
      // the button will update automatically because authcontext listens for changes
    } catch (err) {
      console.error("Failed to toggle favourite:", err);
      alert("Could not update favourites. Check Firestore rules and try again.");
    }
  }

  // showing a loading message while we fetch the club data
  if (status === "loading") {
    return (
      <div className="panel" style={{ maxWidth: 880, margin: "0 auto" }}>
        <div className="panel-head">Loading club…</div>
        <div className="panel-body muted">Please wait.</div>
      </div>
    );
  }

  // showing an error message if the club doesn't exist in the database
  if (status === "missing" || !club) {
    return (
      <div className="panel" style={{ maxWidth: 880, margin: "0 auto" }}>
        <div className="panel-head">Club not found</div>
        <div className="panel-body">
          We couldn't find a club with id <strong>{clubId}</strong>.{" "}
          <Link to="/">Back to home</Link>
        </div>
      </div>
    );
  }

  // pulling out the club information we want to display
  const { name, crest, colours = [], grades = [], location, background, division, county } = club;

  // reference: https://www.w3schools.com/jsref/jsref_tolocalestring.asp
  // format firestore timestamp or date into a short readable date and time for fixtures using todate() then tolocaledatestring
  const fmtDate = (d) => {
    if (!d) return "";
    const date = d.toDate ? d.toDate() : new Date(d);
    return date.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* button to go back to the previous page */}
      <button
        onClick={() => navigate(-1)}
        className="pill"
        style={{ width: 90 }}
        aria-label="Back"
      >
        ← Back
      </button>

      <div className="panel" style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* header section with club name and favourite button */}
        <div
          className="panel-head"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* showing the club crest image if it exists */}
            {crest ? (
              <img
                src={crest}
                alt={`${name} crest`}
                style={{ width: 44, height: 44, objectFit: "contain" }}
              />
            ) : null}
            <span style={{ fontWeight: 800 }}>{name || clubId}</span>
          </div>

          {/* user story 7 - showing different buttons/messages based on who's logged in */}
          {/* supporters get a favourite button they can click, admins see a message, others see a login link */}
          {currentUser && isSupporter ? (
            <button
              onClick={toggleFavourite}
              className="pill"
              style={{
                cursor: "pointer",
                border: "1px solid #ddd",
                fontWeight: 800,
              }}
              aria-label={isFavourited ? "Remove from favourites" : "Add to favourites"}
              title={isFavourited ? "Remove from favourites" : "Add to favourites"}
            >
              {isFavourited ? "★ Favourited" : "☆ Favourite"}
            </button>
          ) : currentUser && !isSupporter ? (
            <span className="muted" style={{ fontSize: 13 }}>
              Admin accounts can't favourite clubs.
            </span>
          ) : (
            <Link className="pill" to="/login" style={{ textDecoration: "none" }}>
              Log in to favourite
            </Link>
          )}
        </div>

        <div className="panel-body" style={{ display: "grid", gap: 18 }}>
          {/* showing the club's background description if it exists */}
          {background && <p style={{ margin: 0 }}>{background}</p>}

          {/* displaying club information as small chips/tags */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {/* showing division if the club has one */}
            {division && (
              <span className="chip" title="Division">
                {division}
              </span>
            )}
            {/* showing county if available */}
            {county && (
              <span className="chip" title="County">
                {county}
              </span>
            )}
            {/* showing location if provided */}
            {location && (
              <span className="chip" title="Location">
                {location}
              </span>
            )}

            {/* looping through club colours and showing each one as a chip */}
            {Array.isArray(colours) &&
              colours.map((c) => (
                <span key={c} className="chip" title="Club colours">
                  {c}
                </span>
              ))}

            {/* looping through grades and showing each one as a chip */}
            {Array.isArray(grades) &&
              grades.map((g) => (
                <span key={g} className="chip" title="Grade">
                  {g}
                </span>
              ))}
          </div>

          {/* fixtures for this club (including full-time; full-time games are not shown on home page) */}
          <div style={{ marginTop: 24 }}>
            <h3 style={{ marginBottom: 12 }}>Fixtures &amp; results</h3>
            {loadingClubFixtures ? (
              <p className="muted">Loading fixtures…</p>
            ) : clubFixtures.length === 0 ? (
              <p className="muted">No fixtures found for this club.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* list of cards, one per fixture or result for this club */}
                {clubFixtures.map((fx) => {
                  const homeGoals = fx.homeGoals ?? 0;
                  const homePoints = fx.homePoints ?? 0;
                  const awayGoals = fx.awayGoals ?? 0;
                  const awayPoints = fx.awayPoints ?? 0;
                  const compType = fx._compType || "league";
                  const compId = fx._compId || "";

                  return (
                    <div
                      key={`${compType}-${compId}-${fx.id}`}
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
                        {/* top row: home team, score, away team */}
                        <span>{fx.homeTeam}</span>
                        <span>
                          {homeGoals}:{homePoints} – {awayGoals}:{awayPoints}
                        </span>
                        <span>{fx.awayTeam}</span>
                      </div>
                      {/* match date and status (upcoming, live, full time, etc.) */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: 12,
                          opacity: 0.85,
                          marginBottom: 4,
                        }}
                      >
                        <span>{fmtDate(fx.date)}</span>
                        <span style={{ textTransform: "capitalize" }}>
                          {fx.status || "upcoming"}
                        </span>
                      </div>
                      {/* show view match report button only when game is published and full time */}
                      {fx.published && fx.status === "full time" && (
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                          <button
                            className="chip"
                            onClick={() => navigate(`/report/${compType}/${compId}/${fx.id}`)}
                          >
                            View Match Report
                          </button>
                        </div>
                      )}
                      {/* button to open the live timeline page; label is "Show Match Timeline" when published, "Show Live Match Updates" when not (reporter feedback) */}
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
                        <button
                          className="chip"
                          onClick={() => navigate(`/fixture/${compType}/${compId}/${fx.id}`)}
                        >
                          {fx.published ? "Show Match Timeline" : "Show Live Match Updates"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
