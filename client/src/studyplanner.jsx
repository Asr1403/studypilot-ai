
import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = "http://localhost:3000/api";

const styles = {
  card: {
    background: "linear-gradient(145deg, #171a30, #111426)",
    border: "1px solid rgba(171,177,225,0.14)",
    borderRadius: "16px",
    padding: "20px",
    color: "#eeefff",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 12px",
    color: "#eeefff",
    background: "#0c0f1e",
    border: "1px solid rgba(171,177,225,0.18)",
    borderRadius: "9px",
    outline: "none",
  },
  primaryButton: {
    padding: "11px 15px",
    color: "#fff",
    background: "linear-gradient(105deg, #8d6bfa, #7252e8)",
    border: "1px solid transparent",
    borderRadius: "9px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "10px 13px",
    color: "#d7d2f5",
    background: "#171a30",
    border: "1px solid rgba(171,177,225,0.16)",
    borderRadius: "9px",
    fontWeight: 600,
    cursor: "pointer",
  },
};

// Return a YYYY-MM-DD date without timezone-shifting date-only values.
function getSessionDate(session) {
  if (session?.date && /^\d{4}-\d{2}-\d{2}$/.test(session.date)) {
    return session.date;
  }

  const value = session?.startTime;
  if (!value) return "";

  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return value.slice(0, 10);
  }

  return "";
}

// Existing database records store the time separately, e.g. "18:00".
function getSessionTime(session) {
  const value = session?.startTime;
  if (!value) return "";

  const match = String(value).match(/(?:T|\s)(\d{2}:\d{2})/);
  if (match) return match[1];

  if (/^\d{2}:\d{2}$/.test(String(value))) {
    return value;
  }

  return "";
}

