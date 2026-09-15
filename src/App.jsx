import { useEffect, useState } from "react";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "./firebase";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function apiRequest(path, { token, method = "GET", body, raw = false } = {}) {
    const response = await fetch(`${API_URL}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
        },
        body,
    });

    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Request failed.");
    }

    return raw ? response : response.json();
}

function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleLogin(event) {
        event.preventDefault();
        setMessage("");
        setLoading(true);

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error(error);
            setMessage("Invalid email or password.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="login">
            <section className="card">
                <div className="mark">SQ</div>

                <p className="eyebrow">CONFIDENTIAL EXAMINATION DELIVERY</p>

                <h1>Secure Question Paper System</h1>

                <p className="muted">
                    Secure upload, officer approval, integrity validation, and controlled
                    examination-centre release.
                </p>

                <form onSubmit={handleLogin}>
                    <label>
                        Email address
                        <input
                            type="email"
                            placeholder="Enter your email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                        />
                    </label>

                    <label>
                        Password
                        <input
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                        />
                    </label>

                    <button disabled={loading}>
                        {loading ? "Signing in..." : "Sign in"}
                    </button>
                </form>

                {message && <p className="notice">{message}</p>}
            </section>
        </main>
    );
}

function Header({ profile }) {
    async function handleSignOut() {
        await signOut(auth);
    }

    return (
        <header>
            <div>
                <span className="logo">SQ</span>
                <strong>Secure Papers</strong>
            </div>

            <div className="header-user">
                <span>
                    {profile.displayName || profile.email}
                    <small>{profile.role.replaceAll("_", " ")}</small>
                </span>

                <button className="quiet" onClick={handleSignOut}>
                    Sign out
                </button>
            </div>
        </header>
    );
}

function UploadPaper({ token, refreshPapers }) {
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleUpload(event) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);
  const file = formData.get("file");

  if (!file || file.size === 0) {
    setMessage("Please select a PDF file.");
    return;
  }

  if (file.type !== "application/pdf") {
    setMessage("Only PDF files are allowed.");
    return;
  }

  setLoading(true);
  setMessage("");

  try {
    const data = await apiRequest("/papers", {
      token,
      method: "POST",
      body: formData,
    });

    setMessage(
      `Paper encrypted and submitted. SHA-256: ${data.sha256.slice(0, 20)}...`
    );

    form.reset(); // Use `form`, not event.currentTarget
    await refreshPapers();
  } catch (error) {
    setMessage(error.message);
  } finally {
    setLoading(false);
  }
}

    return (
        <section className="panel">
            <h2>Upload question paper</h2>

            <p className="muted">
                PDF only, maximum 10 MB. The server encrypts the file before sending it
                to private Supabase Storage.
            </p>

            <form className="grid" onSubmit={handleUpload}>
                <label>
                    Examination name
                    <input name="exam_name" required />
                </label>

                <label>
                    Subject name
                    <input name="subject_name" required />
                </label>

                <label>
                    Examination date
                    <input type="date" name="exam_date" required />
                </label>

                <label>
                    Examination time
                    <input type="time" name="exam_time" required />
                </label>

                <label className="wide">
                    Question paper PDF
                    <input
                        type="file"
                        name="file"
                        accept=".pdf,application/pdf"
                        required
                    />
                </label>

                <button className="wide" disabled={loading}>
                    {loading ? "Encrypting and uploading..." : "Encrypt & submit for approval"}
                </button>
            </form>

            {message && <p className="notice">{message}</p>}
        </section>
    );
}

function PaperTable({ papers, profile, token, refreshPapers }) {
    const [message, setMessage] = useState("");
    const [loadingId, setLoadingId] = useState("");

    async function approvePaper(paperId) {
        setLoadingId(paperId);
        setMessage("");

        try {
            await apiRequest(`/papers/${paperId}/approve`, {
                token,
                method: "POST",
            });

            setMessage("Paper approved successfully.");
            await refreshPapers();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoadingId("");
        }
    }

    async function scheduleRelease(paperId) {
        const dateTime = window.prompt(
            "Enter release time in local format: YYYY-MM-DDTHH:MM\nExample: 2026-09-20T09:00"
        );

        if (!dateTime) return;

        const windowMinutes = window.prompt(
            "Enter release window duration in minutes (1 to 360):",
            "120"
        );

        if (!windowMinutes) return;

        const releaseDate = new Date(dateTime);

        if (Number.isNaN(releaseDate.getTime())) {
            setMessage("Invalid release date/time.");
            return;
        }

        setLoadingId(paperId);
        setMessage("");

        try {
            const formData = new FormData();
            formData.append("release_at", releaseDate.toISOString());
            formData.append("release_window_minutes", windowMinutes);

            await apiRequest(`/papers/${paperId}/release`, {
                token,
                method: "POST",
                body: formData,
            });

            setMessage("Controlled release scheduled successfully.");
            await refreshPapers();
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoadingId("");
        }
    }

    async function downloadPaper(paper) {
        setLoadingId(paper.id);
        setMessage("");

        try {
            const response = await apiRequest(`/papers/${paper.id}/download`, {
                token,
                raw: true,
            });

            const fileBlob = await response.blob();
            const fileUrl = window.URL.createObjectURL(fileBlob);

            const link = document.createElement("a");
            link.href = fileUrl;
            link.download = paper.fileName || "question-paper.pdf";
            document.body.appendChild(link);
            link.click();
            link.remove();

            window.URL.revokeObjectURL(fileUrl);

            setMessage("Integrity verified. Paper downloaded successfully.");
        } catch (error) {
            setMessage(error.message);
        } finally {
            setLoadingId("");
        }
    }

    return (
        <section className="panel">
            <h2>
                {profile.role === "QUESTION_SETTER" && "Your question papers"}
                {profile.role === "EXAMINATION_OFFICER" && "Approval and release queue"}
                {profile.role === "EXAMINATION_CENTRE" && "Controlled paper release"}
            </h2>

            <p className="muted">
                All uploads, approvals, access attempts, and releases are recorded in
                Firestore audit logs.
            </p>

            {!papers.length ? (
                <p className="empty">No papers available.</p>
            ) : (
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Paper</th>
                                <th>Status</th>
                                <th>Integrity</th>
                                <th>Release</th>
                                <th>Action</th>
                            </tr>
                        </thead>

                        <tbody>
                            {papers.map((paper) => (
                                <tr key={paper.id}>
                                    <td>
                                        <strong>{paper.subjectName}</strong>
                                        <small>
                                            {paper.examName} · {paper.fileName}
                                        </small>
                                    </td>

                                    <td>
                                        <span className="badge">
                                            {paper.status.replaceAll("_", " ")}
                                        </span>
                                    </td>

                                    <td className="verified">
                                        ● {paper.integrityStatus || "Pending"}
                                    </td>

                                    <td>
                                        {paper.releaseAt
                                            ? new Date(paper.releaseAt).toLocaleString()
                                            : `${paper.examDate} ${paper.examTime}`}
                                    </td>

                                    <td>
                                        {profile.role === "EXAMINATION_OFFICER" &&
                                            paper.status === "PENDING_APPROVAL" && (
                                                <button
                                                    disabled={loadingId === paper.id}
                                                    onClick={() => approvePaper(paper.id)}
                                                >
                                                    {loadingId === paper.id ? "Approving..." : "Approve"}
                                                </button>
                                            )}

                                        {profile.role === "EXAMINATION_OFFICER" &&
                                            paper.status === "APPROVED" && (
                                                <button
                                                    disabled={loadingId === paper.id}
                                                    onClick={() => scheduleRelease(paper.id)}
                                                >
                                                    {loadingId === paper.id
                                                        ? "Scheduling..."
                                                        : "Schedule release"}
                                                </button>
                                            )}

                                        {profile.role === "EXAMINATION_CENTRE" &&
                                            paper.status === "SCHEDULED" && (
                                                <button
                                                    disabled={loadingId === paper.id}
                                                    onClick={() => downloadPaper(paper)}
                                                >
                                                    {loadingId === paper.id
                                                        ? "Checking..."
                                                        : "Verify & download"}
                                                </button>
                                            )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {message && <p className="notice">{message}</p>}
        </section>
    );
}

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [papers, setPapers] = useState([]);
  const [message, setMessage] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setProfile(null);
      setPapers([]);
      setMessage("");

      if (!user) {
        setToken("");
        return;
      }

      try {
        const firebaseToken = await user.getIdToken();
        setToken(firebaseToken);

        const profileDoc = await getDoc(doc(db, "users", user.uid));

        if (!profileDoc.exists()) {
          setMessage(
            "Your account has no Firestore role document. Contact the administrator."
          );
          return;
        }

        setProfile({
          uid: user.uid,
          email: user.email,
          ...profileDoc.data(),
        });
      } catch (error) {
        console.error(error);
        setMessage("Unable to load Firebase profile or Firestore role.");
      }
    });

    return () => unsubscribe();
  }, []);

  async function refreshPapers() {
    if (!token || !profile) return;

    try {
      const data = await apiRequest("/papers", { token });
      setPapers(data);
    } catch (error) {
      console.error(error);
      setMessage(error.message);
    }
  }

  useEffect(() => {
    if (profile && token) {
      refreshPapers();
    }
  }, [profile, token]);

  if (!firebaseUser) {
    return <LoginPage />;
  }

  if (!profile) {
    return (
      <main className="login">
        <section className="card">
          <div className="mark">SQ</div>

          <h2>Loading secure profile...</h2>

          {message ? (
            <>
              <p className="notice">{message}</p>

              <button onClick={() => signOut(auth)}>
                Sign out
              </button>
            </>
          ) : (
            <p className="muted">
              Checking Firebase Authentication and Firestore role...
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <>
      <Header profile={profile} />

      <main className="app">
        <section className="hero">
          <p className="eyebrow">
            {profile.role.replaceAll("_", " ")}
          </p>

          <h1>
            {profile.role === "QUESTION_SETTER" &&
              "Submit with confidence."}

            {profile.role === "EXAMINATION_OFFICER" &&
              "Protect every release."}

            {profile.role === "EXAMINATION_CENTRE" &&
              "Access only when authorised."}
          </h1>

          <p>
            Firebase Authentication · Firestore audit logs · encrypted private
            Supabase Storage · controlled release
          </p>
        </section>

        {message && <p className="notice">{message}</p>}

        {profile.role === "QUESTION_SETTER" && (
          <UploadPaper
            token={token}
            refreshPapers={refreshPapers}
          />
        )}

        <PaperTable
          papers={papers}
          profile={profile}
          token={token}
          refreshPapers={refreshPapers}
        />
      </main>
    </>
  );
}

