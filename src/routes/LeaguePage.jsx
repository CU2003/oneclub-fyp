// Firestore query and real-time listener patterns in this file are adapted from:
// Google Firebase (2025), "Get data with Cloud Firestore" and
// "Listen to real-time updates with Cloud Firestore" documentation.
// https://firebase.google.com/docs/firestore/query-data/get-data + https://firebase.google.com/docs/firestore/query-data/listen
// Lines 1 - 65 ~

// show standings for a signle league based on the URL id /league/:leagueid
import { useParams, Link } from "react-router-dom"; // read values from the URL, and make a back link
import { useEffect, useState } from "react"; // run code after render, and store page data
import { db } from "../firebase"; // firestore database connection
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit
} from "firebase/firestore";

// small helper: display + for positive numbers
const fmtSigned = (n) => (n > 0 ? `+${n}` : `${n}`);

export default function LeaguePage() {
  // reads league id from url
  const { leagueId } = useParams();
  const [league, setLeague] = useState(null); // object with name etc
  const [rows, setRows] = useState([]); // array of standings rows

  useEffect(() => {
    // Load league details
    getDoc(doc(db, "Leagues", leagueId)).then((snap) => {
      if (snap.exists()) {
        console.log("League loaded:", snap.data());
        setLeague(snap.data());
      } else {
        // if nothing found for that id, keep going and it will show below
        console.warn("No league found for", leagueId);
      }
    });

    // Subscribe to standings data
    const q = query(
      collection(db, "Leagues", leagueId, "standings"),
      orderBy("points", "desc"),
      orderBy("scoreDiff", "desc"), // ordered by points desc then scoreDiff desc
      limit(10) // limited to 10 rows
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc, index) => ({
        rank: index + 1,
        id: doc.id,
        ...doc.data(),
      }));
      console.log("Standings snapshot:", data);
      setRows(data);
    });

    return () => unsub();
  }, [leagueId]);

  // layout
  return (
    <div className="layout">
      <aside className="left" />
      <section className="center" aria-label="League standings">
        {/* back button */}
        <div className="toolbar">
          <Link className="pill" to="/">← Back</Link>
          <div className="spacer" />
        </div>

        {/* Standings panel */}
        <div className="panel">
          <div className="panel-head">
            {league ? league.name : "Loading league..."}
          </div>

          {/* Panel body: either a message or a table of rows */}
          <div className="panel-body">
            {rows.length === 0 ? (
              <p className="muted">No standings yet...</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "8px 6px" }}>#</th>
                    <th style={{ textAlign: "left", padding: "8px 6px" }}>Team</th>
                    <th>P</th>
                    <th>W</th>
                    <th>D</th>
                    <th>L</th>
                    <th>+/-</th>
                    <th>Pts</th>
                  </tr>
                </thead>
                <tbody>
                {/* Reference: https://www.w3schools.com/react/react_lists.asp - used ChatGPT to assist with understanding this link and implmentation */}
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--panel-line)" }}>
                      <td style={{ padding: "8px 6px" }}>{r.rank}</td>
                      <td style={{ padding: "8px 6px" }}>{r.club}</td>
                      <td>{r.played ?? 0}</td>
                      <td>{r.won ?? 0}</td>
                      <td>{r.drawn ?? 0}</td>
                      <td>{r.lost ?? 0}</td>
                      <td>{fmtSigned(r.scoreDiff ?? 0)}</td>
                      <td><strong>{r.points ?? 0}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>
      <aside className="right" />
    </div>
  );
}
