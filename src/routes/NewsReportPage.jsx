// shows one published news report by id from the url
// loads the report from firestore news collection and displays title, date, author, and body.
// App.jsx, Home.jsx
// ReporterDashboard.jsx (reporters create and publish the reports that end up here).

import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

// page that shows a single published news report; id comes from the url (/news/:id)
export default function NewsReportPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // load the news document for this id from firestore; set report or error and clear loading
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setError("Missing report id.");
      return;
    }
    const ref = doc(db, "news", id);
    getDoc(ref)
      .then((snap) => {
        if (snap.exists()) {
          // include doc id with the rest of the fields so we have everything in one object
          setReport({ id: snap.id, ...snap.data() });
        } else {
          setError("Report not found.");
        }
      })
      .catch((err) => {
        console.error(err);
        setError("Could not load report.");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // same pattern as in Home.jsx; reference: https://www.w3schools.com/jsref/jsref_tolocalestring.asp
  // format firestore timestamp for display (day, month, year, time)
  const fmtDate = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString([], {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div style={{ maxWidth: 720, margin: "2rem auto", padding: "1rem" }}>
      {/* back button goes to previous page */}
      <button type="button" onClick={() => navigate(-1)} style={{ marginBottom: "1rem" }}>
        ← Back
      </button>
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}
      {/* only show article when we have report data and are not loading; title, date, author, body */}
      {report && !loading && (
        <article
          style={{
            background: "#fff",
            padding: "1.5rem",
            borderRadius: 8,
            boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.5rem" }}>
            {report.title || "Untitled"}
          </h1>
          <div style={{ fontSize: "0.9rem", color: "#64748b", marginBottom: "1rem" }}>
            {fmtDate(report.publishedAt)}
            {report.author ? ` · ${report.author}` : ""}
          </div>

          {/* cover image for the report if the reporter uploaded one */}
          {report.coverImageUrl && (
            <div style={{ marginBottom: "1.5rem" }}>
              <img
                src={report.coverImageUrl}
                alt={report.title || "Report cover"}
                style={{
                  width: "100%",
                  maxHeight: 320,
                  objectFit: "cover",
                  borderRadius: 10,
                }}
              />
            </div>
          )}

          {/* body text; pre-wrap keeps line breaks as entered in the report */}
          <div
            style={{
              fontSize: "1rem",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {report.body || ""}
          </div>
        </article>
      )}
    </div>
  );
}
