// gaa lineup pitch – shows 15 players on a pitch in standard gaa formation (1-3-3-2-3-3)
// used when lineup is confirmed on fixture timeline so supporters see who is playing where
// layout reference: css grid / flex for rows – similar idea to winkerVSbecks/formations (github)
// chatgpt lineup layout reference: https://chatgpt.com/share/69a18c1b-0f08-8004-a65e-99e68c025dfa
// used chat gpt to help me design and fit the gaa pitch layout into my own code.

// gaa positions by jersey number: 1 keeper; 2–4 full backs; 5–7 half backs; 8–9 midfield; 10–12 half forwards; 13–15 full forwards
// this array says how many players go in each line on the pitch from back to front
const ROWS = [
  { label: "Goalkeeper", count: 1 },
  { label: "Full backs", count: 3 },
  { label: "Half backs", count: 3 },
  { label: "Midfield", count: 2 },
  { label: "Half forwards", count: 3 },
  { label: "Full forwards", count: 3 },
];

export default function GaaLineupPitch({ players = [], teamName = "", accentColor = "#1976d2" }) {
  // players is expected to be an array of names in jersey order (1-15)
  // copy into a local list and pad with empty strings so we always show a full 15
  const list = Array.isArray(players) ? [...players] : [];
  while (list.length < 15) list.push("");

  // build the rows for the pitch using the row config above
  // i tracks the jersey number and position in the players list
  let i = 0;
  const rows = ROWS.map(({ label, count }) => {
    const rowPlayers = [];
    for (let s = 0; s < count; s++) {
      // number is jersey number (1-15), name is the player name or empty
      rowPlayers.push({ number: i + 1, name: list[i] || "" });
      i++;
    }
    // label is not shown for now but kept for clarity and possible future use
    return { label, players: rowPlayers };
  });

  return (
    <div style={{ marginBottom: "1rem" }}>
      {/* show team name above the pitch so supporters know which side this is */}
      {teamName && (
        <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.95rem", fontWeight: 700 }}>
          {teamName}
        </h4>
      )}
      {/* pitch background container – simple green gradient with rounded corners */}
      <div
        style={{
          background: "linear-gradient(180deg, #2d5a2d 0%, #3d7a3d 100%)",
          borderRadius: 12,
          padding: "0.75rem",
          position: "relative",
          overflow: "hidden",
          boxShadow: "inset 0 0 0 2px rgba(0,0,0,0.15)",
        }}
      >
        {/* faint pitch grid lines for visual texture only (no interaction) */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)
            `,
            backgroundSize: "20px 20px",
            pointerEvents: "none",
            borderRadius: 12,
          }}
        />
        {/* players and rows sit inside this layer so they render above the grid */}
        <div style={{ position: "relative", zIndex: 1 }}>
          {/* render each line of the formation (full backs, half backs, midfield, forwards, keeper) */}
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              style={{
                display: "flex",
                justifyContent: "space-around",
                alignItems: "center",
                gap: 4,
                minHeight: 44,
                marginBottom: rowIndex < rows.length - 1 ? 4 : 0,
              }}
            >
              {/* render each player circle and name in this line */}
              {row.players.map((p) => (
                <div
                  key={p.number}
                  style={{
                    flex: "1",
                    maxWidth: 120,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {/* jersey circle – white background, coloured border and number in the middle */}
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "50%",
                      background: "#fff",
                      color: accentColor,
                      fontWeight: 700,
                      fontSize: 14,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
                      border: `2px solid ${accentColor}`,
                    }}
                  >
                    {p.number}
                  </div>
                  {/* player name under the circle – if name is missing show a dash */}
                  <span
                    style={{
                      fontSize: 10,
                      color: "#fff",
                      textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                      marginTop: 2,
                      textAlign: "center",
                      maxWidth: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {p.name || "—"}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
