// this page shows information about one specific club
// it reads the club ID from the web address and then fetches that club's data from the database

// reference: https://react.dev/reference/react/useMemo
// useMemo hook to check if a club is in the user's favourites list.
// line 57

// Reference: Line 156 - Star Symbol (★, ☆, ⚝) - Copy and Paste Text Symbols - Symbolsdb.com
// used to get favourite symbol

import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

// importing functions to check if user is logged in and to add/remove favourites
import { useAuth } from "../AuthContext";
import { addFavouriteClub, removeFavouriteClub } from "../userService";

export default function ClubPage() {
  // getting the club ID from the web address (like /club/kilbrittain)
  const { clubId } = useParams();
  // storing the club data we load from the database
  const [club, setClub] = useState(null);
  // tracking whether we're loading, found the club, or had an error
  const [status, setStatus] = useState("loading");

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

  // reference
  // got help from chatgpt to understand how to build the favourites feature where users can favourite clubs
  // and see upcoming games for those clubs. learned about using arrayUnion and arrayRemove to safely add
  // and remove items from firestore arrays without duplicates, and how to query fixtures across multiple collections
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

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* button to go back to the previous page */}
      <button
        onClick={() => history.back()}
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
        </div>
      </div>
    </div>
  );
}
