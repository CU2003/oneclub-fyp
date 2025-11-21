// shows single club page based on the url id - :club/:clubid
// reads clubsid from the url
// then asks firestore for clubs id
// while waiting, shows loading
// if not found dont show and if found show crest, name, background etc. TO BE ADDED ON WITH FURTHER CLUBS NOTE!!!

import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export default function ClubPage() {
  const { clubId } = useParams(); //  reads the url paramerter. e.g.: /club/st-finbarrs - "st-finbarrs"
  const [club, setClub] = useState(null); //local state for the club doc and simple status flags such as loading, ready etc.
  const [status, setStatus] = useState("loading");

  // fetch /clubs/:clubId once when clubid changes
  useEffect(() => { // make an inner async function so we can use await cleanly
    async function load() {
      try {
        // builds a reference to /clubs/:clubdid and fetches it
        // fetches clubid by going to database, then club, then club id in firebase
        // reference: https://www.w3schools.com/react/react_hooks.asp
        // When the component loads (or clubId changes), try to get this club from Firestore.
        // finds it, save its data (plus the id) and mark the status as "ready".
        // If missing or there’s an error, set the status to "missing" or "error".
        // lines 28 - 41
        const snap = await getDoc(doc(db, "clubs", clubId));
        if (snap.exists()) { // checking if document exists
          setClub({ id: snap.id, ...snap.data() }); // merges into one object
          setStatus("ready");
        } else {
          setStatus("missing");
        }
      } catch (err) { //
        console.error(err);
        setStatus("error");
      }
    }
    load();
  }, [clubId]);

  if (status === "loading") {
    return (
      <div className="panel" style={{ maxWidth: 880, margin: "0 auto" }}>
        <div className="panel-head">Loading club…</div>
        <div className="panel-body muted">Please wait.</div>
      </div>
    );
  }

  if (status === "missing" || !club) {
    return (
      <div className="panel" style={{ maxWidth: 880, margin: "0 auto" }}>
        <div className="panel-head">Club not found</div>
        <div className="panel-body">
          We couldn’t find a club with id <strong>{clubId}</strong>.{" "}
          <Link to="/">Back to home</Link>
        </div>
      </div>
    );
  }

  // if success, shows crest using the image url, colours and grades using arrays, location string and background
  const { name, crest, colours = [], grades = [], location, background } = club;

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Simple back button (uses browser history) */}
      <button
        onClick={() => history.back()}
        className="pill"
        style={{ width: 90 }}
        aria-label="Back"
      >
        ← Back
      </button>

      {/* Main club panel */}
      <div className="panel" style={{ maxWidth: 980, margin: "0 auto" }}>
        <div className="panel-head" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {crest ? (
            <img
              src={crest}
              alt={`${name} crest`}
              style={{ width: 44, height: 44, objectFit: "contain" }}
            />
          ) : null}
          <span style={{ fontWeight: 800 }}>{name || clubId}</span>
        </div>

        {/* Body: background text, soe infor and at a glance card */}
        <div className="panel-body" style={{ display: "grid", gap: 18 }}>
          {background && <p style={{ margin: 0 }}>{background}</p>}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {location && (
              <span className="chip" title="Location">
                📍 {location}
              </span>
            )}
            {/* reference: https://www.w3schools.com/react/react_lists.asp
              If colours is a list, show a small chip for each colour shows colour icon
              If grades is a list, show a chip for each grade shows trophy
              Each chip uses a key so React can track it, and title shows a tooltip on hover.*/}
            {Array.isArray(colours) &&
              colours.map((c) => (
                <span key={c} className="chip" title="Club colours">
                  🎨 {c}
                </span>
              ))}
            {Array.isArray(grades) &&
              grades.map((g) => (
                <span key={g} className="chip" title="Grade">
                  🏆 {g}
                </span>
              ))}
          </div>

          {/* small static section - can later try get to read from Firestore - NOTE: NEED MORE FIXTURES TO DO THIS, DATA */}
          <div className="card">
           <div className="card-title">At a glance</div>
           <ul className="list">
             <li><strong>Nickname:</strong> The Barrs</li>
             <li><strong>Colours:</strong> Blue and Gold</li>
             <li><strong>Location:</strong> Togher, Cork (southside)</li>
             <li><strong>Codes:</strong> Dual senior club in <em>Hurling</em> and <em>Football</em></li>
             <li><strong>Tradition:</strong> One of Cork’s most decorated dual clubs with numerous senior county titles; regular contenders at the top level</li>
             <li><strong>Player pathway:</strong> Strong underage structure and a steady producer of Cork inter-county players</li>
             <li><strong>Home:</strong> St Finbarr’s GAA grounds, Togher</li>
          </ul>
        </div>

        </div>
      </div>
    </div>
  );
}
