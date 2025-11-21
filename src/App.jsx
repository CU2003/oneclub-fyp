// Routing structure (Routes, Route, Link, useNavigate) was based on examples from
// the official React Router documentation and adapted to fit the OneClub pages.
// React Router (2025), "Basic Example" and "Introduction".
// https://reactrouter.com/6.28.0/start/tutorial Lines 1 - 51 ~

// brings in main css styling
import "./App.css";

// from react router
// route/routes decide which page to show for each url
// link - moves between pages w no reload
// useNavigate changes page from code
import { Routes, Route, Link, useNavigate } from "react-router-dom";
import { useState } from "react";

// different page components in the app
import Home from "./routes/Home.jsx";
import LeaguePage from "./routes/LeaguePage.jsx";
import ClubPage from "./routes/ClubPage.jsx";
import About from "./routes/About.jsx";
import Help from "./routes/Help.jsx";

// admin related pages
import AdminLogin from "./routes/AdminLogin.jsx";
import AdminMatchConsole from "./routes/AdminMatchConsole.jsx";


import ProtectedRoute from "./ProtectedRoute.jsx"; // stops unauthorised users from admin console
import { AuthProvider } from "./AuthContext.jsx"; // access to whole web app for logged in users


function slugify(str) {
  return (str || "")
    .toLowerCase() // small letters
    .trim() // removes spaces start and end
    .replace(/&/g, "and") // changes & to and
    .replace(/[^a-z0-9]+/g, "-") // replaces anything not a letter/number to -
    .replace(/^-+|-+$/g, ""); // remove - from start and end
}

// main react component - controls nav bar, search bar and what page to show for url
export default function App() {
  const [q, setQ] = useState(""); // current tect in search bar - function changes value of q when user types
  const navigate = useNavigate(); // function to move to another page

  function onSearchSubmit(e) { // runs when user submits search form
    e.preventDefault(); // stops browser from doing normal form submit
    const slug = slugify(q); // turns what typed into a slug
    if (!slug) return; // if empty, do nothing
    navigate(`/club/${slug}`); // goes to club page for that slug
  }

  // what the web app displays on screen
  return (
    <AuthProvider>  {/* wraps web app in authprovider so pages know whos logged in */}
      <>
        <header className="navbar" role="banner" aria-label="OneClub">
          <div className="navbar-inner">
            <Link to="/" className="brand" style={{ textDecoration: "none" }}>  {/* Logo, when clicked back to homepage */}
              OneClub
            </Link>

            {/* Search bar */}
            <form className="search" onSubmit={onSearchSubmit}>
              <svg
                className="search-icon" // search icon
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M15.5 14h-.79l-.28-.27a6.471 6.471 0 001.48-4.23C15.91 6.01 13.4 3.5 10.45 3.5S5 6.01 5 9.5 7.51 15.5 10.45 15.5c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l4.25 4.25c.41.41 1.08.41 1.49 0s.41-1.08 0-1.49L15.5 14zm-5.05 0C8.01 14 6 11.99 6 9.5S8.01 5 10.45 5s4.45 2.01 4.45 4.5S12.89 14 10.45 14z"
                />
              </svg>
               {/* Text box for user searching club - done in further iterations, only can search st finbarrs atm */}
              <input
                className="search-input"
                placeholder="Search clubs, competitions…"
                aria-label="Search"
                value={q} // shows current search text
                onChange={(e) => setQ(e.target.value)} // update text - q -  when they type
              />
            </form>

            {/* Settings menu */}
            <nav className="nav-actions">
              <details className="settings-menu"> {/* dropdown menu when clicked */}
                <summary
                  className="icon-btn" // button that opens menu
                  aria-label="Settings"
                  role="button"
                >
                  ⚙️
                </summary>
                <ul className="menu"> {/* The dropdown list of menu links */}
                  <li>
                    <Link to="/about">About OneClub</Link>
                  </li>
                  <li>
                    <Link to="/help">Help & Feedback</Link>
                  </li>
                  <li>
                    <Link to="/admin-login">Admin login</Link>
                  </li>
                </ul>
              </details>
            </nav>
          </div>
        </header>

        {/* choose which page to show based on url */}
        <main className="page">
          <Routes>
            <Route path="/" element={<Home />} />  {/* show live games - to be changed for iteration 3 - ongoing along with scheduled*/}
            <Route path="/league/:leagueId" element={<LeaguePage />} /> {/* league page */}
            <Route path="/club/:clubId" element={<ClubPage />} /> {/* club page*/}
            <Route path="/about" element={<About />} /> {/* about page - static - possible change */}
            <Route path="/help" element={<Help />} /> {/* help page - possible change */}
            <Route path="/admin-login" element={<AdminLogin />} /> {/* Admin login */}

            {/* Admin console page - only for auth users */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute> {/* checks if user logged in before showing*/}
                  <AdminMatchConsole />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </>
    </AuthProvider>
  );
}