function formatDate(dateValue) {
  if (!dateValue) return "Date not set";

  const match = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  let date;

  if (match) {
    date = new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3])
    );
  } else {
    date = new Date(dateValue);
  }

  if (Number.isNaN(date.getTime())) return "Date not set";

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(timeValue) {
  if (!timeValue) return "";

  const match = String(timeValue).match(/^(\d{2}):(\d{2})$/);
  if (!match) return "";

  const date = new Date();
  date.setHours(Number(match[1]), Number(match[2]), 0, 0);

  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getSessionMinutes(session) {
  const duration = Number(
    session?.durationMinutes ?? session?.duration ?? 0
  );

  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function getCompletedMinutes(sessions) {
  return sessions.reduce((total, session) => {
    if (session.status !== "completed") return total;
    return total + getSessionMinutes(session);
  }, 0);
}

function getStatusColor(status) {
  switch (status) {
    case "completed":
      return "#62dfb3";
    case "missed":
      return "#ff8297";
    default:
      return "#a58aff";
  }
}

function StatusBadge({ status }) {
  const label =
    status?.charAt(0).toUpperCase() + status?.slice(1) || "Planned";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "5px 9px",
        color: getStatusColor(status),
        background: `${getStatusColor(status)}14`,
        border: `1px solid ${getStatusColor(status)}35`,
        borderRadius: "7px",
        fontSize: "11px",
        fontWeight: 700,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function SessionCard({ session, onComplete, onMiss, onDelete, busy }) {
  const completed = session.status === "completed";
  const missed = session.status === "missed";
  const subject = session.subjectName || session.subject || "Study session";
  const date = getSessionDate(session);
  const time = getSessionTime(session);

  return (
    <article
      style={{
        ...styles.card,
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "13px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h4
            style={{
              margin: "0 0 7px",
              fontSize: "15px",
              fontWeight: 700,
              overflowWrap: "anywhere",
            }}
          >
            {subject}
          </h4>

          <p
            style={{
              margin: 0,
              color: "#969dbc",
              fontSize: "12px",
              lineHeight: 1.7,
            }}
          >
            {formatDate(date)}
            {time && <>{" · "}{formatTime(time)}</>}
          </p>
        </div>

        <StatusBadge status={session.status} />
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px",
          color: "#b1b7d3",
          fontSize: "12px",
        }}
      >
        <span>◷ {getSessionMinutes(session)} minutes</span>
        {completed && (
          <span style={{ color: "#62dfb3" }}>✓ Focus time earned</span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          paddingTop: "4px",
          borderTop: "1px solid rgba(171,177,225,0.09)",
        }}
      >
        {!completed && !missed && (
          <>
            <button
              type="button"
              style={styles.primaryButton}
              disabled={busy}
              onClick={() => onComplete(session)}
            >
              {busy ? "Saving..." : "✓ Mark complete"}
            </button>

            <button
              type="button"
              style={styles.secondaryButton}
              disabled={busy}
              onClick={() => onMiss(session)}
            >
              Mark missed
            </button>
          </>
        )}

        <button
          type="button"
          style={{
            ...styles.secondaryButton,
            color: "#ff9cac",
            marginLeft: "auto",
          }}
          disabled={busy}
          onClick={() => onDelete(session)}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

export default function StudyPlanner() {
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busySessionId, setBusySessionId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    subjectId: "",
    startTime: "",
    duration: 45,
  });

  const getSessionId = useCallback((session) => {
    return session?._id || session?.id;
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [subjectResponse, sessionResponse] = await Promise.all([
        fetch(`${API_URL}/subjects`),
        fetch(`${API_URL}/sessions`),
      ]);

      if (!subjectResponse.ok || !sessionResponse.ok) {
        throw new Error("Unable to load your planner data. Please try again.");
      }

      const [subjectData, sessionData] = await Promise.all([
        subjectResponse.json(),
        sessionResponse.json(),
      ]);

      setSubjects(Array.isArray(subjectData) ? subjectData : []);
      setSessions(Array.isArray(sessionData) ? sessionData : []);
    } catch (err) {
      setError(
        err.message ||
          "Could not connect to StudyPilot. Check that the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const completedMinutes = useMemo(
    () => getCompletedMinutes(sessions),
    [sessions]
  );

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

  const sortedSessions = useMemo(
    () =>
      [...sessions].sort((a, b) => {
        const aValue = `${getSessionDate(a)}T${getSessionTime(a) || "00:00"}`;
        const bValue = `${getSessionDate(b)}T${getSessionTime(b) || "00:00"}`;
        return aValue.localeCompare(bValue);
      }),
    [sessions]
  );

  const updateForm = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: name === "duration" ? Number(value) : value,
    }));
  };

  const createSession = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.subjectId) {
      setError("Please choose a subject.");
      return;
    }

    if (!form.startTime) {
      setError("Please choose a date and time.");
      return;
    }

    // datetime-local is normalized to YYYY-MM-DDTHH:mm.
    const [date, time] = form.startTime.split("T");

    if (
      !date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !time ||
      !/^\d{2}:\d{2}$/.test(time)
    ) {
      setError("Please choose a valid date and time.");
      return;
    }

    const [year, month, day] = date.split("-").map(Number);
    const [hours, minutes] = time.split(":").map(Number);
    const localDate = new Date(year, month - 1, day, hours, minutes);

    if (
      localDate.getFullYear() !== year ||
      localDate.getMonth() !== month - 1 ||
      localDate.getDate() !== day ||
      localDate.getHours() !== hours ||
      localDate.getMinutes() !== minutes
    ) {
      setError("Please enter a valid date and time.");
      return;
    }

    if (localDate.getTime() < Date.now()) {
      setError("Choose a future date and time for your study session.");
      return;
    }

    if (!Number.isFinite(form.duration) || form.duration < 5) {
      setError("Session duration must be at least 5 minutes.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: form.subjectId,
          date,
          startTime: time,
          durationMinutes: Number(form.duration),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Unable to create the study session."
        );
      }

      setForm((previous) => ({ ...previous, startTime: "" }));
      setSuccess("Your study session has been scheduled.");
      await fetchData();
    } catch (err) {
      setError(
        err.message || "Could not schedule the session. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const changeSessionStatus = async (session, status) => {
    const sessionId = getSessionId(session);

    if (!sessionId) {
      setError("This session does not have a valid ID.");
      return;
    }

    setError("");
    setSuccess("");
    setBusySessionId(sessionId);

    try {
      const response = await fetch(
        `${API_URL}/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Unable to update the session status."
        );
      }

      setSuccess(
        status === "completed"
          ? `Session completed! ${getSessionMinutes(session)} focus minutes added.`
          : "Session marked as missed."
      );

      await fetchData();
    } catch (err) {
      setError(
        err.message || "Could not update the session. Please try again."
      );
    } finally {
      setBusySessionId(null);
    }
  };

  const deleteSession = async (session) => {
    const sessionId = getSessionId(session);

    if (!sessionId) {
      setError("This session does not have a valid ID.");
      return;
    }

    if (
      !window.confirm(
        "Delete this study session? This action cannot be undone."
      )
    ) {
      return;
    }

    setError("");
    setSuccess("");
    setBusySessionId(sessionId);

    try {
      const response = await fetch(
        `${API_URL}/sessions/${encodeURIComponent(sessionId)}`,
        { method: "DELETE" }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || data.message || "Unable to delete the session."
        );
      }

      setSuccess("Study session deleted.");
      await fetchData();
    } catch (err) {
      setError(
        err.message || "Could not delete the session. Please try again."
      );
    } finally {
      setBusySessionId(null);
    }
  };

  const minimumDateTime = new Date(
    Date.now() - new Date().getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);

  return (
    <section
      id="study-planner"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "22px",
        color: "#eeefff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div
            style={{
              color: "#a58aff",
              fontSize: "10px",
              fontWeight: 800,
              letterSpacing: "1.6px",
              marginBottom: "9px",
            }}
          >
            PLAN · FOCUS · ACHIEVE
          </div>

          <h2
            style={{
              margin: "0 0 8px",
              fontSize: "27px",
              fontWeight: 700,
              letterSpacing: "-0.8px",
            }}
          >
            Study Planner
          </h2>

          <p
            style={{
              maxWidth: "560px",
              margin: 0,
              color: "#969dbc",
              fontSize: "13px",
            }}
          >
            Build a realistic study schedule, track completed focus time,
            and stay consistent with your exam preparation.
          </p>
        </div>

        <button
          type="button"
          style={styles.secondaryButton}
          onClick={fetchData}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {error && (
        <div
          role="alert"
          style={{
            padding: "13px 15px",
            color: "#ffb3c0",
            border: "1px solid rgba(255,130,151,0.24)",
            borderRadius: "10px",
            background: "rgba(255,130,151,0.07)",
            fontSize: "12px",
            lineHeight: 1.6,
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          style={{
            padding: "13px 15px",
            color: "#91e8c9",
            border: "1px solid rgba(98,223,179,0.22)",
            borderRadius: "10px",
            background: "rgba(98,223,179,0.06)",
            fontSize: "12px",
            lineHeight: 1.6,
          }}
        >
          {success}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "13px",
        }}
      >
        <div style={styles.card}>
          <p style={{ color: "#969dbc", fontSize: "12px", margin: 0 }}>
            Total focus time
          </p>
          <div
            style={{
              marginTop: "10px",
              fontSize: "28px",
              fontWeight: 800,
              letterSpacing: "-0.7px",
            }}
          >
            {Math.floor(completedMinutes / 60)}
            <span style={{ color: "#a58aff", fontSize: "15px" }}>h </span>
            {completedMinutes % 60}
            <span style={{ color: "#a58aff", fontSize: "15px" }}>m</span>
          </div>
          <p style={{ color: "#7e86a6", fontSize: "11px", margin: "7px 0 0" }}>
            From completed sessions
          </p>
        </div>

        <div style={styles.card}>
          <p style={{ color: "#969dbc", fontSize: "12px", margin: 0 }}>
            Planned sessions
          </p>
          <div style={{ marginTop: "10px", fontSize: "28px", fontWeight: 800 }}>
            {plannedSessions.length}
          </div>
          <p style={{ color: "#7e86a6", fontSize: "11px", margin: "7px 0 0" }}>
            Ready for your next focus block
          </p>
        </div>

        <div style={styles.card}>
          <p style={{ color: "#969dbc", fontSize: "12px", margin: 0 }}>
            Completed sessions
          </p>
          <div style={{ marginTop: "10px", fontSize: "28px", fontWeight: 800 }}>
            {completedSessions.length}
          </div>
          <p style={{ color: "#7e86a6", fontSize: "11px", margin: "7px 0 0" }}>
            Every finished session counts
          </p>
        </div>

        <div style={styles.card}>
          <p style={{ color: "#969dbc", fontSize: "12px", margin: 0 }}>
            Missed sessions
          </p>
          <div
            style={{
              marginTop: "10px",
              color: missedSessions.length ? "#ff9cac" : "#eeefff",
              fontSize: "28px",
              fontWeight: 800,
            }}
          >
            {missedSessions.length}
          </div>
          <p style={{ color: "#7e86a6", fontSize: "11px", margin: "7px 0 0" }}>
            You can recover missed study time
          </p>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
          gap: "18px",
          alignItems: "start",
        }}
      >
        <form onSubmit={createSession} style={styles.card}>
          <h3 style={{ margin: "0 0 7px", fontSize: "18px" }}>
            Schedule a session
          </h3>

          <p
            style={{
              margin: "0 0 20px",
              color: "#969dbc",
              fontSize: "12px",
              lineHeight: 1.7,
            }}
          >
            Choose a subject and reserve time for focused learning.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
            <label
              htmlFor="planner-subject"
              style={{ color: "#c4c9e2", fontSize: "12px", fontWeight: 600 }}
            >
              Subject
            </label>

            <select
              id="planner-subject"
              name="subjectId"
              value={form.subjectId}
              onChange={updateForm}
              required
              style={styles.input}
              disabled={loading || subjects.length === 0}
            >
              <option value="">
                {subjects.length ? "Select a subject" : "Add a subject first"}
              </option>

              {subjects.map((subject) => (
                <option
                  key={subject._id || subject.id}
                  value={subject._id || subject.id}
                >
                  {subject.name}
                </option>
              ))}
            </select>

            <label
              htmlFor="planner-start-time"
              style={{
                marginTop: "9px",
                color: "#c4c9e2",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              Date and start time
            </label>

            <input
              id="planner-start-time"
              name="startTime"
              type="datetime-local"
              value={form.startTime}
              onChange={updateForm}
              min={minimumDateTime}
              required
              style={styles.input}
            />

            <label
              htmlFor="planner-duration"
              style={{
                marginTop: "9px",
                color: "#c4c9e2",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              Duration
            </label>

            <select
              id="planner-duration"
              name="duration"
              value={form.duration}
              onChange={updateForm}
              style={styles.input}
            >
              <option value={25}>25 minutes · Short focus</option>
              <option value={45}>45 minutes · Standard</option>
              <option value={60}>60 minutes · Deep work</option>
              <option value={90}>90 minutes · Intensive</option>
              <option value={120}>120 minutes · Extended</option>
            </select>

            <button
              type="submit"
              style={{ ...styles.primaryButton, marginTop: "10px" }}
              disabled={saving || loading || subjects.length === 0}
            >
              {saving ? "Scheduling..." : "+ Schedule study session"}
            </button>

            {subjects.length === 0 && !loading && (
              <p
                style={{
                  margin: "3px 0 0",
                  color: "#f0c68a",
                  fontSize: "11px",
                  lineHeight: 1.6,
                }}
              >
                Create a subject first, then return here to schedule sessions.
              </p>
            )}
          </div>
        </form>

        <div style={styles.card}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "10px",
              marginBottom: "17px",
            }}
          >
            <h3 style={{ margin: 0, fontSize: "18px" }}>Your sessions</h3>
            <span
              style={{
                padding: "5px 8px",
                color: "#c7b9ff",
                fontSize: "10px",
                borderRadius: "7px",
                background: "rgba(153,121,255,0.12)",
              }}
            >
              {sessions.length} total
            </span>
          </div>

          {loading ? (
            <div style={{ padding: "35px 10px", textAlign: "center" }}>
              <p style={{ color: "#969dbc", fontSize: "12px" }}>
                Loading your study sessions...
              </p>
            </div>
          ) : sortedSessions.length === 0 ? (
            <div
              style={{
                padding: "32px 15px",
                color: "#969dbc",
                textAlign: "center",
                border: "1px dashed rgba(171,177,225,0.18)",
                borderRadius: "12px",
              }}
            >
              <div style={{ fontSize: "27px", marginBottom: "10px" }}>✦</div>
              <strong style={{ color: "#eeefff", fontSize: "13px" }}>
                Your schedule starts here
              </strong>
              <p style={{ fontSize: "11px", lineHeight: 1.7 }}>
                Schedule your first study session to start tracking focus time.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {sortedSessions.map((session) => {
                const sessionId = getSessionId(session);

                return (
                  <SessionCard
                    key={sessionId}
                    session={session}
                    busy={busySessionId === sessionId}
                    onComplete={(item) => changeSessionStatus(item, "completed")}
                    onMiss={(item) => changeSessionStatus(item, "missed")}
                    onDelete={deleteSession}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>
        {`
          #study-planner input[type="datetime-local"]::-webkit-calendar-picker-indicator {
            cursor: pointer;
            filter: invert(0.8);
          }

          #study-planner option {
            color: #eeefff;
            background: #111426;
          }
        `}
      </style>
    </section>
  );
}
