# references used in OneClub 

# deploying the web app
- https://www.youtube.com/watch?v=Q-FZVGJEYCQ
- Firebase CLI was used to initialise and configure Firebase Hosting for the project. Following an online tutorial, the application was built locally and then deployed using Firebase Hosting, making it accessible via a live URL. This allowed the system to be tested 
- in a production environment and confirmed that real-time updates functioned correctly across devices.

## app/src/App.jsx

Lines 1-4: React Router Documentation
- reference: https://reactrouter.com/6.28.0/start/tutorial
- what i did: used the react router tutorial to learn how to set up routing with Routes, Route, Link, and useNavigate. adapted their basic example to create the navigation structure for OneClub pages.

Line 63: Firebase Authentication - Sign Out
- reference: https://firebase.google.com/docs/auth/web/password-auth#next_steps
- what i did: used firebase's signOut function to log users out when they click the logout button. this signs them out of their account and sends them back to the home page.

## app/src/routes/Home.jsx

Lines 48-51: ChatGPT - Match Clock Synchronization
- reference: https://chatgpt.com/share/69209f75-a680-8004-ba40-c34a911b6e4f
- what i did: Got help from ChatGPT to create code that keeps the match clock in sync between the admin console and the home page. the clock updates every second so both views show the same time.

Line 144: Firebase Firestore - Get Document
- reference: https://firebase.google.com/docs/firestore/query-data/get-data
- what i did: used firestore's getDoc function to read club documents from the database. this loads club names from favourite club IDs so we can match them against fixture team names and show upcoming games for clubs the user has favourited.

Lines 274: W3Schools - Date Formatting
- reference: https://www.w3schools.com/jsref/jsref_tolocalestring.asp
- what i did: used w3schools documentation to learn how to format Firestore timestamps into readable date and time strings that users can understand.

Lines 604, 624, 695, 731, 821, 857: React - Conditional Rendering
- reference: https://react.dev/learn/conditional-rendering
- what i did: used react's conditional rendering to show or hide elements based on whether the match is published. when fx.published is true, the match clock and card counts are hidden so users have to view the match report to see them.

Lines 324-373: ChatGPT - felxible name matching for favourites
- reference: https://chatgpt.com/share/698654d0-163c-8004-8ed7-17dbebaba6ac
- what i did: got help with querying multiple firestore collections and matching fixture team names to favourite club names. learned how to do flexible name matching that handles exact matches, case-insensitive matches, and partial matches. also got help with combining fixtures from different collections and removing duplicates.

// reference (ChatGPT): https://chatgpt.com/share/6973ecaf-a52c-8004-b321-3bde2163f05d
// what i did: idea of loading fixtures for favourited clubs and keeping it updated in real time.

## app/src/routes/AdminMatchConsole.jsx

Lines 2-5: Firebase Firestore Documentation
- reference: https://firebase.google.com/docs/firestore/query-data/listen
- what i did: followed firebase's official docs to learn how to read data from Firestore and listen for real-time updates. used this to build the admin console that shows fixtures and updates scores live.

Line 77: Firebase Firestore - Get Document
- reference: https://firebase.google.com/docs/firestore/query-data/get-data#get_a_document
- what i did: used firestore's getDoc function to read the admin's user profile from the database. This loads the admin's club name from their profile in Firestore so the admin console only shows fixtures for their club instead of using hardcoded values.

Lines 129: Firebase Firestore Documentation
- reference: https://firebase.google.com/docs/firestore/query-data/listen
- what i did: referenced firebase docs again when building the fixture loading functionality.

Lines 199-200: ChatGPT - Clock Display
- reference: https://chatgpt.com/share/69209f75-a680-8004-ba40-c34a911b6e4f
- what i did: used chatgpt to help generate code that makes the match clock show up correctly for both admins and supporters viewing the game.

Lines 266: W3Schools - Type Checking
- reference: https://www.w3schools.com/JS//js_typeof.asp
- what i did: looked up how to check data types in JavaScript when working with fixture data.

Lines 406-407: ChatGPT - Clock Controls
- reference: https://chatgpt.com/share/69209f75-a680-8004-ba40-c34a911b6e4f
- what i did: got help from chatgpt to build the start, stop, and reset buttons for the match clock. this makes it easy for admins to control the timer during games.

