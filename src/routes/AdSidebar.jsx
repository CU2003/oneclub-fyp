// advertisements sidebar - reads ad / sponsor entries from firestore so they are not hard coded
// each document in the "advertisements" collection can have:
// - title (string)            -> short name for the sponsor
// - imageUrl (string, optional) -> logo or banner image url (firebase storage or any public url)
// - linkUrl (string, optional)  -> where the user goes when they click the ad
// - active (boolean, optional)  -> whether this ad is currently selected to show (defaults to true if missing)
// - positions (array or string, optional) -> where the ad is allowed to appear, e.g. ["home-left", "league-left"]
// - order (number, optional)    -> lower numbers appear first
//
// this file acts like a simple ads api: you pick which ads are active and where they can appear
// by editing documents in firestore, and the ui just reads and displays them.
//
// reference: https://firebase.google.com/docs/firestore/query-data/listen
// used firestore's onSnapshot to listen for changes in the advertisements collection so the sidebar updates automatically.

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export default function AdSidebar({ position = "home-left" }) {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const col = collection(db, "advertisements");

    const unsub = onSnapshot(
      col,
      (snapshot) => {
        const all = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        // only keep ads that are active (or have no active flag, which we treat as active)
        const activeAds = all.filter((ad) =>
          ad.active === undefined ? true : ad.active === true
        );

        // filter by position if provided:
        // - if positions is an array, check array-contains
        // - if positions is a string, match directly
        // - if no positions field, show everywhere
        const positioned = activeAds.filter((ad) => {
          if (!position) return true;
          const pos = ad.positions;
          if (Array.isArray(pos)) return pos.includes(position);
          if (typeof pos === "string") return pos === position;
          return true;
        });

        // sort by optional order field so you can control display order in firestore
        positioned.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

        setAds(positioned);
        setLoading(false);
      },
      (err) => {
        console.warn("AdSidebar: could not load advertisements", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [position]);

  if (loading || ads.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {ads.map((ad) => {
        const href = ad.linkUrl || "#";
        const title = ad.title || "Sponsor";
        const hasImage = typeof ad.imageUrl === "string" && ad.imageUrl.trim() !== "";

        const cardStyle = {
          display: "block",
          borderRadius: 10,
          overflow: "hidden",
          background: "var(--panel, #ffffff)",
          border: "1px solid var(--panel-line, #e6e8ee)",
          textDecoration: "none",
          color: "inherit",
        };

        return (
          <a
            key={ad.id}
            href={href}
            target={href && href !== "#" ? "_blank" : "_self"}
            rel="noopener noreferrer"
            style={cardStyle}
            title={title}
          >
            {hasImage ? (
              <img
                src={ad.imageUrl}
                alt={title}
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  maxHeight: 120,
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                style={{
                  padding: "12px 14px",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                }}
              >
                {title}
              </div>
            )}
          </a>
        );
      })}
    </div>
  );
}

