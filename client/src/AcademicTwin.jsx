
import { useCallback, useEffect, useState } from "react";

const API_URL = "http://localhost:3000/api";

const styles = {
  page: {
    color: "#F3F4F6",
    display: "grid",
    gap: "24px",
    minWidth: 0,
  },
  muted: {
    color: "#9CA3AF",
    fontSize: "13px",
    lineHeight: 1.6,
  },
  panel: {
    background: "linear-gradient(145deg, #17172D, #111827)",
    border: "1px solid #292943",
    borderRadius: "18px",
    padding: "22px",
    minWidth: 0,
  },
  eyebrow: {
    color: "#A78BFA",
    fontSize: "11px",
    fontWeight: 800,
    letterSpacing: "1.8px",
    textTransform: "uppercase",
  },
  button: {
    background: "#8B5CF6",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "10px",
    padding: "11px 15px",
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#292344",
    color: "#DDD6FE",
    border: "1px solid #49406F",
    borderRadius: "10px",
    padding: "10px 13px",
    fontWeight: 700,
    cursor: "pointer",
  },
  field: {
    width: "100%",
    boxSizing: "border-box",
    background: "#101020",
    border: "1px solid #393654",
    borderRadius: "10px",
    color: "#F3F4F6",
    padding: "12px",
    fontSize: "14px",
    outline: "none",
  },
};

function riskColor(level) {
  if (level === "high") return "#FB7185";
  if (level === "moderate") return "#FBBF24";
  return "#34D399";
}

function formatMinutes(minutes = 0) {
  const value = Number(minutes) || 0;
  const hours = Math.floor(value / 60);
  const remaining = value % 60;

  if (hours === 0) return `${remaining} min`;
  if (remaining === 0) return `${hours}h`;
  return `${hours}h ${remaining}m`;
}

