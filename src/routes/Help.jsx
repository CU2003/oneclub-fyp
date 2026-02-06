// simple, static help page
// no database or react calls
// contains contact info for customers to reach out
// for easy navigation, and finding out info about oneclub - could be changed based on admin
// Reference - used W3Schools to assist with this, https://www.w3schools.com/
export default function Help() {
  return (
    // content under the nav bar, flex used to center panel in the middle of the page
    <div
      style={{
        padding: "32px 16px",         // space below the nav bar, avoids sticking
        display: "flex",
        justifyContent: "center",     // center the card
      }}
    >

      <div
        className="panel"
        style={{
          width: "min(720px, 92vw)",
          margin: "0 auto",
        }}
      >
        <div className="panel-head" style={{ textAlign: "center" }}>
          Help & Feedback
        </div>

        {/* Heading for page */}
        <div className="panel-body" style={{ textAlign: "center", lineHeight: 1.6 }}>
          <p>Got a suggestion, found an issue or looking to sign-up? I’d love to hear it.</p>

          {/* Centered, clean list */}
          <ul
            style={{
              listStyle: "disc",            // use bullets
              listStylePosition: "inside",  // keep bullets with centered text block
              padding: 0,
              margin: "8px 0 14px",
            }}
          >
            <li>
                {/* Email link opens the user’s default mail app */}
              Email: <a href="mailto:OneClub@gmail.com">OneClub@gmail.com</a>
            </li>
            <li>If looking to sign up, please provide competition and team!</li>
          </ul>


        </div>
      </div>
    </div>
  );
}