Lines 143-151, 161-234: ChatGPT - Create Fixture Feature
- reference: https://chatgpt.com/share/698627f9-e168-8004-b59c-687532595a16
- what i did: used to assist me with building the firestore path using useMemo and creating fixtures. got help with understanding how to build dynamic firestore collection paths as arrays, using useMemo, and adapting the create fixture form to work with my data structure.

Lines 148-156: ChatGPT - Multi-Competition Support
- reference: https://chatgpt.com/share/69863241-da6c-8004-b905-14311d38b234
- what i did: got help with building  firestore paths based on admin's competition info from their profile. this ensures each admin only sees and creates fixtures for their own competition, allowing the system to support multiple competitions like munster championship and sigerson cup.

Lines 701-796: W3Schools - HTML Forms
- reference: https://www.w3schools.com/html/html_forms.asp
- what i did: used w3schools html forms documentation to help me build the form structure. and how to handle form submission in react.

Lines 534, 559: Firebase Firestore - Update Document
- reference: https://firebase.google.com/docs/firestore/manage-data/add-data#update-documents
- what i did: when the admin clicks publish or unpublish, it finds the fixture document in firestore and updates just the published field to true or false. this lets admins toggle whether a match is published or not.

Lines 456-663, 672-788, 794-831: ChatGPT - unified events timeline for scores, cards, and status
- reference: https://chatgpt.com/share/698dd95f-c4bc-8004-abb2-f58a3426cc2b
- what i did: followed this chatgpt example to save scores, cards, and status changes as events in one subcollection under each fixture. also used it to confirm scores in a popup with a frozen match clock time, log score events with who scored and the score at that moment, and remove the latest matching score or card event when doing corrections so the supporter timeline stays accurate.

User story 18 - store and show who verified the result (lines 863-871, 898-904, 1574-1608)
- reference: https://stackoverflow.com/questions/60056185/convert-firestore-timestamp-to-date-into-different-format
- what i did: when the admin publishes a match, we store verifiedBy (admin name) and verifiedAt (server timestamp) on the fixture. when unpublishing we clear them. when a match is already published, we show "Verified by: [name]" and the date/time below it. used the same pattern as MatchReporter (toDate() then format); here we use toLocaleString for date and time in one string.

User story 14 - admin enter lineups so reporters and supporters can see who is playing (lines 65-71 state, 225-245 create, 371-381 load when selecting, 1002-1035 save lineups, 1174-1210 create ui, 1510-1563 edit ui, 1758-1793 scorer dropdown)
- reference: https://chatgpt.com/share/698f5263-92fc-8004-bd06-d94790f01d1c
- what i did: I took code from this chat and used it for my project (made changes to suit also). Used this chat to set up the lineup feature step by step. started with react state for create and edit, then parsed text to arrays when saving to firestore, loaded lineups back into textareas when selecting a fixture, added save lineups for editing, wired the scorer dropdown to the lineup arrays, and confirmed how reporters and supporters display the lineups. kept lineups as arrays so no parsing needed when displaying.

## app/src/routes/LeaguePage.jsx

Lines 1-5: Firebase Firestore Documentation
- reference: https://firebase.google.com/docs/firestore/query-data/get-data + https://firebase.google.com/docs/firestore/query-data/listen
- what i did: used firebase docs to learn how to query Firestore and listen for changes. applied this to show league standings that update automatically when data changes.

Lines 99: W3Schools & ChatGPT - React Lists
- reference: https://www.w3schools.com/react/react_lists.asp
- what i did: used w3schools to learn about rendering lists in React, and chatgpt helped me understand how to implement it for displaying the league standings table.

## app/src/routes/AdminLogin.jsx

Lines 32: Firebase Authentication Documentation
- reference: https://firebase.google.com/docs/auth/web/password-auth
- what i did: followed firebase's guide on password authentication to build the admin login page. this handles email and password sign-in securely.

## app/src/routes/Login.jsx

Lines 37, 40: Firebase Authentication - Password Authentication
- reference: https://firebase.google.com/docs/auth/web/password-auth
- what i did: used firebase password authentication to let users log in or create accounts. Used signInWithEmailAndPassword to log in existing users and createUserWithEmailAndPassword to create new accounts when they sign up.

