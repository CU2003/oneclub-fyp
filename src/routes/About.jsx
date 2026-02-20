// simple static about page for oneclub..
// no database or state here - r

export default function About() {
  return (
    // Full-width wrapper under the navbar
    <div
      style={{
        padding: "32px 16px",
        display: "flex",
        justifyContent: "center",      //  center horizontally
      }}
    >
      {/* main card that holds the content */}
      <div
        className="panel"
        style={{
          width: "min(720px, 92vw)",
          margin: "0 auto",
        }}
      >

        <div className="panel-head" style={{ textAlign: "center" }}>
          About OneClub
        </div>

          {/* Card title */}
        <div className="panel-body" style={{ textAlign: "center", lineHeight: 1.6 }}>
            {/* Intro sentence that explains the web app*/}
          <p style={{ marginBottom: 12 }}>
            <strong>OneClub</strong> brings live fixtures, league standings and news
            together for GAA Hurling and Football across Cork.
          </p>

          <ul
            style={{
              listStyle: "none", // clean centered list with bulletpoints
              padding: 0,
              margin: "8px 0 14px",
            }}
          >
            <li>Quick Updates</li>
            <li>Ongoing Match Timelines</li>
            <li>Trusted Source</li>
          </ul>

          <p>Brings GAA fans young and old around the county together.</p>
        </div>
      </div>
    </div>
  );
}
