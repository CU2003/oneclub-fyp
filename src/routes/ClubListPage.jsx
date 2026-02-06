// page that shows all clubs from the database
// pulls clubs from Firestore `clubs` collection (Cork GAA dataset)

import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Link } from "react-router-dom";
import { db } from "../firebase";

export default function ClubListPage() {
  const [clubs, setClubs] = useState([]); // storing all clubs from the database
  const [loading, setLoading] = useState(true); // tracking if we're still loading clubs
  const [search, setSearch] = useState(""); // what the user types in the search box

  // loading clubs from Firestore when the page first loads
  useEffect(() => {
    async function loadClubs() {
      try {
        setLoading(true);

        // query all clubs and sort them alphabetically by name
        const q = query(collection(db, "clubs"), orderBy("name", "asc"));
        const snap = await getDocs(q);
        // convert Firestore documents into a simple array of club objects
        setClubs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load clubs:", err);
      } finally {
        setLoading(false);
      }
    }

    loadClubs();
  }, []);

  // filtering clubs based on what the user searches for
  // only recalculates when clubs or search text changes
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return clubs; // if search is empty, show all clubs
    // otherwise only show clubs whose name matches the search
    return clubs.filter((c) => (c.name || "").toLowerCase().includes(s));
  }, [clubs, search]);

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 12 }}>Clubs</h1>

      {/* search box and club count */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clubs..."
          style={{
            width: "100%",
            maxWidth: 420,
            padding: "10px 12px",
            borderRadius: 8,
            border: "1px solid #ccc",
          }}
        />
        {/* showing how many clubs match the search */}
        <div style={{ fontSize: 14, opacity: 0.7 }}>
          {loading ? "Loading..." : `${filtered.length} clubs`}
        </div>
      </div>

      {/* showing different messages based on loading state */}
      {loading ? (
        <p>Loading clubs…</p>
      ) : filtered.length === 0 ? (
        <p>No clubs found.</p>
      ) : (
        // grid layout that automatically fits clubs into columns
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 12,
          }}
        >
          {/* rendering each club as a clickable card */}
          {filtered.map((club) => {
            const clubId = club.clubId || club.id;
            return (
              <Link
                key={clubId}
                to={`/club/${clubId}`}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                {/* club card that shows name, division, county, and ID */}
                <div
                  style={{
                    border: "1px solid #e5e5e5",
                    borderRadius: 12,
                    padding: 14,
                    background: "white",
                    cursor: "pointer",
                    height: "100%",
                  }}
                >
                  <div style={{ fontWeight: 700 }}>{club.name}</div>
                  {/* showing division and county if they exist */}
                  <div style={{ fontSize: 13, opacity: 0.7, marginTop: 6 }}>
                    {club.division ? `Division: ${club.division}` : null}
                    {club.county ? ` • County: ${club.county}` : null}
                  </div>
                  {/* showing the club ID for reference */}
                  <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
                    ID: {clubId}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
