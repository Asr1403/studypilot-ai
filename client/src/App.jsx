import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import StudyPlanner from "./studyplanner";
import AIRescue from "./AIrescue";
import ExamPrep from "./examprep";
import AcademicTwin from "./AcademicTwin";
import VoiceCoach from "./VoiceCoach";

const API_URL = "http://localhost:3000/api";

function Icon({ name, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  };

  const paths = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" />
        <path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20" />
        <path d="M8 7h8" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" />
        <path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    trash: (
      <>
        <path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" />
      </>
    ),
    menu: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
      </>
    ),
  };

  return <svg {...common}>{paths[name] || paths.sparkles}</svg>;
}

function StatCard({ label, value, detail, icon, tone }) {
  return (
    <article className={`stat-card stat-${tone || "violet"}`}>
      <div className="stat-top">
        <span className="stat-icon">
          <Icon name={icon} />
        </span>
        <span className="stat-kicker">STUDYPILOT</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-detail">{detail}</div>
    </article>
  );
}

function getSessionDateTime(session) {
  if (!session) return null;

  const value =
    session.startTime ??
    session.scheduledAt ??
    session.dateTime ??
    session.date;

  if (!value) return null;

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return `${value}T${session.time || session.startClock || "00:00"}`;
  }

  if (
    typeof value === "string" &&
    /^\d{2}:\d{2}(:\d{2})?$/.test(value) &&
    session.date
  ) {
    return `${session.date}T${value}`;
  }

  return value;
}

function getSessionSubject(session) {
  if (typeof session?.subject === "string") {
    return session.subject;
  }

  return (
    session?.subjectName ??
    session?.subject?.name ??
    "Study session"
  );
}

