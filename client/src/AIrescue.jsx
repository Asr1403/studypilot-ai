
import { useCallback, useEffect, useState } from "react";

const API_URL = "http://localhost:3000/api";

const styles = {
  page: {
    color: "#f1f5f9",
    width: "100%",
    padding: "8px 0 36px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
    flexWrap: "wrap",
    marginBottom: "26px",
  },
  eyebrow: {
    color: "#a78bfa",
    fontSize: "12px",
    fontWeight: 700,
    letterSpacing: "1.8px",
    textTransform: "uppercase",
    marginBottom: "8px",
  },
  title: {
    fontSize: "clamp(25px, 4vw, 34px)",
    fontWeight: 750,
    letterSpacing: "-1px",
    margin: "0 0 9px",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "14px",
    lineHeight: 1.7,
    margin: 0,
    maxWidth: "620px",
  },
  button: {
    background: "linear-gradient(135deg, #7c3aed, #6366f1)",
    border: "1px solid #8b5cf6",
    borderRadius: "10px",
    color: "#fff",
    padding: "11px 16px",
    fontSize: "13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#171c31",
    border: "1px solid #303750",
    borderRadius: "9px",
    color: "#dbe4f0",
    padding: "9px 13px",
    fontSize: "12px",
    fontWeight: 650,
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "14px",
    marginBottom: "24px",
  },
  statCard: {
    background: "linear-gradient(145deg, #171b30, #111526)",
    border: "1px solid #292f49",
    borderRadius: "15px",
    padding: "19px",
    minWidth: 0,
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: "12px",
    marginBottom: "12px",
  },
  statValue: {
    color: "#f8fafc",
    fontSize: "29px",
    fontWeight: 750,
    letterSpacing: "-0.8px",
  },
  statNote: {
    color: "#818da5",
    fontSize: "11px",
    marginTop: "7px",
  },
  panel: {
    background: "#111526",
    border: "1px solid #292f49",
    borderRadius: "16px",
    padding: "20px",
    marginBottom: "20px",
    minWidth: 0,
  },
  panelTitle: {
    fontSize: "17px",
    fontWeight: 720,
    margin: "0 0 6px",
    color: "#f1f5f9",
  },
  panelDescription: {
    color: "#8793aa",
    fontSize: "12px",
    lineHeight: 1.6,
    margin: "0 0 17px",
  },
  sessionCard: {
    background: "#171c30",
    border: "1px solid #2a314b",
    borderRadius: "12px",
    padding: "15px",
    marginBottom: "10px",
    minWidth: 0,
  },
  sessionTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#e5eaf3",
    overflowWrap: "anywhere",
  },
  muted: {
    color: "#94a3b8",
    fontSize: "12px",
    lineHeight: 1.7,
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: "999px",
    background: "#30264d",
    color: "#c4b5fd",
    border: "1px solid #493774",
    fontSize: "10px",
    fontWeight: 700,
    padding: "5px 9px",
    whiteSpace: "nowrap",
  },
  error: {
    background: "#351b2a",
    border: "1px solid #713047",
    color: "#fda4af",
    borderRadius: "10px",
    padding: "12px 14px",
    fontSize: "13px",
    marginBottom: "16px",
  },
  success: {
    background: "#122d2b",
    border: "1px solid #225b50",
    color: "#86efac",
    borderRadius: "10px",
    padding: "12px 14px",
    fontSize: "13px",
    marginBottom: "16px",
  },
  empty: {
    color: "#94a3b8",
    textAlign: "center",
    padding: "25px 12px",
    border: "1px dashed #303750",
    borderRadius: "11px",
    fontSize: "13px",
    lineHeight: 1.7,
  },
  slot: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "13px",
    background: "#171c30",
    border: "1px solid #303750",
    borderRadius: "10px",
    marginBottom: "9px",
    cursor: "pointer",
  },
  divider: {
    border: 0,
    borderTop: "1px solid #292f49",
    margin: "17px 0",
  },
};

function formatDate(value) {
  if (!value) return "Date not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getSessionId(session) {
  return session?._id ?? session?.id;
}

function getSubjectName(session) {
  if (typeof session?.subject === "string") {
    return session.subject;
  }

  return (
    session?.subjectName ??
    session?.subject?.name ??
    "Study session"
  );
}

