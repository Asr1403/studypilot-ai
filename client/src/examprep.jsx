
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "studypilot-exam-prep-v1";

const styles = {
  page: {
    width: "100%",
    color: "#f1f5f9",
    padding: "8px 0 32px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  eyebrow: {
    color: "#a78bfa",
    fontSize: 11,
    fontWeight: 750,
    letterSpacing: 1.6,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    fontSize: "clamp(25px, 4vw, 34px)",
    letterSpacing: "-1px",
    margin: "0 0 8px",
    fontWeight: 750,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.7,
    maxWidth: 620,
    margin: 0,
  },
  panel: {
    background: "#111526",
    border: "1px solid #292f49",
    borderRadius: 15,
    padding: 20,
    marginBottom: 18,
    minWidth: 0,
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 720,
    margin: "0 0 7px",
  },
  panelDescription: {
    color: "#8793aa",
    fontSize: 12,
    lineHeight: 1.65,
    margin: "0 0 18px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: 13,
    marginBottom: 20,
  },
  stat: {
    background: "linear-gradient(145deg, #171b30, #111526)",
    border: "1px solid #292f49",
    borderRadius: 13,
    padding: 17,
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: 12,
    marginBottom: 10,
  },
  statValue: {
    fontSize: 27,
    fontWeight: 750,
    letterSpacing: -0.6,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 650,
    color: "#cbd5e1",
    marginBottom: 7,
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "#0c1020",
    border: "1px solid #303750",
    color: "#f1f5f9",
    borderRadius: 9,
    padding: "11px 12px",
    fontSize: 13,
    outline: "none",
  },
  fieldGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
    gap: 14,
    marginBottom: 15,
  },
  button: {
    background: "linear-gradient(135deg, #7c3aed, #6366f1)",
    border: "1px solid #8b5cf6",
    color: "#fff",
    borderRadius: 9,
    padding: "11px 15px",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  secondaryButton: {
    background: "#171c31",
    border: "1px solid #303750",
    color: "#dbe4f0",
    borderRadius: 9,
    padding: "9px 12px",
    fontSize: 12,
    fontWeight: 650,
    cursor: "pointer",
  },
  topic: {
    display: "flex",
    alignItems: "flex-start",
    gap: 11,
    background: "#171c30",
    border: "1px solid #2a314b",
    borderRadius: 10,
    padding: 13,
    marginBottom: 9,
  },
  muted: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 1.65,
  },
  progressTrack: {
    height: 7,
    background: "#292f49",
    borderRadius: 99,
    overflow: "hidden",
  },
  error: {
    background: "#351b2a",
    border: "1px solid #713047",
    color: "#fda4af",
    padding: 12,
    borderRadius: 9,
    fontSize: 12,
    marginBottom: 14,
  },
  empty: {
    border: "1px dashed #303750",
    borderRadius: 10,
    padding: 22,
    textAlign: "center",
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 1.7,
  },
};

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDaysUntil(dateString) {
  if (!dateString) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;

  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadSavedData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function ExamPrep() {
  const [plans, setPlans] = useState(loadSavedData);
  const [subject, setSubject] = useState("");
  const [examDate, setExamDate] = useState("");
  const [dailyMinutes, setDailyMinutes] = useState("60");
  const [topicsText, setTopicsText] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [error, setError] = useState("");

  const today = localDateString(new Date());

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
    } catch {
      setError("Could not save your plans in this browser.");
    }
  }, [plans]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.id === selectedPlanId) ?? null,
    [plans, selectedPlanId]
  );

  const totalTopics = plans.reduce(
    (total, plan) => total + plan.topics.length,
    0
  );

  const completedTopics = plans.reduce(
    (total, plan) =>
      total + plan.topics.filter((topic) => topic.completed).length,
    0
  );

  const overallProgress =
    totalTopics === 0 ? 0 : Math.round((completedTopics / totalTopics) * 100);

  function createPlan(event) {
    event.preventDefault();
    setError("");

    const cleanSubject = subject.trim();
    const topicNames = topicsText
      .split("\n")
      .map((topic) => topic.trim())
      .filter(Boolean);

    if (!cleanSubject) {
      setError("Enter a subject or exam name.");
      return;
    }

    if (!examDate) {
      setError("Choose your exam date.");
      return;
    }

    if (examDate < today) {
      setError("The exam date cannot be in the past.");
      return;
    }

    const minutes = Number(dailyMinutes);

    if (!Number.isFinite(minutes) || minutes < 15 || minutes > 720) {
      setError("Daily study time must be between 15 and 720 minutes.");
      return;
    }

    if (topicNames.length === 0) {
      setError("Add at least one topic, with one topic per line.");
      return;
    }

    const plan = {
      id: makeId(),
      subject: cleanSubject,
      examDate,
      dailyMinutes: minutes,
      createdAt: new Date().toISOString(),
      topics: topicNames.map((name) => ({
        id: makeId(),
        name,
        completed: false,
      })),
    };

    setPlans((current) => [plan, ...current]);
    setSelectedPlanId(plan.id);
    setSubject("");
    setExamDate("");
    setDailyMinutes("60");
    setTopicsText("");
  }

  function toggleTopic(topicId) {
    if (!selectedPlan) return;

    setPlans((current) =>
      current.map((plan) =>
        plan.id !== selectedPlan.id
          ? plan
          : {
              ...plan,
              topics: plan.topics.map((topic) =>
                topic.id === topicId
                  ? { ...topic, completed: !topic.completed }
                  : topic
              ),
            }
      )
    );
  }

  function deletePlan(planId) {
    setPlans((current) => current.filter((plan) => plan.id !== planId));

    if (selectedPlanId === planId) {
      setSelectedPlanId("");
    }
  }

  function resetTopicProgress() {
    if (!selectedPlan) return;

    setPlans((current) =>
      current.map((plan) =>
        plan.id !== selectedPlan.id
          ? plan
          : {
              ...plan,
              topics: plan.topics.map((topic) => ({
                ...topic,
                completed: false,
              })),
            }
      )
    );
  }

  const selectedCompleted = selectedPlan
    ? selectedPlan.topics.filter((topic) => topic.completed).length
    : 0;

  const selectedProgress =
    selectedPlan && selectedPlan.topics.length
      ? Math.round(
          (selectedCompleted / selectedPlan.topics.length) * 100
        )
      : 0;

  const selectedDays = selectedPlan
    ? getDaysUntil(selectedPlan.examDate)
    : null;

  const studySchedule = useMemo(() => {
    if (!selectedPlan) return [];

    const remainingTopics = selectedPlan.topics.filter(
      (topic) => !topic.completed
    );

    if (remainingTopics.length === 0) return [];

    const daysLeft = Math.max(1, getDaysUntil(selectedPlan.examDate) ?? 1);
    const usableDays = Math.min(daysLeft, remainingTopics.length);
    const topicsPerDay = Math.ceil(remainingTopics.length / usableDays);

    const schedule = [];
    let index = 0;

    for (let day = 0; day < usableDays && index < remainingTopics.length; day++) {
      const topics = remainingTopics.slice(index, index + topicsPerDay);
      index += topicsPerDay;

      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() + day);

      schedule.push({
        date: localDateString(date),
        topics,
        minutes: selectedPlan.dailyMinutes,
      });
    }

    if (index < remainingTopics.length) {
      schedule.push({
        date: selectedPlan.examDate,
        topics: remainingTopics.slice(index),
        minutes: selectedPlan.dailyMinutes,
      });
    }

    return schedule;
  }, [selectedPlan]);

  return (
    <section id="exam-prep" style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.eyebrow}>StudyPilot AI · Exam preparation</div>
          <h2 style={styles.title}>Exam Prep Workspace</h2>
          <p style={styles.subtitle}>
            Organize your syllabus, track revision progress, and build a
            practical study schedule around your exam date.
          </p>
        </div>
      </header>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.grid}>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Exam plans</div>
          <div style={styles.statValue}>{plans.length}</div>
        </div>

        <div style={styles.stat}>
          <div style={styles.statLabel}>Topics completed</div>
          <div style={styles.statValue}>
            {completedTopics}/{totalTopics}
          </div>
        </div>

        <div style={styles.stat}>
          <div style={styles.statLabel}>Overall revision</div>
          <div style={styles.statValue}>{overallProgress}%</div>
          <div style={{ ...styles.progressTrack, marginTop: 12 }}>
            <div
              style={{
                height: "100%",
                width: `${overallProgress}%`,
                background: "linear-gradient(90deg, #8b5cf6, #6366f1)",
                borderRadius: 99,
                transition: "width 200ms ease",
              }}
            />
          </div>
        </div>
      </div>

      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Create an exam plan</h3>
        <p style={styles.panelDescription}>
          Enter your subject, exam date, available daily study time, and topics.
          Enter each topic on a separate line.
        </p>

        <form onSubmit={createPlan}>
          <div style={styles.fieldGrid}>
            <div>
              <label style={styles.label} htmlFor="exam-subject">
                Subject or exam name
              </label>
              <input
                id="exam-subject"
                style={styles.input}
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="e.g. Data Structures"
                maxLength={100}
                required
              />
            </div>

            <div>
              <label style={styles.label} htmlFor="exam-date">
                Exam date
              </label>
              <input
                id="exam-date"
                type="date"
                style={styles.input}
                value={examDate}
                min={today}
                onChange={(event) => setExamDate(event.target.value)}
                required
              />
            </div>

            <div>
              <label style={styles.label} htmlFor="exam-minutes">
                Daily study time (minutes)
              </label>
              <input
                id="exam-minutes"
                type="number"
                style={styles.input}
                value={dailyMinutes}
                min="15"
                max="720"
                step="15"
                onChange={(event) => setDailyMinutes(event.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={styles.label} htmlFor="exam-topics">
              Syllabus topics
            </label>
            <textarea
              id="exam-topics"
              style={{
                ...styles.input,
                minHeight: 125,
                resize: "vertical",
                lineHeight: 1.7,
              }}
              value={topicsText}
              onChange={(event) => setTopicsText(event.target.value)}
              placeholder={
                "Arrays and linked lists\nStacks and queues\nTrees and graphs\nSorting and searching"
              }
              maxLength={10000}
              required
            />
          </div>

          <button type="submit" style={styles.button}>
            + Create exam plan
          </button>
        </form>
      </div>

      <div style={styles.panel}>
        <h3 style={styles.panelTitle}>Your exam plans</h3>
        <p style={styles.panelDescription}>
          Select a plan to check off revised topics and view your suggested
          revision schedule.
        </p>

        {plans.length === 0 ? (
          <div style={styles.empty}>
            No exam plans yet. Create one above to start organizing your
            revision.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 11,
            }}
          >
            {plans.map((plan) => {
              const done = plan.topics.filter(
                (topic) => topic.completed
              ).length;

              const progress = plan.topics.length
                ? Math.round((done / plan.topics.length) * 100)
                : 0;

              const days = getDaysUntil(plan.examDate);
              const active = selectedPlanId === plan.id;

              return (
                <div
                  key={plan.id}
                  style={{
                    background: active ? "#211b3b" : "#171c30",
                    border: `1px solid ${active ? "#8b5cf6" : "#2a314b"}`,
                    borderRadius: 12,
                    padding: 15,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      overflowWrap: "anywhere",
                      marginBottom: 8,
                    }}
                  >
                    {plan.subject}
                  </div>

                  <div style={styles.muted}>
                    Exam: {plan.examDate}
                  </div>

                  <div style={{ ...styles.muted, marginTop: 3 }}>
                    {days === 0
                      ? "Exam is today"
                      : days > 0
                        ? `${days} day${days === 1 ? "" : "s"} remaining`
                        : "Exam date has passed"}
                  </div>

                  <div style={{ ...styles.progressTrack, marginTop: 13 }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${progress}%`,
                        background: "linear-gradient(90deg, #8b5cf6, #6366f1)",
                        borderRadius: 99,
                      }}
                    />
                  </div>

                  <div style={{ ...styles.muted, marginTop: 7 }}>
                    {done} of {plan.topics.length} topics revised · {progress}%
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      marginTop: 13,
                      flexWrap: "wrap",
                    }}
                  >
                    <button
                      type="button"
                      style={active ? styles.button : styles.secondaryButton}
                      onClick={() => setSelectedPlanId(plan.id)}
                    >
                      {active ? "Selected" : "Open plan"}
                    </button>

                    <button
                      type="button"
                      style={styles.secondaryButton}
                      onClick={() => deletePlan(plan.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedPlan && (
        <>
          <div style={styles.panel}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div style={styles.eyebrow}>Revision checklist</div>
                <h3 style={styles.panelTitle}>{selectedPlan.subject}</h3>
                <p style={styles.panelDescription}>
                  Mark a topic complete after revising it. Your progress is
                  saved in this browser.
                </p>
              </div>

              <button
                type="button"
                style={styles.secondaryButton}
                onClick={resetTopicProgress}
              >
                Reset checklist
              </button>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 9,
              }}
            >
              <span style={styles.muted}>Revision progress</span>
              <span style={{ color: "#c4b5fd", fontSize: 12, fontWeight: 700 }}>
                {selectedProgress}%
              </span>
            </div>

            <div style={{ ...styles.progressTrack, marginBottom: 19 }}>
              <div
                style={{
                  height: "100%",
                  width: `${selectedProgress}%`,
                  background: "linear-gradient(90deg, #8b5cf6, #6366f1)",
                  borderRadius: 99,
                }}
              />
            </div>

            {selectedPlan.topics.map((topic) => (
              <label
                key={topic.id}
                style={{
                  ...styles.topic,
                  borderColor: topic.completed ? "#31564c" : "#2a314b",
                  background: topic.completed ? "#132722" : "#171c30",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={topic.completed}
                  onChange={() => toggleTopic(topic.id)}
                  style={{
                    marginTop: 3,
                    accentColor: "#a78bfa",
                    flexShrink: 0,
                  }}
                />

                <span
                  style={{
                    color: topic.completed ? "#86efac" : "#e2e8f0",
                    fontSize: 13,
                    lineHeight: 1.6,
                    textDecoration: topic.completed ? "line-through" : "none",
                    overflowWrap: "anywhere",
                  }}
                >
                  {topic.name}
                </span>
              </label>
            ))}
          </div>

          <div style={styles.panel}>
            <div style={styles.eyebrow}>Suggested revision schedule</div>
            <h3 style={styles.panelTitle}>Your study roadmap</h3>
            <p style={styles.panelDescription}>
              Remaining topics are distributed across the available days.
              This is a local planning suggestion, not an AI-generated or
              calendar-synced schedule.
            </p>

            {studySchedule.length === 0 ? (
              <div style={styles.empty}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                All topics are marked as revised. Review difficult topics again
                before your exam.
              </div>
            ) : (
              studySchedule.map((day, index) => (
                <div
                  key={`${day.date}-${index}`}
                  style={{
                    ...styles.topic,
                    display: "block",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        color: "#c4b5fd",
                        fontSize: 12,
                        fontWeight: 750,
                      }}
                    >
                      Day {index + 1} · {day.date}
                    </span>

                    <span style={styles.pill ?? {}}>
                      {formatMinutesForDisplay(day.minutes)}
                    </span>
                  </div>

                  {day.topics.map((topic) => (
                    <div
                      key={topic.id}
                      style={{
                        color: "#cbd5e1",
                        fontSize: 12,
                        lineHeight: 1.7,
                        marginBottom: 5,
                      }}
                    >
                      • {topic.name}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  );
}

function formatMinutesForDisplay(minutes) {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (hours && remaining) return `${hours}h ${remaining}m`;
  if (hours) return `${hours}h`;
  return `${remaining} min`;
}