function formatDate(date) {
  if (!date) return "Date unavailable";

  return new Date(`${date}T12:00:00`).toLocaleDateString(
    undefined,
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function Metric({ label, value, helper }) {
  return (
    <div
      style={{
        background: "#151529",
        border: "1px solid #292943",
        borderRadius: "14px",
        padding: "17px",
        minWidth: 0,
      }}
    >
      <div style={{ ...styles.muted, marginBottom: "10px" }}>
        {label}
      </div>

      <div
        style={{
          color: "#F9FAFB",
          fontSize: "27px",
          fontWeight: 800,
          letterSpacing: "-1px",
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>

      <div style={{ ...styles.muted, marginTop: "6px" }}>
        {helper}
      </div>
    </div>
  );
}

export default function AcademicTwin({
  onNavigate,
  onDataChange,
}) {
  const [analysis, setAnalysis] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [recoveryError, setRecoveryError] = useState("");
  const [recoveryMessage, setRecoveryMessage] = useState("");

  const loadAnalysis = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [analysisResponse, sessionsResponse] = await Promise.all([
        fetch(`${API_URL}/twin/analysis`),
        fetch(`${API_URL}/sessions`),
      ]);

      const [analysisResult, sessionsResult] = await Promise.all([
        analysisResponse.json(),
        sessionsResponse.json(),
      ]);

      if (!analysisResponse.ok || !analysisResult.success) {
        throw new Error(
          analysisResult.error || "Could not load Academic Twin."
        );
      }

      if (!sessionsResponse.ok) {
        throw new Error(
          sessionsResult.error || "Could not load study sessions."
        );
      }

      setAnalysis(analysisResult);
      setSessions(
        Array.isArray(sessionsResult) ? sessionsResult : []
      );
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
    loadAnalysis();
  }, [loadAnalysis]);

  const navigate = (action) => {
    if (action === "open-recovery") {
      setRecoveryOpen(true);
      setRecoveryError("");
      setRecoveryMessage("");
      setSuggestions([]);
      setSelectedSlot(null);

      const missed = sessions.find(
        (session) => session.status === "missed"
      );

      if (missed) {
        setSelectedSessionId(String(missed._id));
      }

      return;
    }

    if (typeof onNavigate === "function") {
      onNavigate(action);
      return;
    }

    if (action === "open-planner") {
      document.getElementById("study-planner")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  const loadRecoverySuggestions = async () => {
    if (!selectedSessionId) {
      setRecoveryError("Select a missed session first.");
      return;
    }

    setRecoveryLoading(true);
    setRecoveryError("");
    setRecoveryMessage("");
    setSuggestions([]);
    setSelectedSlot(null);

    try {
      const response = await fetch(
        `${API_URL}/rescue/suggestions?sessionId=${encodeURIComponent(
          selectedSessionId
        )}`
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error || "Could not generate recovery suggestions."
        );
      }

      setSuggestions(
        Array.isArray(result.suggestions) ? result.suggestions : []
      );

      if (result.suggestions?.length) {
        setRecoveryMessage(
          "Choose a recovery slot below. Nothing has been scheduled yet."
        );
      } else {
        setRecoveryMessage(
          result.message || "No recovery slots were found."
        );
      }
    } catch (err) {
      setRecoveryError(err.message || "Could not load recovery slots.");
    } finally {
      setRecoveryLoading(false);
    }
  };

  const scheduleRecovery = async () => {
    if (!selectedSlot || !selectedSessionId) {
      setRecoveryError("Select a recovery slot first.");
      return;
    }

    const sourceSession = sessions.find(
      (session) => String(session._id) === selectedSessionId
    );

    if (!sourceSession) {
      setRecoveryError(
        "The original session could not be found. Refresh and try again."
      );
      return;
    }

    if (!sourceSession.subjectId) {
      setRecoveryError(
        "This missed session has no subject ID. Please create a new session from the Study Planner."
      );
      return;
    }

    setScheduling(true);
    setRecoveryError("");
    setRecoveryMessage("");

    try {
      const response = await fetch(`${API_URL}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subjectId: String(sourceSession.subjectId),
          date: selectedSlot.date,
          startTime: selectedSlot.startTime,
          durationMinutes: selectedSlot.durationMinutes,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not schedule the recovery session."
        );
      }

      setRecoveryMessage(
        `Recovery session scheduled for ${formatDate(
          selectedSlot.date
        )} at ${selectedSlot.startTime}.`
      );

      setSuggestions([]);
      setSelectedSlot(null);

      await loadAnalysis();

      if (typeof onDataChange === "function") {
        await onDataChange();
      }
    } catch (err) {
      setRecoveryError(
        err.message || "Could not schedule the recovery session."
      );
    } finally {
      setScheduling(false);
    }
  };

  if (loading && !analysis) {
    return (
      <div style={styles.page}>
        <div style={styles.panel}>
          <div style={styles.eyebrow}>StudyPilot Intelligence</div>
          <h2>Building your Academic Twin...</h2>
          <p style={styles.muted}>
            Analysing your subjects and study-session history.
          </p>
        </div>
      </div>
    );
  }

  if (error && !analysis) {
    return (
      <div style={styles.page}>
        <div style={styles.panel}>
          <h2>Academic Twin is unavailable</h2>
          <p style={styles.muted}>{error}</p>
          <button style={styles.button} onClick={loadAnalysis}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  const overview = analysis?.overview || {};
  const insights = analysis?.subjectInsights || [];
  const recommendations = analysis?.recommendations || [];
  const overallColor = riskColor(overview.overallRiskLevel);

  const missedSessions = sessions.filter(
    (session) => session.status === "missed"
  );

  return (
    <div style={styles.page}>
      <section
        style={{
          ...styles.panel,
          background:
            "radial-gradient(ellipse at top right, #37245D 0%, #19172F 42%, #111827 100%)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "18px",
          }}
        >
          <div style={{ maxWidth: "560px" }}>
            <div style={styles.eyebrow}>
              Your personal intelligence system
            </div>

            <h1
              style={{
                fontSize: "clamp(26px, 4vw, 38px)",
                margin: "12px 0",
                letterSpacing: "-1.5px",
              }}
            >
              Academic Twin
            </h1>

            <p
              style={{
                color: "#C4B5FD",
                lineHeight: 1.8,
                margin: 0,
              }}
            >
              Understand your study patterns, identify unfinished work,
              and decide what to do next.
            </p>
          </div>

          <button
            style={styles.button}
            onClick={loadAnalysis}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "↻ Refresh analysis"}
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "22px",
            alignItems: "center",
            marginTop: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "20px",
              flexWrap: "wrap",
            }}
          >
            <div
              style={{
                width: "118px",
                height: "118px",
                borderRadius: "50%",
                background: `conic-gradient(${overallColor} ${Math.max(
                  0,
                  Math.min(100, overview.overallRiskScore || 0)
                ) * 3.6}deg, #33314B 0deg)`,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: "94px",
                  height: "94px",
                  background: "#17172D",
                  borderRadius: "50%",
                  display: "grid",
                  placeContent: "center",
                  textAlign: "center",
                }}
              >
                <strong style={{ fontSize: "28px" }}>
                  {overview.overallRiskScore ?? 0}
                </strong>
                <span style={{ ...styles.muted, fontSize: "10px" }}>
                  OUT OF 100
                </span>
              </div>
            </div>

            <div>
              <div style={{ ...styles.muted, marginBottom: "7px" }}>
                Overall study-risk indicator
              </div>

              <div
                style={{
                  color: overallColor,
                  fontSize: "20px",
                  fontWeight: 800,
                  textTransform: "capitalize",
                }}
              >
                {overview.overallRiskLevel || "unknown"} risk
              </div>

              <p style={{ ...styles.muted, maxWidth: "240px" }}>
                A transparent indicator based on your recorded study
                activity, not a prediction of exam marks.
              </p>
            </div>
          </div>

          <div
            style={{
              background: "rgba(10, 10, 28, 0.42)",
              border: "1px solid rgba(196, 181, 253, 0.15)",
              padding: "17px",
              borderRadius: "14px",
            }}
          >
            <div style={styles.eyebrow}>Next best action</div>

            <h3 style={{ margin: "10px 0", fontSize: "17px" }}>
              {recommendations[0]?.title ||
                "Keep building your study history"}
            </h3>

            <p style={{ ...styles.muted, marginBottom: "14px" }}>
              {recommendations[0]?.detail ||
                "Schedule a study session to begin tracking your progress."}
            </p>

            <button
              style={styles.button}
              onClick={() =>
                navigate(recommendations[0]?.action || "open-planner")
              }
            >
              Take action →
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div
          style={{
            ...styles.panel,
            borderColor: "#92400E",
            color: "#FCD34D",
          }}
        >
          Could not refresh the latest data. Showing the last successful
          analysis. {error}
        </div>
      )}

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))",
          gap: "13px",
        }}
      >
        <Metric
          label="Subjects tracked"
          value={overview.subjectsTracked ?? 0}
          helper="Subjects in your account"
        />

        <Metric
          label="Completed"
          value={overview.completedSessions ?? 0}
          helper={`${overview.completionRate ?? 0}% of recorded sessions`}
        />

        <Metric
          label="Missed"
          value={overview.missedSessions ?? 0}
          helper="Sessions marked missed"
        />

        <Metric
          label="Overdue"
          value={overview.overdueSessions ?? 0}
          helper="Planned sessions in the past"
        />

        <Metric
          label="Future sessions"
          value={overview.upcomingSessions ?? 0}
          helper={`${formatMinutes(overview.upcomingStudyMinutes)} planned`}
        />

        <Metric
          label="Study completed"
          value={formatMinutes(overview.completedStudyMinutes)}
          helper="Recorded completed time"
        />
      </section>

      {/* AUTO-RECOVERY PANEL */}
      {recoveryOpen && (
        <section
          id="academic-twin-recovery"
          style={{
            ...styles.panel,
            borderColor: "#59428B",
            background:
              "radial-gradient(ellipse at top right, #282044 0%, #17172D 55%, #111827 100%)",
          }}
        >
          <div style={styles.eyebrow}>Auto-Recovery Engine</div>

          <h2 style={{ margin: "9px 0 5px", fontSize: "22px" }}>
            Get back on track
          </h2>

          <p style={styles.muted}>
            Select a missed session to find available recovery slots.
            StudyPilot will only schedule a slot after you confirm it.
          </p>

          {missedSessions.length === 0 ? (
            <div
              style={{
                marginTop: "18px",
                padding: "15px",
                borderRadius: "12px",
                background: "#151529",
                border: "1px solid #292943",
              }}
            >
              <p style={{ marginTop: 0 }}>
                No sessions are currently marked as missed.
              </p>
              <p style={styles.muted}>
                You can create a new session from the Study Planner.
              </p>

              <button
                style={styles.button}
                onClick={() => navigate("open-planner")}
              >
                Open Study Planner →
              </button>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gap: "15px",
                marginTop: "18px",
              }}
            >
              <label
                style={{
                  display: "grid",
                  gap: "8px",
                  color: "#DDD6FE",
                  fontSize: "13px",
                  fontWeight: 700,
                }}
              >
                Choose a missed session

                <select
                  value={selectedSessionId}
                  onChange={(event) => {
                    setSelectedSessionId(event.target.value);
                    setSuggestions([]);
                    setSelectedSlot(null);
                    setRecoveryError("");
                    setRecoveryMessage("");
                  }}
                  style={styles.field}
                >
                  <option value="">Select a session...</option>

                  {missedSessions.map((session) => (
                    <option
                      key={session._id}
                      value={String(session._id)}
                    >
                      {session.subjectName || "Study session"} —{" "}
                      {formatDate(session.date)} at {session.startTime}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <button
                  style={{
                    ...styles.button,
                    opacity: recoveryLoading ? 0.7 : 1,
                  }}
                  onClick={loadRecoverySuggestions}
                  disabled={recoveryLoading || !selectedSessionId}
                >
                  {recoveryLoading
                    ? "Finding available slots..."
                    : "Find recovery slots"}
                </button>
              </div>

              {recoveryError && (
                <div
                  role="alert"
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    background: "#351C2A",
                    border: "1px solid #7F3048",
                    color: "#FDA4AF",
                    fontSize: "13px",
                  }}
                >
                  {recoveryError}
                </div>
              )}

              {recoveryMessage && (
                <div
                  role="status"
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    background: "#182A2A",
                    border: "1px solid #285A50",
                    color: "#A7F3D0",
                    fontSize: "13px",
                  }}
                >
                  {recoveryMessage}
                </div>
              )}

              {suggestions.length > 0 && (
                <div style={{ display: "grid", gap: "10px" }}>
                  <h3 style={{ margin: "8px 0 0", fontSize: "16px" }}>
                    Available recovery slots
                  </h3>

                  {suggestions.map((slot, index) => {
                    const isSelected =
                      selectedSlot?.date === slot.date &&
                      selectedSlot?.startTime === slot.startTime;

                    return (
                      <button
                        key={`${slot.date}-${slot.startTime}-${index}`}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        aria-pressed={isSelected}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          flexWrap: "wrap",
                          gap: "10px",
                          textAlign: "left",
                          padding: "14px",
                          borderRadius: "12px",
                          cursor: "pointer",
                          color: "#F3F4F6",
                          background: isSelected ? "#30234F" : "#151529",
                          border: isSelected
                            ? "1px solid #A78BFA"
                            : "1px solid #292943",
                        }}
                      >
                        <span>
                          <strong style={{ display: "block" }}>
                            {formatDate(slot.date)}
                          </strong>

                          <span style={styles.muted}>
                            {slot.startTime} · {slot.durationMinutes} min
                          </span>
                        </span>

                        <span
                          style={{
                            color: isSelected ? "#C4B5FD" : "#9CA3AF",
                            fontSize: "12px",
                            fontWeight: 700,
                          }}
                        >
                          {isSelected ? "✓ Selected" : "Select slot"}
                        </span>
                      </button>
                    );
                  })}

                  <div
                    style={{
                      padding: "14px",
                      borderRadius: "12px",
                      background: "#101020",
                      border: "1px solid #393654",
                    }}
                  >
                    <p style={{ ...styles.muted, marginTop: 0 }}>
                      {selectedSlot
                        ? `Selected: ${formatDate(
                            selectedSlot.date
                          )} at ${selectedSlot.startTime}.`
                        : "Select one of the available slots to continue."}
                    </p>

                    <button
                      style={{
                        ...styles.button,
                        opacity:
                          scheduling || !selectedSlot ? 0.6 : 1,
                      }}
                      onClick={scheduleRecovery}
                      disabled={scheduling || !selectedSlot}
                    >
                      {scheduling
                        ? "Scheduling..."
                        : "Confirm and schedule recovery"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: "18px" }}>
            <button
              style={styles.secondaryButton}
              onClick={() => {
                setRecoveryOpen(false);
                setSuggestions([]);
                setSelectedSlot(null);
                setRecoveryError("");
                setRecoveryMessage("");
              }}
            >
              Close recovery panel
            </button>
          </div>
        </section>
      )}

      {/* SUBJECT HEALTH */}
      <section style={styles.panel}>
        <div style={styles.eyebrow}>Personalised insights</div>

        <h2 style={{ margin: "9px 0 5px", fontSize: "22px" }}>
          Subject health
        </h2>

        <p style={styles.muted}>
          Risk indicators are based on recorded sessions. Subjects with
          no session history need a study plan before their progress
          can be evaluated.
        </p>

        {insights.length === 0 ? (
          <p style={styles.muted}>
            Add a subject to start building your Academic Twin.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
            {insights.map((subject) => {
              const color = riskColor(subject.riskLevel);
              const hasHistory = subject.sessionsRecorded > 0;
              const needsRecovery =
                subject.missedSessions > 0 ||
                subject.overdueSessions > 0;

              return (
                <div
                  key={subject.subjectId}
                  style={{
                    background: "#151529",
                    border: "1px solid #292943",
                    borderRadius: "13px",
                    padding: "16px",
                  }}
                >
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
                      <h3 style={{ margin: "0 0 7px", fontSize: "16px" }}>
                        {subject.subjectName}
                      </h3>

                      <div style={styles.muted}>
                        {subject.sessionsRecorded} recorded session(s)
                        {" · "}
                        {subject.completedSessions} completed
                        {" · "}
                        {subject.missedSessions} missed
                      </div>
                    </div>

                    <span
                      style={{
                        color,
                        border: `1px solid ${color}55`,
                        background: `${color}12`,
                        borderRadius: "999px",
                        padding: "6px 10px",
                        fontSize: "11px",
                        fontWeight: 800,
                        textTransform: "capitalize",
                      }}
                    >
                      {subject.riskLevel} risk · {subject.riskScore}/100
                    </span>
                  </div>

                  <div
                    style={{
                      height: "6px",
                      background: "#302F49",
                      borderRadius: "99px",
                      margin: "15px 0",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, subject.riskScore || 0)
                        )}%`,
                        height: "100%",
                        borderRadius: "99px",
                        background: color,
                      }}
                    />
                  </div>

                  <p
                    style={{
                      color: "#D1D5DB",
                      fontSize: "13px",
                      margin: 0,
                    }}
                  >
                    {subject.recommendation}
                  </p>

                  {!hasHistory && (
                    <div style={{ ...styles.muted, marginTop: "8px" }}>
                      Not enough history to assess this subject's study
                      pattern yet.
                    </div>
                  )}

                  {subject.reasons?.length > 0 && (
                    <div style={{ ...styles.muted, marginTop: "8px" }}>
                      Why this score: {subject.reasons.join(" · ")}
                    </div>
                  )}

                  <div style={{ marginTop: "13px" }}>
                    <button
                      style={styles.secondaryButton}
                      onClick={() =>
                        navigate(
                          needsRecovery ? "open-recovery" : "open-planner"
                        )
                      }
                    >
                      {needsRecovery
                        ? "Recover sessions"
                        : "Plan study time"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* RECOMMENDED ACTIONS */}
      <section style={styles.panel}>
        <div style={styles.eyebrow}>Your next moves</div>

        <h2 style={{ margin: "9px 0 5px", fontSize: "22px" }}>
          Recommended actions
        </h2>

        <p style={styles.muted}>
          Use these suggestions to decide what to fix first.
        </p>

        <div style={{ display: "grid", gap: "12px", marginTop: "18px" }}>
          {recommendations.map((item, index) => {
            const color =
              item.priority === "high"
                ? "#FB7185"
                : item.priority === "medium"
                  ? "#FBBF24"
                  : "#34D399";

            return (
              <div
                key={`${item.title}-${index}`}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "13px",
                  padding: "15px",
                  borderRadius: "12px",
                  background: "#151529",
                  border: "1px solid #292943",
                }}
              >
                <div
                  style={{
                    width: "9px",
                    height: "9px",
                    borderRadius: "50%",
                    background: color,
                    marginTop: "6px",
                    flexShrink: 0,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: "10px",
                      flexWrap: "wrap",
                      alignItems: "center",
                    }}
                  >
                    <strong>{item.title}</strong>

                    <span
                      style={{
                        color,
                        fontSize: "10px",
                        textTransform: "uppercase",
                        fontWeight: 800,
                      }}
                    >
                      {item.priority} priority
                    </span>
                  </div>

                  <p style={{ ...styles.muted, marginBottom: 0 }}>
                    {item.detail}
                  </p>
                </div>

                <button
                  style={{
                    ...styles.secondaryButton,
                    fontSize: "11px",
                    padding: "8px 10px",
                    flexShrink: 0,
                  }}
                  onClick={() => navigate(item.action)}
                >
                  Open
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <p style={{ ...styles.muted, textAlign: "center" }}>
        Analysis updated:{" "}
        {analysis?.generatedAt
          ? new Date(analysis.generatedAt).toLocaleString()
          : "Not available"}
        {" · "}Model: {analysis?.model?.type || "unknown"}
      </p>
    </div>
  );
}