Lines 50: W3Schools - HTML Forms
- reference: https://www.w3schools.com/html/html_forms.asp
- what i did: used w3schools to learn the structure of HTML forms, then adapted it to work with React JSX and match the design of the admin login page.

## app/src/AuthContext.jsx

Lines 1-4: Firebase Authentication Documentation
- reference: https://firebase.google.com/docs/auth/web/manage-users#web_8
- what i did: read firebase docs about managing users to understand how onAuthStateChanged works. used this to create a shared authentication context that tracks the logged-in user across the entire app.

Lines 43-52: Firebase Firestore - Listen to Real-time Updates
- reference: https://firebase.google.com/docs/firestore/query-data/listen
- what i did: used firestore's onSnapshot function to listen to the user's profile document in real time. this makes favourites update instantly when they change, so the UI always shows the latest data.

Lines 84-86: ESLint Disable Comments
- reference: https://eslint.org/docs/latest/use/configure/rules#disabling-rules
- what i did: added an eslint disable comment because exporting the useAuth hook was returning an error. the react-refresh rule expects exported items to be React components, but useAuth is a custom hook, so I disabled the rule for that line.

## app/src/firebase.js

Lines 4: YouTube Tutorial
- reference: https://www.youtube.com/watch?v=ig91zc-ERSE&t=140s
- what i did: watched a youtube tutorial to learn how to set up and initialize Firebase in a React project. this helped me get started with the Firebase configuration.

## app/src/App.css

Lines 2-4: W3Schools - CSS Basics
- reference: https://www.w3schools.com/
- what i did: looked up basic css concepts on W3Schools including selectors, the box model, and flexbox. used this knowledge to style the classes and layout of the OneClub app.

## app/src/index.css

Lines 2: W3Schools - CSS- reference: https://www.w3schools.com/css/default.asp
- what i did: referenced w3schools css documentation when setting up the base styles for the application.

## app/src/routes/Help.jsx

Lines 5: W3Schools- reference: https://www.w3schools.com/
- what i did: used w3schools as a general reference when building the help page structure and content.

## app/src/ProtectedRoute.jsx

Lines 4: React Router Documentation- reference: https://reactrouter.com/
- what i did: looked up react router documentation to learn about protected routes and authentication patterns. used this to create a component that only lets logged-in admins access the admin console.

## app/scripts/importCorkClubsToFirestore.js

 ChatGPT - JSON to Firestore Import- reference: https://chatgpt.com/share/6973641b-71a4-8004-9597-83210984a170
- what i did: used chatgpt to help understand how to import club data from a JSON file into Firestore without manually inputting each club. got code examples and explanations for setting up the import script.

 Stack Overflow - Importing JSON to Firestore- reference: https://stackoverflow.com/questions/46640981/how-to-import-csv-or-json-to-firebase-cloud-firestore?
- what i did: looked up stack overflow discussions about importing JSON or CSV data into Firestore. this helped me understand different approaches and best practices for bulk data imports which i will hopefully be doing in further iterations.

 Firebase Firestore Documentation - Adding Data- reference: https://firebase.google.com/docs/firestore/manage-data/add-data?
- what i did: referenced Firebase's official documentation on adding data to Firestore. also read through this similar to above reference, regarding the inputting of data into firestore.

## app/src/userService.js

Lines 20-65: ChatGPT - Creating and Updating User Profiles
- reference: https://chatgpt.com/share/6973e7eb-9d38-8004-aa6d-5c0d5d37b303
- what i did: got help from chatgpt to understand how to automatically create user profiles when someone logs in and assign them admin or supporter roles based on an allow-list. also learned how to fix incorrect roles if they exist in the database using setDoc and updateDoc.

Lines 58-59, 91-96, 110-115: ChatGPT - Multi-Competition Support
- reference: https://chatgpt.com/share/69863241-da6c-8004-b905-14311d38b234
- what i did: got help with updating admin profile creation to include competitionType and competitionId fields. this ensures each admin has their competition info saved so the system knows where to save their games. also got help with migration logic to add competition info to existing admin profiles that were created before this feature was added.

Lines 70-72: Firebase Firestore - Array Operations- reference: https://firebase.google.com/docs/firestore/manage-data/add-data#array_operations
- what i did: used Firestore's arrayUnion function to add clubs to the user's favourites list. this prevents duplicates even if the function is called multiple times, making it safe to use.


