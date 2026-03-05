import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db, storage } from "../firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, orderBy, limit, onSnapshot } from "firebase/firestore";
// reference: https://firebase.google.com/docs/storage/web/upload-files
// used the firebase storage web docs to understand how to upload a file, then get its download url and save that url into firestore
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "../AuthContext.jsx";
// iteration 6 - voice to text: browser speech recognition api
// reference web speech api docs: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
// reference react speech recognition package: https://www.npmjs.com/package/react-speech-recognition
// reference chatgpt example conversation: https://chatgpt.com/share/699ed52a-99ac-8004-a451-aaa361043dfd
// voice to text feature mainly uses: notes state, speech recognition hook, mic handlers, notes section, and voice to text ui below
// used chat gpt to assist me with the code and also took code from chat gpt diectly into my project
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";

// reporter dashboard: create, edit, and publish news reports for games
export default function ReporterDashboard() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [notes, setNotes] = useState(""); // voice to text: work notes and voice transcript go here before inserting into report
  const [coverImageUrl, setCoverImageUrl] = useState(""); // optional cover image for the report; stored as a public url from firebase storage
  const [coverUploading, setCoverUploading] = useState(false); // true while an image is being sent to firebase storage so we can show "uploading image"
  const [coverError, setCoverError] = useState(""); // holds any upload error message so the reporter knows if something went wrong
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [myReports, setMyReports] = useState([]);
  const [startingMic, setStartingMic] = useState(false); //voice to text: true while mic is starting so we can show starting
  const [editingId, setEditingId] = useState(null);
  const [reportsError, setReportsError] = useState(null);

  // voice to text: speech-to-text state from react-speech-recognition (live transcript, listening flag, browser support, mic permission)
  const {
    transcript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable,
  } = useSpeechRecognition();

  // reporter dashboard: load this reporter's latest news reports in real time
  useEffect(() => {
    // if there is no logged in user yet, do nothing
    if (!currentUser?.uid) return;

    // build a firestore query for this user's news documents, newest first, limit 20
    const q = query(
      collection(db, "news"),
      where("authorId", "==", currentUser.uid),
      orderBy("publishedAt", "desc"),
      limit(20)
    );

    // subscribe to the query so myreports updates automatically when firestore changes
    const unsub = onSnapshot(q, (snap) => {
      // turn each document into a plain object with id and its data
      setMyReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    // when the component unmounts or the user changes, stop listening to firestore
    return () => unsub();
  }, [currentUser?.uid]);

  // shared fields for a news report document in firestore; used by save and publish
  // includes the optional coverImageUrl so the same image can be shown on the home page list and the full report page
  const payload = () => ({
    title: title.trim(),
    body: body.trim(),
    publishedAt: serverTimestamp(),
    author: currentUser?.email ?? "",
    authorId: currentUser?.uid ?? "",
    coverImageUrl: coverImageUrl || null,
  });

  // reporter dashboard: save or update a draft so it is not shown on the home page
  async function handleSaveDraft(e) {
    e.preventDefault(); // stop the browser from doing a normal form submit
    setError(""); // clear any old error message
    setMessage(""); // clear any old success message

    // if no user is logged in, we cannot save a draft
    if (!currentUser?.uid) {
      setError("You must be logged in to save.");
      return;
    }

    // if title or body is empty, ask the reporter to fill them in
    if (!title.trim() || !body.trim()) {
      setError("Please enter a title and report.");
      return;
    }

    setSaving(true); // mark that a save is in progress so buttons can be disabled

    try {
      if (editingId) {
        // if editingid is set, update the existing report document in firestore
        await updateDoc(doc(db, "news", editingId), {
          ...payload(), // use shared fields (title, body, author info, cover image)
          publishedAt: serverTimestamp(), // update the published time
          visibleOnHome: false, // keep as draft (do not show on home)
        });
        setMessage("Draft updated. It’s in My reports below; you can keep editing or publish to home.");
      } else {
        // if there is no editingid, create a brand new draft document
        const ref = await addDoc(collection(db, "news"), {
          ...payload(),
          visibleOnHome: false, // drafts are not visible on the home page
        });
        setEditingId(ref.id); // remember the id so next save updates this draft
        setMessage("Draft saved. It’s in My reports below; you can keep editing or publish to home.");
      }
      // keep title and body in the form so the reporter can continue editing
    } catch (err) {
      console.error(err); // log the error for debugging
      setError("Failed to save. Try again."); // show a friendly error message
    } finally {
      setSaving(false); // clear the saving flag so buttons work again
    }
  }

  // reporter dashboard: publish the report so it appears on the home news list
  async function handlePublishToHome(e) {
    e.preventDefault(); // stop the default form submit
    setError(""); // clear any old error
    setMessage(""); // clear any old success message

    // must be logged in to publish
    if (!currentUser?.uid) {
      setError("You must be logged in to publish.");
      return;
    }

    // require both title and body before publishing
    if (!title.trim() || !body.trim()) {
      setError("Please enter a title and report.");
      return;
    }

    setSaving(true); // show that a publish is in progress

    try {
      if (editingId) {
        // if editing an existing report, update that document and mark it visible on home
        await updateDoc(doc(db, "news", editingId), {
          ...payload(),
          publishedAt: serverTimestamp(),
          visibleOnHome: true, // this makes it show up on the home page
        });
        setMessage("Report published to home.");
      } else {
        // if creating a new report, add a new document and mark it visible on home
        await addDoc(collection(db, "news"), {
          ...payload(),
          visibleOnHome: true,
        });
        setMessage("Report published to home.");
      }

      // after publishing, clear the form so the reporter can start a fresh report
      setTitle("");
      setBody("");
      setCoverImageUrl("");
      setEditingId(null);
    } catch (err) {
      console.error(err);
      setError("Failed to publish. Try again.");
    } finally {
      setSaving(false);
    }
  }

  // reporter dashboard: load an existing report into the form for editing
  function handleLoadReport(r) {
    setTitle(r.title ?? ""); // put the report title into the title input
    setBody(r.body ?? ""); // put the report body into the main textarea
    setCoverImageUrl(r.coverImageUrl ?? ""); // load any existing cover image
    setEditingId(r.id); // remembers which document we are editing
    setError(""); // clear any old error
    setMessage(""); // clear any old success message
  }

  // reporter dashboard: delete a report from firestore and clear the form if it was open
  async function handleDeleteReport(r) {
    try {
      // delete the selected report document from firestore
      await deleteDoc(doc(db, "news", r.id));

      // if the deleted report is the one currently loaded in the form, clear the form
      if (editingId === r.id) {
        setTitle("");
        setBody("");
        setCoverImageUrl("");
        setEditingId(null);
      }

      setMessage("Report deleted."); // show a success message
    } catch (err) {
      console.error(err); // log the error
      setError("Failed to delete."); // show a friendly error message
    }
  }

  // reporter dashboard: warn the reporter if they try to leave with unsaved changes
  const hasUnsavedChanges = (title.trim() || body.trim()) && !saving;
  useEffect(() => {
    // if there are no unsaved changes, do not add the beforeunload listener
    if (!hasUnsavedChanges) return;

    const onBeforeUnload = (e) => {
      // prevent default so the browser shows its own leave site warning
      e.preventDefault();
    };

    // add the listener when there are unsaved changes
    window.addEventListener("beforeunload", onBeforeUnload);

    // remove the listener when there are no unsaved changes or when the component unmounts
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  //voice to text: start listening for speech and populate transcript
  async function handleStartListening() { // start the microphone and speech recognition for voice to text
    setError(""); // clear any old error message
    setMessage(""); // clear any old success message
    resetTranscript(); // clear any previous transcript so this recording starts fresh
    setStartingMic(true); // says that the mic is in the process of starting
    try {
      // request microphone permission first so the prompt appears
      if (navigator.mediaDevices?.getUserMedia) { // check that the browser supports getusermedia
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // ask for mic access
        stream.getTracks().forEach((t) => t.stop()); // immediately stop the temporary audio
      }
      await SpeechRecognition.startListening({ continuous: true, language: "en-IE" }); // start speech recognition in continuous irish english mode
    } catch (err) {
      const msg =
        err?.message?.includes("Permission") || err?.name === "NotAllowedError"
          ? "Microphone access denied. Allow the site to use your mic and try again." // friendly message if mic permission was denied
          : !window.isSecureContext
            ? "Voice input needs a secure connection (HTTPS). Open this site via https://one-club-f5e48.web.app" // message if the page is not using https
            : "Could not start microphone. Try again or use the keyboard mic to dictate."; // fallback message for any other error
      setError(msg); // store the chosen error message so the ui can show it
    } finally {
      setStartingMic(false); // mic is no longer starting, so clear the loading state
    }
  }

  //voice to text: stop listening and leave transcript as-is for adding to notes
  async function handleStopListening() { // stop the speech recognition while keeping the transcript text
    try {
      await SpeechRecognition.stopListening(); // tell react speech recognition to stop listening
    } catch (err) {
      console.error(err); // log the error for debugging
      setError("Could not stop the microphone. Refresh the page and try again."); // show a helpful error if stopping fails
    }
  }

  // voice to text: append current live transcript to notes and clear transcript
  function handleAddTranscriptToNotes() { // move the current transcript into the notes area
    if (!transcript) return; // if there is no transcript yet, do nothing
    setNotes((prev) => (prev ? `${prev}\n\n${transcript}` : transcript)); // append transcript to existing notes with spacing, or set it if notes are empty
    resetTranscript(); // clear the transcript so the next recording starts clean
  }

  //voice to text: copy notes into the report body so reporter can polish then publish
  function handleInsertNotesIntoReport() { // move the notes into the main report body
    if (!notes.trim()) return; // if notes are empty after trimming, do nothing
    setBody((prev) => (prev ? `${prev}\n\n${notes.trim()}` : notes.trim())); // append trimmed notes to the report body with spacing, or set it if body is empty
  }

  // reporter dashboard: if not logged in, show message and link to login
  if (!currentUser) {
    return (
      <div style={{ maxWidth: 720, margin: "2rem auto", padding: "1rem" }}>
        <button type="button" onClick={() => navigate("/")} style={{ marginBottom: "1rem" }}>
          ← Back to Home
        </button>
        <p style={{ margin: "1rem 0" }}>Please log in to use the reporter dashboard.</p>
        <button type="button" className="chip" onClick={() => navigate("/login")}>
          Log in
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "2rem auto", padding: "1rem" }}>
      {/* reporter dashboard: top of page with back button, title, and who is logged in */}
      <header style={{ marginBottom: "1.5rem" }}>
        <button type="button" onClick={() => navigate("/")} style={{ marginBottom: "1rem" }}>
          ← Back to Home
        </button>
        <h1 style={{ margin: 0 }}>Reporter dashboard</h1>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.95rem", opacity: 0.85 }}>
          Write reports on games in OneClub.
        </p>
        {currentUser?.email && (
          <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", opacity: 0.7 }}>
            Logged in as <strong>{currentUser.email}</strong>
          </p>
        )}
      </header>

      {/* reporter dashboard: first card with the form to write or edit a report */}
      <section
        style={{
          background: "#fff",
          padding: "1.5rem",
          borderRadius: 8,
          boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>
          {editingId ? "Edit report" : "Write a report"}
        </h2>
        {/* reporter dashboard: form submits to handleSaveDraft so they can save or update a draft */}
        <form onSubmit={handleSaveDraft}>
          {/* optional cover image upload for the report; uploads to firebase storage and saves the public url in coverImageUrl so it can be shown on home and the full report page */}
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>
              Cover image (optional)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file || !currentUser?.uid) return;
                setCoverError("");
                setCoverUploading(true);
                try {
                  const path = `news-covers/${currentUser.uid}/${Date.now()}-${file.name}`;
                  const storageRef = ref(storage, path);
                  await uploadBytes(storageRef, file);
                  const url = await getDownloadURL(storageRef);
                  setCoverImageUrl(url);
                  setMessage("Cover image uploaded.");
                } catch (err) {
                  console.error(err);
                  setCoverError("Failed to upload image. Try again.");
                } finally {
                  setCoverUploading(false);
                }
              }}
            />
            {coverUploading && (
              <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
                Uploading image…
              </p>
            )}
            {coverError && (
              <p style={{ margin: "0.35rem 0 0", fontSize: "0.85rem", color: "#b91c1c" }}>
                {coverError}
              </p>
            )}
            {coverImageUrl && !coverUploading && (
              <div style={{ marginTop: "0.5rem" }}>
                <img
                  src={coverImageUrl}
                  alt="Cover preview"
                  style={{ maxWidth: "100%", maxHeight: 160, borderRadius: 8 }}
                />
              </div>
            )}
          </div>
          {/* reporter dashboard: title input bound to title state */}
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="reporter-title" style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>
              Title
            </label>
            <input
              id="reporter-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder=""
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                fontSize: "1rem",
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                boxSizing: "border-box",
              }}
            />
          </div>
          {/* reporter dashboard: main report textarea bound to body state */}
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="reporter-body" style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>
              Report
            </label>
            <textarea
              id="reporter-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your report on the game..."
              rows={10}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                fontSize: "1rem",
                lineHeight: 1.5,
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>
          {/* voice to text: notes section for voice output and work notes, then insert into report when ready */}
          <div style={{ marginBottom: "1rem" }}>
            <label htmlFor="reporter-notes" style={{ display: "block", marginBottom: "0.35rem", fontWeight: 600 }}>
              Notes
            </label>
            <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0 0 0.5rem" }}>
              Use for voice-to-text or work notes. Edit here, then insert into the report when ready.
            </p>
            <textarea
              id="reporter-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Voice output and notes go here..."
              rows={6}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                fontSize: "1rem",
                lineHeight: 1.5,
                border: "1px solid #e2e8f0",
                borderRadius: 6,
                resize: "vertical",
                boxSizing: "border-box",
                backgroundColor: "#f8fafc",
              }}
            />
            <button
              type="button"
              className="chip"
              onClick={handleInsertNotesIntoReport}
              disabled={!notes.trim()}
              style={{ marginTop: "0.5rem" }}
            >
              Insert notes into report
            </button>
          </div>
          {/*voice to text: optional voice-to-text helper (mic controls, live transcript, add to notes) */}
          <div
            style={{
              marginBottom: "1.25rem",
              marginTop: "0.5rem",
              paddingTop: "1rem",
              borderTop: "1px solid #e2e8f0",
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1rem" }}>Voice to text (optional)</h3>
            {!browserSupportsSpeechRecognition ? (
              <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                Your browser does not support in-page voice recognition (common on iPhone). You can still type your report, or tap the <strong>microphone on your keyboard</strong> above the Report box to dictate using your device’s built-in voice input.
              </p>
            ) : (
              <div style={{ display: "grid", gap: "0.5rem" }}>
                <div style={{ fontSize: "0.9rem", opacity: 0.8 }}>
                  Microphone: <strong>{listening ? "On" : "Off"}</strong>
                </div>
                {!isMicrophoneAvailable && (
                  <p className="muted" style={{ fontSize: "0.85rem", margin: 0, color: "#b45309" }}>
                    Microphone access was denied. Reload the page and allow the mic when prompted.
                  </p>
                )}
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="chip"
                    onClick={handleStartListening}
                    disabled={listening || startingMic}
                  >
                    {startingMic ? "Starting…" : "Start recording"}
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={handleStopListening}
                    disabled={!listening}
                  >
                    Stop
                  </button>
                  <button
                    type="button"
                    className="chip"
                    onClick={resetTranscript}
                    disabled={!transcript}
                  >
                    Clear text
                  </button>
                </div>
                <label style={{ fontSize: 14 }}>
                  Live transcript
                  <textarea
                    value={transcript}
                    readOnly
                    rows={4}
                    style={{
                      width: "100%",
                      marginTop: 4,
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.95rem",
                      lineHeight: 1.4,
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                      resize: "vertical",
                      boxSizing: "border-box",
                      backgroundColor: "#f8fafc",
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="chip"
                  onClick={handleAddTranscriptToNotes}
                  disabled={!transcript}
                  style={{ justifySelf: "flex-end" }}
                >
                  Add to notes
                </button>
              </div>
            )}
          </div>
          {/* reporter dashboard: show error or success message from state */}
          {error && (
            <p style={{ color: "#b91c1c", marginBottom: "0.75rem", fontSize: "0.9rem" }}>{error}</p>
          )}
          {message && (
            <p style={{ color: "#15803d", marginBottom: "0.75rem", fontSize: "0.9rem" }}>{message}</p>
          )}
          {/* reporter dashboard: publish calls handlePublishToHome, save draft submits form to handleSaveDraft, new report clears the form */}
          <p style={{ fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.5rem" }}>Save or publish</p>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="chip"
              disabled={saving || !title.trim() || !body.trim()}
              onClick={handlePublishToHome}
              style={{
                fontWeight: 600,
                padding: "0.5rem 1rem",
                background: "#166534",
                color: "#fff",
                border: "none",
              }}
            >
              {saving ? "…" : "Publish to home"}
            </button>
            <button
              type="submit"
              className="chip"
              disabled={saving}
              style={{ fontWeight: 600, padding: "0.5rem 1rem" }}
            >
              {saving ? "Saving…" : editingId ? "Update draft" : "Save draft"}
            </button>
            {editingId && (
              <button
                type="button"
                className="chip"
                onClick={() => {
                  setTitle("");
                  setBody("");
                  setEditingId(null);
                  setMessage("");
                  setError("");
                }}
              >
                New report
              </button>
            )}
          </div>
        </form>
      </section>

      {/* reporter dashboard: second card showing my reports list; each row uses handleLoadReport to edit and handleDeleteReport to delete */}
      <section
        style={{
          background: "#fff",
          padding: "1.5rem",
          borderRadius: 8,
          boxShadow: "0 2px 6px rgba(0,0,0,0.06)",
          marginTop: "1.5rem",
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: "1rem", fontSize: "1.1rem" }}>My reports</h2>
        {/* reporter dashboard: show load error if the my reports query failed */}
        {reportsError && (
          <p style={{ color: "#b91c1c", fontSize: "0.9rem", marginBottom: "0.5rem" }}>{reportsError}</p>
        )}
        {/* reporter dashboard: empty state when no reports, or list of reports from myReports state */}
        {myReports.length === 0 && !reportsError ? (
          <p className="muted" style={{ margin: 0 }}>No reports yet. Your saved reports will appear here.</p>
        ) : myReports.length > 0 ? (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {myReports.map((r) => (
              <li
                key={r.id}
                style={{
                  padding: "0.5rem 0",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span
                  style={{ fontWeight: 600, fontSize: "0.95rem", flex: "1 1 auto", cursor: "pointer" }}
                  onClick={() => handleLoadReport(r)}
                  onKeyDown={(e) => e.key === "Enter" && handleLoadReport(r)}
                  role="button"
                  tabIndex={0}
                >
                  {r.title || "Untitled"}
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "0.15rem 0.4rem",
                    borderRadius: 4,
                    background: r.visibleOnHome ? "#dcfce7" : "#f1f5f9",
                    color: r.visibleOnHome ? "#166534" : "#475569",
                  }}
                >
                  {r.visibleOnHome ? "On home" : "Draft"}
                </span>
                <span style={{ fontSize: "0.8rem", opacity: 0.75 }}>
                  {r.publishedAt?.toDate?.()
                    ? r.publishedAt.toDate().toLocaleString()
                    : "—"}
                </span>
                <button
                  type="button"
                  className="chip"
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                  onClick={() => handleLoadReport(r)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="chip"
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                  onClick={() => handleDeleteReport(r)}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