function getDuration(session) {
  const value = Number(session?.duration ?? session?.durationMinutes ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function getSessionDate(session) {
  return (
    session?.startTime ??
    session?.scheduledAt ??
    session?.dateTime ??
    session?.date ??
    null
  );
}

function formatMinutes(value) {
  const minutes = Math.max(0, Number(value) || 0);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) return `${remainingMinutes} min`;
  if (remainingMinutes === 0) return `${hours} hr`;
  return `${hours} hr ${remainingMinutes} min`;
}

function SessionCard({ session, children, label }) {
  return (
    <div style={styles.sessionCard}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={styles.sessionTitle}>
            {getSubjectName(session)}
          </div>

          <div style={{ ...styles.muted, marginTop: "7px" }}>
            {formatDate(getSessionDate(session))}
          </div>

          <div style={{ ...styles.muted, marginTop: "3px" }}>
            Planned duration: {formatMinutes(getDuration(session))}
          </div>
        </div>

        {label && <span style={styles.pill}>{label}</span>}
      </div>

      {children && (
        <>
          <hr style={styles.divider} />
          {children}
        </>
      )}
    </div>
  );
}

function RecoveryProposal({ session, onCreated, onCancel }) {
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const missedSessionId = getSessionId(session);

  const loadSuggestions = useCallback(async () => {
    if (!missedSessionId) {
      setError("This missed session has no ID, so recovery slots cannot be loaded.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(
        `${API_URL}/rescue/suggestions?sessionId=${encodeURIComponent(missedSessionId)}`
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Could not load recovery suggestions."
        );
      }

      const slots = Array.isArray(data)
        ? data
        : data.suggestions ?? data.slots ?? [];

      setSuggestions(slots);

      if (slots.length > 0) {
        setSelectedSlot((previous) => {
          const stillExists = slots.some(
            (slot, index) => String(slot._id ?? slot.id ?? index) === previous
          );

          return stillExists
            ? previous
            : String(slots[0]._id ?? slots[0].id ?? 0);
        });
      } else {
        setSelectedSlot("");
      }
    } catch (err) {
      setError(err.message || "Could not load recovery suggestions.");
    } finally {
      setLoading(false);
    }
  }, [missedSessionId]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  async function approveRecovery() {
    const slotIndex = suggestions.findIndex(
      (slot, index) =>
        String(slot._id ?? slot.id ?? index) === selectedSlot
    );

    if (slotIndex < 0) {
      setError("Select a suggested time first.");
      return;
    }

    const slot = suggestions[slotIndex];

    // Support both common response shapes for suggested slots.
    const startTime =
      slot.startTime ??
      slot.scheduledAt ??
      slot.dateTime ??
      slot.date;

    if (!startTime) {
      setError("The selected suggestion has no start time.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        subject: getSubjectName(session),
        startTime,
        duration: getDuration(session) || 45,
        status: "planned",
      };

      const response = await fetch(`${API_URL}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 409) {
        throw new Error(
          data.message ||
            "That time conflicts with another planned session. Choose another suggestion."
        );
      }

      if (!response.ok) {
        throw new Error(
          data.message || data.error || "Could not create the recovery session."
        );
      }

      setSuccess("Recovery session created successfully.");

      // Keep the original missed session unchanged.
      if (typeof onCreated === "function") {
        await onCreated(data);
      }
    } catch (err) {
      setError(err.message || "Could not create the recovery session.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ ...styles.panel, borderColor: "#514078" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={styles.eyebrow}>Recovery planner</div>
          <h3 style={styles.panelTitle}>
            Reschedule {getSubjectName(session)}
          </h3>
          <p style={styles.panelDescription}>
            Choose an available suggested time. Your original missed session
            will remain in your history.
          </p>
        </div>

        <button
          type="button"
          style={styles.secondaryButton}
          onClick={onCancel}
          disabled={saving}
        >
          Close
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {loading ? (
        <div style={styles.empty}>Finding available study slots…</div>
      ) : suggestions.length === 0 ? (
        <div style={styles.empty}>
          No recovery slots are available right now. Try refreshing or plan a
          new session from the Study Planner.
          <div style={{ marginTop: "13px" }}>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={loadSuggestions}
            >
              Try again
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: "15px" }}>
            {suggestions.map((slot, index) => {
              const slotId = String(slot._id ?? slot.id ?? index);
              const dateValue =
                slot.startTime ??
                slot.scheduledAt ??
                slot.dateTime ??
                slot.date;

              const isSelected = selectedSlot === slotId;

              return (
                <label
                  key={slotId}
                  style={{
                    ...styles.slot,
                    borderColor: isSelected ? "#8b5cf6" : "#303750",
                    background: isSelected ? "#211b3b" : "#171c30",
                  }}
                >
                  <input
                    type="radio"
                    name={`recovery-${missedSessionId}`}
                    value={slotId}
                    checked={isSelected}
                    onChange={() => setSelectedSlot(slotId)}
                    style={{ marginTop: "3px", accentColor: "#a78bfa" }}
                  />

                  <span style={{ minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        color: "#e2e8f0",
                        fontSize: "13px",
                        fontWeight: 650,
                      }}
                    >
                      {formatDate(dateValue)}
                    </span>

                    <span
                      style={{
                        display: "block",
                        color: "#94a3b8",
                        fontSize: "11px",
                        marginTop: "5px",
                      }}
                    >
                      {formatMinutes(getDuration(session))} study session
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <button
            type="button"
            style={{
              ...styles.button,
              opacity: saving ? 0.7 : 1,
              cursor: saving ? "wait" : "pointer",
            }}
            onClick={approveRecovery}
            disabled={saving || !selectedSlot}
          >
            {saving ? "Creating session…" : "Confirm recovery session"}
          </button>
        </>
      )}
    </div>
  );
}

export default function AIRescue() {
  const [analysis, setAnalysis] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedSession, setSelectedSession] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [analysisResponse, sessionsResponse] = await Promise.all([
        fetch(`${API_URL}/rescue/analysis`),
        fetch(`${API_URL}/sessions`),
      ]);

      const [analysisData, sessionsData] = await Promise.all([
        analysisResponse.json().catch(() => ({})),
        sessionsResponse.json().catch(() => ({})),
      ]);

      if (!analysisResponse.ok) {
        throw new Error(
          analysisData.message ||
            analysisData.error ||
            "Could not load rescue analysis."
        );
      }

      if (!sessionsResponse.ok) {
        throw new Error(
          sessionsData.message ||
            sessionsData.error ||
            "Could not load study sessions."
        );
      }

      setAnalysis(analysisData);

      const sessionList = Array.isArray(sessionsData)
        ? sessionsData
        : sessionsData.sessions ?? [];

      setSessions(sessionList);
    } catch (err) {
      setError(
        `${err.message || "Unable to connect to the backend."} Make sure the server is running on port 3000.`
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const missedSessions = sessions.filter(
    (session) => session.status === "missed"
  );

  const plannedSessions = sessions
    .filter((session) => session.status === "planned")
    .sort(
      (a, b) =>
        new Date(getSessionDate(a) || 0).getTime() -
        new Date(getSessionDate(b) || 0).getTime()
    );

  const completedSessions = sessions.filter(
    (session) => session.status === "completed"
  );

  const completedMinutes = completedSessions.reduce(
    (total, session) => total + getDuration(session),
    0
  );

  const missedMinutes = missedSessions.reduce(
    (total, session) => total + getDuration(session),
    0
  );

  const nextSession = plannedSessions.find((session) => {
    const date = new Date(getSessionDate(session) || 0);
    return !Number.isNaN(date.getTime()) && date.getTime() >= Date.now();
  });

  async function handleRecoveryCreated() {
    setNotice("Your recovery session has been added to the planner.");
    setSelectedSession(null);
    await loadData();
  }

  return (
    <section id="ai-rescue" style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>StudyPilot AI · Smart recovery</div>
          <h2 style={styles.title}>AI Study Rescue</h2>
          <p style={styles.subtitle}>
            Recover from missed study sessions, find open time slots, and get
            back to your study plan without losing your progress history.
          </p>
        </div>

        <button
          type="button"
          style={styles.button}
          onClick={() => {
            setNotice("");
            loadData();
          }}
          disabled={loading}
        >
          {loading ? "Refreshing…" : "↻ Refresh analysis"}
        </button>
      </header>

      {error && <div style={styles.error}>{error}</div>}
      {notice && <div style={styles.success}>{notice}</div>}

      <div style={styles.grid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Missed sessions</div>
          <div style={styles.statValue}>{missedSessions.length}</div>
          <div style={styles.statNote}>Sessions waiting for recovery</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Study time missed</div>
          <div style={styles.statValue}>{formatMinutes(missedMinutes)}</div>
          <div style={styles.statNote}>Based on planned session durations</div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Completed study time</div>
          <div style={styles.statValue}>{formatMinutes(completedMinutes)}</div>
          <div style={styles.statNote}>
            Counts completed sessions only
          </div>
        </div>

        <div style={styles.statCard}>
          <div style={styles.statLabel}>Planned sessions</div>
          <div style={styles.statValue}>{plannedSessions.length}</div>
          <div style={styles.statNote}>
            {nextSession
              ? `Next: ${formatDate(getSessionDate(nextSession))}`
              : "No upcoming session found"}
          </div>
        </div>
      </div>

      {loading && sessions.length === 0 ? (
        <div style={styles.empty}>Loading your study recovery dashboard…</div>
      ) : (
        <>
          <div style={styles.panel}>
            <div style={styles.eyebrow}>Priority action</div>
            <h3 style={styles.panelTitle}>Sessions to recover</h3>
            <p style={styles.panelDescription}>
              Select a missed session to find suggested replacement times.
              Recovery creates a new planned session and preserves the
              original missed record.
            </p>

            {missedSessions.length === 0 ? (
              <div style={styles.empty}>
                <div style={{ fontSize: "25px", marginBottom: "8px" }}>
                  ✨
                </div>
                <div
                  style={{
                    color: "#e2e8f0",
                    fontWeight: 700,
                    marginBottom: "6px",
                  }}
                >
                  You're caught up!
                </div>
                There are no missed sessions to recover. Keep following your
                study plan to maintain your progress.
              </div>
            ) : (
              missedSessions.map((session) => {
                const sessionId = getSessionId(session);
                const isSelected =
                  String(getSessionId(selectedSession)) ===
                  String(sessionId);

                return (
                  <SessionCard
                    key={sessionId}
                    session={session}
                    label="MISSED"
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "12px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={styles.muted}>
                        {formatMinutes(getDuration(session))} to recover
                      </span>

                      <button
                        type="button"
                        style={isSelected ? styles.secondaryButton : styles.button}
                        onClick={() => {
                          setNotice("");
                          setSelectedSession(isSelected ? null : session);
                        }}
                      >
                        {isSelected ? "Close recovery" : "Find recovery slots"}
                      </button>
                    </div>
                  </SessionCard>
                );
              })
            )}
          </div>

          {selectedSession && (
            <RecoveryProposal
              key={getSessionId(selectedSession)}
              session={selectedSession}
              onCreated={handleRecoveryCreated}
              onCancel={() => setSelectedSession(null)}
            />
          )}

          <div style={styles.panel}>
            <div style={styles.eyebrow}>Your schedule</div>
            <h3 style={styles.panelTitle}>Planned study sessions</h3>
            <p style={styles.panelDescription}>
              These sessions are currently marked as planned.
            </p>

            {plannedSessions.length === 0 ? (
              <div style={styles.empty}>
                No planned sessions yet. Add a session in Study Planner to
                start building your schedule.
              </div>
            ) : (
              plannedSessions.map((session) => (
                <SessionCard
                  key={getSessionId(session)}
                  session={session}
                  label="PLANNED"
                />
              ))
            )}
          </div>

          <div style={styles.panel}>
            <div style={styles.eyebrow}>Progress history</div>
            <h3 style={styles.panelTitle}>Recently completed</h3>
            <p style={styles.panelDescription}>
              Completed sessions contribute to the completed study-time total
              shown above.
            </p>

            {completedSessions.length === 0 ? (
              <div style={styles.empty}>
                No completed sessions yet. When you mark a study session
                complete in Study Planner, it will appear here.
              </div>
            ) : (
              completedSessions
                .slice()
                .sort(
                  (a, b) =>
                    new Date(getSessionDate(b) || 0).getTime() -
                    new Date(getSessionDate(a) || 0).getTime()
                )
                .map((session) => (
                  <SessionCard
                    key={getSessionId(session)}
                    session={session}
                    label="COMPLETED"
                  />
                ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