// reference (ChatGPT): https://chatgpt.com/share/6973ecaf-a52c-8004-b321-3bde2163f05d
// what i did: adding/removing favourite club IDs in Firestore using arrayUnion/arrayRemove (no duplicates).

## app/src/routes/ClubPage.jsx

Lines 55-57: React useMemo Hook- reference: https://react.dev/reference/react/useMemo
- what i did: used React's useMemo hook to check if a club is in the user's favourites list. this only recalculates whether the club is favourited when the favourites list or club ID changes, which makes the page faster.

## app/src/routes/MatchReporter.jsx

Lines 13-15: react router - url parameters and navigation
- reference: https://reactrouter.com/en/main/hooks/use-params
- what i did: used react router's useParams hook to read the competition type, competition id, and fixture id from the url. used useNavigate to create a button that takes users back to the home page when they click it.

Lines 17-19: react hooks - usestate and useeffect
- reference: https://react.dev/reference/react/useState and https://react.dev/reference/react/useEffect
- what i did: used useState to store the fixture data, loading state, and error messages. used useEffect to load the fixture data when the page loads or when the url parameters change. this ensures the page always shows the correct match data.

Lines 24, 59-60: firebase firestore - get document
- reference: https://firebase.google.com/docs/firestore/query-data/get-data#get_a_document
- what i did: used firestore's getDoc function to read a single fixture document from the database. built the collection path dynamically based on the competition type and id from the url, so the same page works for different competitions like munster championship or sigerson cup.

Lines 105-108: w3schools - date formatting
- reference: https://www.w3schools.com/jsref/jsref_tolocalestring.asp
- what i did: used javascript's toLocaleDateString method to format firestore timestamps into readable dates like "monday, january 28, 2026". first converted the firestore timestamp to a javascript date object using the toDate() method.

Lines 109-120: chatgpt - match report text building
- reference: https://chatgpt.com/share/697cd305-6e58-8004-816f-c64996174535
- what i did: got help from chatgpt to design the logic for building the match report text string. the conversation covered structuring the report, handling conditional sections (showing cards only if they exist), pluralization ("card" vs "cards"), formatting firestore timestamps into readable dates, and combining all sections into one final string. this guided the implementation in the generateReport function which builds the report text line by line with proper spacing and conditional sections.

Lines 127-130: chatgpt - winner logic and report building
- reference: https://chatgpt.com/share/698619f9-6afc-8004-896d-8903ffe7b76a
- what i did: used to grab code to assist me with determining the winner and building the match report text string. got help with calculating totals, winner logic, and structuring the report.

User story 18 - verification line in match report (Lines 296-324)
- reference: https://stackoverflow.com/questions/60056185/convert-firestore-timestamp-to-date-into-different-format
- what i did: took the approach from that post (toDate() then toLocaleDateString/toLocaleTimeString) and adapted it for this project to format the verification timestamp. when an admin has verified a match, the report appends a line "Result verified by: [name] on [date] at [time]" so the journalist can cite who verified the result.

## app/src/routes/FixtureTimeline.jsx

Lines 172-179: chatgpt - building firestore paths with array spread and ordering
- reference: https://chatgpt.com/share/698cc3fb-e8c4-8004-9d27-b803ae0c4a2d
- what i did: took code from this chat and implemented it using my project info. got help with building firestore collection paths as arrays and spreading them into the collection() function using the spread operator. also confirmed that using orderBy("clockSeconds", "asc") is the correct way to sort events by match time so the timeline shows events in chronological order. adapted the pattern to work with my competition type and competition id from url parameters.

Lines 32-36, 315-430: Material UI Timeline API - timeline component implementation
- reference: https://mui.com/material-ui/react-timeline/
- what i did: installed @mui/material, @emotion/react, @emotion/styled, and @mui/lab packages. imported Timeline, TimelineItem, TimelineSeparator, TimelineConnector, TimelineContent, and TimelineDot components from @mui/lab. replaced the custom timeline structure with material ui timeline components. used TimelineDot color prop to show different colored dots for different event types: "success" (green) for goals, "primary" (blue) for points, "error" (red) for red cards, custom yellow (#f59e0b) via sx prop for yellow cards, and "secondary" (purple) for status changes. the timeline now uses material ui's polished components with proper spacing, connectors between events, and consistent styling.