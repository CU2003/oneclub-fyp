// user story 1
// this is the main app file that sets up all the pages and navigation
// it handles routing between different pages, shows the navigation bar at the top,
// and manages which pages users can see based on whether they're logged in
// the search bar lets users find clubs, and the settings menu shows different options
// depending on whether someone is logged in or not

// reference: https://firebase.google.com/docs/auth/web/password-auth#next_steps
// signOut function to log users out
// line 64 - calls auth.signOut() to sign the user out and then sends them back to the home page.

// reference: routing structure based on React Router documentation
// https://reactrouter.com/6.28.0/start/tutorial Lines 1 - 51 ~

import "./App.css";

import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { collection, getDocs, query, where, limit } from "firebase/firestore";
import { db } from "./firebase";

// importing all the different pages in the app
import Home from "./routes/Home.jsx";
import LeaguePage from "./routes/LeaguePage.jsx";
import ClubPage from "./routes/ClubPage.jsx";
import About from "./routes/About.jsx";
import Help from "./routes/Help.jsx";
import Login from "./routes/Login.jsx";
import ClubListPage from "./routes/ClubListPage.jsx";


import AdminLogin from "./routes/AdminLogin.jsx";
import AdminMatchConsole from "./routes/AdminMatchConsole.jsx";

// user story #11 - this is the page that shows the full match report with all the details
import MatchReporter from "./routes/MatchReporter.jsx";
import ProtectedRoute from "./ProtectedRoute.jsx";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { auth } from "./firebase";


// converting text into a safe format for URLs
// turns "Kilbrittain GAA" into "kilbrittain-gaa" so it works in web addresses
// this is used by the search box to create a web address when someone searches for a club
function slugify(str) {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// main content component that needs access to user authentication
// split from App because useAuth hook must be inside AuthProvider
function AppContent() {
  // user story 2 - storing what the user types in the search box
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { currentUser, userDoc } = useAuth(); // getting logged-in user and their profile

  // user story 2 - when the user presses enter or clicks search, find the club and take them to the club page
  // first tries to find a club by name in firestore, then navigates to the correct club ID
  async function onSearchSubmit(e) {
    e.preventDefault();
    const searchTerm = q.trim();
    if (!searchTerm) return;

    try {
      // first try to find a club by name in firestore
      // this handles cases where the document ID doesn't match the search term (like UCC_ID vs "UCC")
      const clubsRef = collection(db, "clubs");
      const searchLower = searchTerm.toLowerCase();
      
      // get all clubs and filter by name (firestore doesn't support case-insensitive search easily)
      const allClubs = await getDocs(clubsRef);
      const matchingClub = allClubs.docs.find((doc) => {
        const clubData = doc.data();
        const clubName = (clubData.name || "").toLowerCase();
        return clubName.includes(searchLower) || clubName === searchLower;
      });

      if (matchingClub) {
        // found a club by name, navigate to its actual document ID
        navigate(`/club/${matchingClub.id}`);
      } else {
        // no club found by name, try the slugified version as fallback
        const slug = slugify(searchTerm);
        navigate(`/club/${slug}`);
      }
    } catch (err) {
      console.error("Error searching for club:", err);
      // fallback to slugified version if search fails
      const slug = slugify(searchTerm);
      navigate(`/club/${slug}`);
    }
  }

  // signing the user out and taking them back to home page
  function handleLogout() {
    auth.signOut();
    navigate("/");
  }

  return (
    <>
      <header className="navbar" role="banner" aria-label="OneClub">
        <div className="navbar-inner">
          <Link to="/" className="brand" style={{ textDecoration: "none" }}>
            OneClub
          </Link>

          {/* user story 2 - search box for finding clubs */}
          {/* when someone types a club name and presses enter, it takes them to that club's page */}
          <form className="search" onSubmit={onSearchSubmit}>
            {/* search icon that appears on the left side of the input box */}
            <svg
              className="search-icon"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M15.5 14h-.79l-.28-.27a6.471 6.471 0 001.48-4.23C15.91 6.01 13.4 3.5 10.45 3.5S5 6.01 5 9.5 7.51 15.5 10.45 15.5c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0s.41-1.08 0-1.49L15.5 14zm-5.05 0C8.01 14 6 11.99 6 9.5S8.01 5 10.45 5s4.45 2.01 4.45 4.5S12.89 14 10.45 14z"
              />
            </svg>

            {/* the text box where users type what they're looking for */}
            <input
              className="search-input"
              placeholder="Search clubs, competitions…"
              aria-label="Search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </form>

          {/* settings menu and logout button */}
          <nav className="nav-actions">
            {/* showing logout button when someone is logged in */}
            {currentUser && (
              <button
                onClick={handleLogout}
                className="icon-btn"
                style={{
                  marginRight: "8px",
                  padding: "8px 12px",
                  fontSize: "14px",
                  fontWeight: 600,
                }}
                title="Logout"
              >
                Logout
              </button>
            )}
            <details className="settings-menu">
              <summary className="icon-btn" aria-label="Settings" role="button">
                Settings
              </summary>
              <ul className="menu">
                <li>
                  <Link to="/about">About OneClub</Link>
                </li>
                <li>
                  <Link to="/help">Help & Feedback</Link>
                </li>

                <li>
                  <Link to="/clubs">Club listing</Link>
                </li>

                {/* showing different menu items based on login status */}
                {!currentUser ? (
                  <>
                    <li>
                      <Link to="/login">Login / Sign up</Link>
                    </li>
                  </>
                ) : (
                  <>
                    {/* displaying who's logged in and their role */}
                    <li style={{ padding: "8px 12px", borderTop: "1px solid var(--panel-line)", marginTop: "4px" }}>
                      <span style={{ fontSize: "12px", opacity: 0.7 }}>
                        Logged in as: {currentUser.email}
                        {userDoc?.role && (
                          <span style={{ textTransform: "capitalize", marginLeft: "4px" }}>
                            ({userDoc.role})
                          </span>
                        )}
                      </span>
                    </li>
                  </>
                )}
              </ul>
            </details>
          </nav>
        </div>
      </header>

        <main className="page">
          {/* user story 1 - defining all the different pages and their web addresses */}
          {/* when someone visits a web address like /club/kilbrittain, it shows the right page */}
          <Routes>
            <Route path="/" element={<Home />} />

            <Route path="/login" element={<Login />} />

            <Route path="/clubs" element={<ClubListPage />} />

            <Route path="/league/:leagueId" element={<LeaguePage />} />
            <Route path="/club/:clubId" element={<ClubPage />} />
            <Route path="/about" element={<About />} />
            <Route path="/help" element={<Help />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            {/* user story #11 - route for the match report page */}
            {/* this route takes three pieces of information from the url: */}
            {/* competitionType = "championship" or "league" */}
            {/* competitionId = e.g. "munster-championship" or "sigerson-cup" */}
            {/* fixtureId = the unique id of the specific game */}
            {/* when someone visits /report/championship/sigerson-cup/abc123, it shows the match report for that game */}
            <Route path="/report/:competitionType/:competitionId/:fixtureId" element={<MatchReporter />} />

            {/* admin console is protected - only logged-in admins can access it */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminMatchConsole />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </>
  );
}

// main app component that wraps everything with authentication provider
// this makes user login state available to all pages
export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}