function App() {
  const [subjects, setSubjects] = useState([]);
  const [subjectName, setSubjectName] = useState("");
  const [targetHours, setTargetHours] = useState("5");
  const [activePage, setActivePage] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sessions, setSessions] = useState([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [subjectResponse, sessionResponse] = await Promise.all([
        fetch(`${API_URL}/subjects`),
        fetch(`${API_URL}/sessions`),
      ]);

      if (!subjectResponse.ok || !sessionResponse.ok) {
        throw new Error(
          "Could not load your study data. Check that the backend is running."
        );
      }

      const [subjectData, sessionData] = await Promise.all([
        subjectResponse.json(),
        sessionResponse.json(),
      ]);

      setSubjects(
        Array.isArray(subjectData)
          ? subjectData
          : subjectData.subjects || []
      );

      setSessions(
        Array.isArray(sessionData)
          ? sessionData
          : sessionData.sessions || []
      );
    } catch (err) {
      setError(err.message || "Unable to connect to StudyPilot API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const plannedSessions = useMemo(
    () => sessions.filter((session) => session.status === "planned"),
    [sessions]
  );

  const completedSessions = useMemo(
    () => sessions.filter((session) => session.status === "completed"),
    [sessions]
  );

  const missedSessions = useMemo(
    () => sessions.filter((session) => session.status === "missed"),
    [sessions]
  );

  const studyMinutes = useMemo(
    () =>
      completedSessions.reduce(
        (sum, session) =>
          sum +
          Math.max(
            0,
            Number(
              session.actualMinutes ??
                session.durationMinutes ??
                session.duration ??
                0
            ) || 0
          ),
        0
      ),
    [completedSessions]
  );

  const upcoming = useMemo(
    () =>
      plannedSessions
        .filter((session) => {
          const dateValue = getSessionDateTime(session);
          if (!dateValue) return false;

          const date = new Date(dateValue);
          return !Number.isNaN(date.getTime()) && date >= new Date();
        })
        .sort(
          (a, b) =>
            new Date(getSessionDateTime(a)).getTime() -
            new Date(getSessionDateTime(b)).getTime()
        )
        .slice(0, 4),
    [plannedSessions]
  );

  async function addSubject(event) {
    event.preventDefault();

    const name = subjectName.trim();
    const hours = Number(targetHours);

    if (!name) {
      setError("Enter a subject name.");
      return;
    }

    if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
      setError("Weekly target must be between 1 and 168 hours.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API_URL}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, targetHours: hours }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Could not add subject."
        );
      }

      setSubjectName("");
      setTargetHours("5");
      setNotice("Subject added successfully.");

      await loadDashboard();
    } catch (err) {
      setError(err.message || "Could not add subject.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSubject(id) {
    if (!id) {
      setError("This subject has no valid ID.");
      return;
    }

    if (
      !window.confirm(
        "Delete this subject? Existing study sessions may still refer to it."
      )
    ) {
      return;
    }

    setError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API_URL}/subjects/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Could not delete subject."
        );
      }

      setNotice("Subject deleted.");
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Could not delete subject.");
    }
  }

  const pageTitles = {
    overview: [
      "Your study space",
      "A little progress each day adds up.",
    ],
    subjects: [
      "Your subjects",
      "Organize what you’re learning, one subject at a time.",
    ],
    planner: [
      "Study planner",
      "Build a realistic plan and protect your focus time.",
    ],
    exams: [
      "Exam preparation",
      "Turn your syllabus into a clear, manageable revision plan.",
    ],
    twin: [
      "Academic Twin",
      "Understand your study patterns and find your next best action.",
    ],
    voice: [
      "Voice Study Coach",
      "Your personal study companion, ready to help you focus.",
    ],
    rescue: [
      "AI Rescue",
      "Recover missed sessions without losing your momentum.",
    ],
  };

  const [heading, subtitle] =
    pageTitles[activePage] || pageTitles.overview;

  function navigate(page) {
    setActivePage(page);
    setMobileNavOpen(false);
    setError("");
    setNotice("");
  }

  const navItems = [
    { id: "overview", label: "Overview", icon: "grid" },
    { id: "subjects", label: "My subjects", icon: "book" },
    { id: "planner", label: "Study planner", icon: "calendar" },
    { id: "exams", label: "Exam prep", icon: "book" },
    {
      id: "twin",
      label: "Academic Twin",
      icon: "target",
      special: true,
    },
    {
      id: "rescue",
      label: "AI Rescue",
      icon: "sparkles",
      special: true,
    },
    {
      id: "voice",
      label: "Voice Coach",
      icon: "sparkles",
      special: true,
    },
  ];

  return (
    <div className="app-shell">
      {mobileNavOpen && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside
        className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}
      >
        <button
          className="brand"
          onClick={() => navigate("overview")}
          aria-label="StudyPilot home"
        >
          <span className="brand-mark">
            <Icon name="sparkles" size={22} />
          </span>
          <span className="brand-copy">
            <strong>
              StudyPilot<span>AI</span>
            </strong>
            <small>YOUR PERSONAL STUDY OS</small>
          </span>
        </button>

        <div className="nav-label">WORKSPACE</div>

        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${
                activePage === item.id ? "active" : ""
              } ${item.special ? "nav-ai" : ""}`}
              onClick={() => navigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.special && <span className="nav-pill">AI</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <div className="tip-orb">
              <Icon name="target" size={18} />
            </div>
            <strong>Small steps. Big goals.</strong>
            <p>
              Consistency beats cramming. Show up for your future self.
            </p>
            <div className="tip-progress">
              <span />
            </div>
          </div>

          <div className="profile-row">
            <div className="avatar">S</div>
            <div className="profile-copy">
              <strong>Study space</strong>
              <span>Personal workspace</span>
            </div>
            <span className="online-dot" />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu icon-button"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Icon name="menu" />
            </button>

            <div className="breadcrumb">
              <span>Workspace</span>
              <b>/</b>
              <strong>
                {navItems.find((item) => item.id === activePage)?.label ||
                  "Overview"}
              </strong>
            </div>
          </div>

          <div className="topbar-right">
            <span className="today-chip">
              <span className="live-dot" />
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>

            <button
              className="icon-button"
              title="Refresh data"
              aria-label="Refresh data"
              onClick={loadDashboard}
              disabled={loading}
            >
              <Icon name="refresh" />
            </button>

            <div className="top-avatar">S</div>
          </div>
        </header>

        <div className="page-content">
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="eyebrow-line" />
                YOUR LEARNING JOURNEY
              </div>
              <h1>{heading}</h1>
              <p>{subtitle}</p>
            </div>

            <div className="heading-actions">
              <span className="status-chip">
                <span className="live-dot" />
                Your personal workspace
              </span>
            </div>
          </section>

          {error && (
            <div className="alert alert-error" role="alert">
              <span>{error}</span>
              <button
                onClick={() => setError("")}
                aria-label="Dismiss error"
              >
                ×
              </button>
            </div>
          )}

          {notice && (
            <div className="alert alert-success" role="status">
              <span>{notice}</span>
              <button
                onClick={() => setNotice("")}
                aria-label="Dismiss message"
              >
                ×
              </button>
            </div>
          )}

          {activePage === "overview" && (
            <>
              <section className="hero-card">
                <div className="hero-content">
                  <div className="hero-badge">
                    <Icon name="sparkles" size={14} />
                    YOUR AI STUDY COMPANION
                  </div>

                  <h2>
                    Make today
                    <br />
                    <span>count.</span>
                  </h2>

                  <p>
                    Plan with purpose, stay consistent, and let every focused
                    session move you closer to your goals.
                  </p>

                  <div className="hero-actions">
                    <button
                      className="button-primary"
                      onClick={() => navigate("planner")}
                    >
                      Plan a study session
                      <Icon name="arrow" size={17} />
                    </button>

                    <button
                      className="button-ghost"
                      onClick={() => navigate("twin")}
                    >
                      Open Academic Twin
                      <Icon name="target" size={16} />
                    </button>
                  </div>
                </div>

                <div className="hero-art" aria-hidden="true">
                  <div className="art-glow" />
                  <div className="orbit orbit-one" />
                  <div className="orbit orbit-two" />
                  <div className="orbit orbit-three" />

                  <div className="art-core">
                    <Icon name="sparkles" size={46} />
                  </div>

                  <div className="float-card float-card-top">
                    <span className="float-icon">
                      <Icon name="check" size={15} />
                    </span>
                    <span>
                      <strong>Keep going</strong>
                      <small>Every session matters</small>
                    </span>
                  </div>

                  <div className="float-card float-card-bottom">
                    <span className="float-mini-bars">
                      <i />
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                    <span>
                      <strong>{completedSessions.length} sessions</strong>
                      <small>completed so far</small>
                    </span>
                  </div>
                </div>

                <div className="hero-decoration">✳</div>
              </section>

              <section className="stats-grid">
                <StatCard
                  label="Subjects"
                  value={loading ? "—" : subjects.length}
                  detail="Your learning areas"
                  icon="book"
                  tone="violet"
                />

                <StatCard
                  label="Planned sessions"
                  value={loading ? "—" : plannedSessions.length}
                  detail="Your scheduled study sessions"
                  icon="calendar"
                  tone="blue"
                />

                <StatCard
                  label="Completed sessions"
                  value={loading ? "—" : completedSessions.length}
                  detail="Sessions marked complete"
                  icon="check"
                  tone="green"
                />

                <StatCard
                  label="Focused time"
                  value={
                    loading
                      ? "—"
                      : `${Math.floor(studyMinutes / 60)}h ${
                          studyMinutes % 60
                        }m`
                  }
                  detail="Based on completed session durations"
                  icon="clock"
                  tone="pink"
                />
              </section>

              <div className="dashboard-grid">
                <section className="panel upcoming-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-eyebrow">STAY ON TRACK</span>
                      <h3>Coming up next</h3>
                    </div>

                    <button
                      className="text-button"
                      onClick={() => navigate("planner")}
                    >
                      View planner
                      <Icon name="arrow" size={15} />
                    </button>
                  </div>

                  {loading ? (
                    <div className="empty-state">
                      <span className="loading-ring" />
                      Loading your sessions…
                    </div>
                  ) : upcoming.length ? (
                    <div className="upcoming-list">
                      {upcoming.map((session, index) => {
                        const date = new Date(getSessionDateTime(session));

                        return (
                          <div
                            className="upcoming-item"
                            key={
                              session._id ||
                              session.id ||
                              `${date}-${index}`
                            }
                          >
                            <div className={`upcoming-date tone-${index % 3}`}>
                              <strong>
                                {date.toLocaleDateString(undefined, {
                                  day: "2-digit",
                                })}
                              </strong>
                              <span>
                                {date.toLocaleDateString(undefined, {
                                  month: "short",
                                })}
                              </span>
                            </div>

                            <div className="upcoming-info">
                              <strong>{getSessionSubject(session)}</strong>
                              <span>
                                <Icon name="clock" size={13} />
                                {date.toLocaleTimeString(undefined, {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}{" "}
                                ·{" "}
                                {session.durationMinutes ??
                                  session.duration ??
                                  0}{" "}
                                min
                              </span>
                            </div>

                            <span className="planned-tag">Planned</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <span className="empty-icon">
                        <Icon name="calendar" size={22} />
                      </span>
                      <strong>Your next session starts here</strong>
                      <p>
                        Plan a session and it’ll show up in this space.
                      </p>
                      <button
                        className="button-primary button-small"
                        onClick={() => navigate("planner")}
                      >
                        Create a plan
                        <Icon name="arrow" size={14} />
                      </button>
                    </div>
                  )}
                </section>

                <section className="panel progress-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="section-eyebrow">YOUR MOMENTUM</span>
                      <h3>Study snapshot</h3>
                    </div>
                    <span className="snapshot-icon">
                      <Icon name="target" />
                    </span>
                  </div>

                  <div className="snapshot-number">
                    {completedSessions.length}
                    <span> / {sessions.length}</span>
                  </div>

                  <p className="snapshot-caption">
                    sessions completed overall
                  </p>

                  <div className="progress-track">
                    <span
                      style={{
                        width: `${
                          sessions.length
                            ? Math.min(
                                100,
                                (completedSessions.length / sessions.length) *
                                  100
                              )
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  <div className="progress-meta">
                    <span>Completion rate</span>
                    <strong>
                      {sessions.length
                        ? Math.round(
                            (completedSessions.length / sessions.length) * 100
                          )
                        : 0}
                      %
                    </strong>
                  </div>

                  <div className="snapshot-divider" />

                  <div className="snapshot-row">
                    <span className="snapshot-dot dot-violet" />
                    Subjects you’re studying
                    <strong>{subjects.length}</strong>
                  </div>

                  <div className="snapshot-row">
                    <span className="snapshot-dot dot-pink" />
                    Sessions to recover
                    <strong>{missedSessions.length}</strong>
                  </div>

                  <button
                    className="rescue-callout"
                    onClick={() => navigate("rescue")}
                  >
                    <span className="rescue-callout-icon">
                      <Icon name="sparkles" />
                    </span>
                    <span>
                      <strong>Need a reset?</strong>
                      <small>
                        AI Rescue can help you get back on track.
                      </small>
                    </span>
                    <Icon name="arrow" size={17} />
                  </button>
                </section>
              </div>

              <section className="bottom-cta">
                <div className="cta-symbol">
                  <Icon name="target" size={21} />
                </div>

                <div>
                  <strong>Meet your Academic Twin</strong>
                  <p>
                    Review your study patterns, subject risks, and recommended
                    next steps.
                  </p>
                </div>

                <button
                  className="button-secondary"
                  onClick={() => navigate("twin")}
                >
                  View Academic Twin
                  <Icon name="arrow" size={15} />
                </button>
              </section>
            </>
          )}

          {activePage === "subjects" && (
            <section className="workspace-grid">
              <div className="panel subject-form-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-eyebrow">
                      BUILD YOUR CURRICULUM
                    </span>
                    <h3>Add a subject</h3>
                  </div>

                  <span className="panel-icon violet-icon">
                    <Icon name="book" />
                  </span>
                </div>

                <p className="panel-description">
                  Keep your learning areas in one place and set a target to
                  stay intentional.
                </p>

                <form onSubmit={addSubject} className="subject-form">
                  <label htmlFor="subject-name">Subject name</label>
                  <input
                    id="subject-name"
                    value={subjectName}
                    onChange={(event) => setSubjectName(event.target.value)}
                    placeholder="e.g. Data Structures"
                    maxLength={100}
                    required
                  />

                  <label htmlFor="target-hours">Weekly target (hours)</label>
                  <input
                    id="target-hours"
                    type="number"
                    min="1"
                    max="168"
                    value={targetHours}
                    onChange={(event) => setTargetHours(event.target.value)}
                    required
                  />

                  <button
                    className="button-primary full-width"
                    disabled={saving}
                  >
                    {saving ? (
                      "Adding subject…"
                    ) : (
                      <>
                        <Icon name="plus" size={17} />
                        Add subject
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="panel subjects-list-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-eyebrow">
                      YOUR LEARNING AREAS
                    </span>
                    <h3>
                      All subjects{" "}
                      <span className="count-bubble">{subjects.length}</span>
                    </h3>
                  </div>

                  <button
                    className="icon-button"
                    aria-label="Refresh subjects"
                    onClick={loadDashboard}
                    disabled={loading}
                  >
                    <Icon name="refresh" />
                  </button>
                </div>

                {loading ? (
                  <div className="empty-state">
                    <span className="loading-ring" />
                    Loading subjects…
                  </div>
                ) : subjects.length ? (
                  <div className="subject-list">
                    {subjects.map((subject, index) => (
                      <article
                        className="subject-row"
                        key={subject._id || subject.id || subject.name}
                      >
                        <div
                          className={`subject-symbol subject-symbol-${
                            index % 4
                          }`}
                        >
                          <Icon name="book" />
                        </div>

                        <div className="subject-row-main">
                          <strong>{subject.name}</strong>
                          <span>
                            <Icon name="target" size={13} />
                            {subject.targetHours ?? 5} target hours / week
                          </span>

                          <div className="subject-progress">
                            <span
                              style={{
                                width: `${Math.min(
                                  100,
                                  (Number(subject.targetHours || 5) / 20) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>

                        <button
                          className="icon-button danger-icon"
                          title={`Delete ${subject.name}`}
                          aria-label={`Delete ${subject.name}`}
                          onClick={() =>
                            deleteSubject(subject._id || subject.id)
                          }
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <Icon name="book" />
                    </span>
                    <strong>No subjects yet</strong>
                    <p>
                      Add your first subject to start building your study
                      space.
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}

          {activePage === "planner" && (
            <StudyPlanner onDataChange={loadDashboard} />
          )}

          {activePage === "exams" && <ExamPrep subjects={subjects} />}

          {activePage === "twin" && (
            <AcademicTwin
              onNavigate={navigate}
              onDataChange={loadDashboard}
            />
          )}

          {activePage === "rescue" && (
            <AIRescue onDataChange={loadDashboard} />
          )}

          {activePage === "voice" && (
            <VoiceCoach onNavigate={navigate} />
          )}

          <footer className="app-footer">
            <span>
              <span className="footer-spark">✳</span> StudyPilot AI
            </span>
            <span>Built for your next breakthrough.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;