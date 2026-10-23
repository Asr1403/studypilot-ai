
import { useCallback, useEffect, useState } from "react";

const API_URL = "http://localhost:3000/api";

function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-IN";
  utterance.rate = 1.05;

  window.speechSynthesis.speak(utterance);
}

export default function AlexaStudyAssistant({ onNavigate, onDataChange }) {
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! I'm your StudyPilot assistant. Ask about your studies, or say something like: schedule a 30-minute session for Data Structures tomorrow.",
    },
  ]);

  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const [proposal, setProposal] = useState(null);
  const [confirmation, setConfirmation] = useState("");

  const [sessionForm, setSessionForm] = useState({
    subjectId: "",
    date: localDate(1),
    startTime: "18:00",
    durationMinutes: 30,
  });

  const loadData = useCallback(async () => {
    try {
      const [subjectResponse, sessionResponse] = await Promise.all([
        fetch(`${API_URL}/subjects`),
        fetch(`${API_URL}/sessions`),
      ]);

      const [subjectData, sessionData] = await Promise.all([
        subjectResponse.json(),
        sessionResponse.json(),
      ]);

      if (!subjectResponse.ok || !sessionResponse.ok) {
        throw new Error("Could not load your saved study data.");
      }

      const nextSubjects = Array.isArray(subjectData)
        ? subjectData
        : subjectData.subjects || [];

      const nextSessions = Array.isArray(sessionData)
        ? sessionData
        : sessionData.sessions || [];

      setSubjects(nextSubjects);
      setSessions(nextSessions);

      setSessionForm((current) => ({
        ...current,
        subjectId:
          current.subjectId ||
          (nextSubjects[0]?._id ? String(nextSubjects[0]._id) : ""),
      }));
    } catch (err) {
      setError(err.message || "Could not connect to StudyPilot.");
    }
  }, []);

  useEffect(() => {
    loadData();

    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [loadData]);

  const addAssistantMessage = (text) => {
    setMessages((current) => [
      ...current,
      { role: "assistant", text },
    ]);
  };

  function detectSchedulingIntent(text) {
    return /\b(schedule|create|book|add|plan)\b/i.test(text) &&
      /\b(session|study|block|minutes|minute|hour|hours|tomorrow|today)\b/i.test(text);
  }

  function prepareSession(text) {
    if (!subjects.length) {
      addAssistantMessage(
        "You don't have any subjects saved yet. Add a subject in My Subjects first, then come back and ask me to schedule a session."
      );
      return;
    }

    const lower = text.toLowerCase();

    const matchedSubject = subjects.find((subject) =>
      lower.includes(String(subject.name).toLowerCase())
    );

    const durationMatch = lower.match(/(\d{1,3})\s*(minute|min|hour|hr)s?\b/i);
    let duration = 30;

    if (durationMatch) {
      const amount = Number(durationMatch[1]);
      const unit = durationMatch[2].toLowerCase();
      duration = unit.startsWith("h") ? amount * 60 : amount;
    }

    duration = Math.max(15, Math.min(600, duration));

    let date = localDate(1);

    if (/\btoday\b/i.test(lower)) {
      date = localDate(0);
    } else if (/\bday after tomorrow\b/i.test(lower)) {
      date = localDate(2);
    }

    const timeMatch = lower.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    let startTime = "18:00";

    if (timeMatch) {
      let hours = Number(timeMatch[1]);
      const minutes = Number(timeMatch[2] || 0);
      const meridiem = timeMatch[3].toLowerCase();

      if (hours >= 1 && hours <= 12 && minutes < 60) {
        if (meridiem === "pm" && hours !== 12) hours += 12;
        if (meridiem === "am" && hours === 12) hours = 0;

        startTime =
          `${String(hours).padStart(2, "0")}:` +
          `${String(minutes).padStart(2, "0")}`;
      }
    }

    const selectedSubject = matchedSubject || subjects[0];

    setSessionForm({
      subjectId: String(selectedSubject._id),
      date,
      startTime,
      durationMinutes: duration,
    });

    setProposal({
      subjectId: String(selectedSubject._id),
      subjectName: selectedSubject.name,
      date,
      startTime,
      durationMinutes: duration,
    });

    setConfirmation("");

    addAssistantMessage(
      `I prepared a session for ${selectedSubject.name}. Please review the date, time, and duration below. I haven't saved or scheduled anything yet.`
    );
  }

  async function askAssistant(rawQuestion) {
    const text = rawQuestion.trim();

    if (!text || loading) return;

    setQuestion("");
    setError("");
    setConfirmation("");

    setMessages((current) => [
      ...current,
      { role: "user", text },
    ]);

    if (detectSchedulingIntent(text)) {
      prepareSession(text);
      return;
    }

    setLoading(true);

    try {
      const [subjectResponse, sessionResponse] = await Promise.all([
        fetch(`${API_URL}/subjects`),
        fetch(`${API_URL}/sessions`),
      ]);

      const [subjectData, sessionData] = await Promise.all([
        subjectResponse.json(),
        sessionResponse.json(),
      ]);

      if (!subjectResponse.ok || !sessionResponse.ok) {
        throw new Error("Could not retrieve your current study records.");
      }

      const currentSubjects = Array.isArray(subjectData)
        ? subjectData
        : subjectData.subjects || [];

      const currentSessions = Array.isArray(sessionData)
        ? sessionData
        : sessionData.sessions || [];

      setSubjects(currentSubjects);
      setSessions(currentSessions);

      const context = {
        subjects: currentSubjects.map((subject) => ({
          id: String(subject._id),
          name: subject.name,
          targetHours: subject.targetHours,
        })),
        sessions: currentSessions.slice(0, 20).map((session) => ({
          subjectName: session.subjectName,
          date: session.date,
          startTime: session.startTime,
          durationMinutes: session.durationMinutes,
          status: session.status,
          actualMinutes: session.actualMinutes,
        })),
      };

      const prompt = [
        "You are StudyPilot, a voice-first academic study assistant.",
        "Answer naturally and concisely, usually in 2 to 5 sentences.",
        "Use only the study records provided for personal statistics.",
        "Never invent grades, deadlines, subjects, or study history.",
        "Do not claim to have changed or scheduled anything.",
        "If the user wants to schedule a session, explain that they can review and confirm it in the session proposal form.",
        `Study records: ${JSON.stringify(context)}`,
        `User question: ${text}`,
      ].join("\n\n");

      const aiResponse = await fetch(`${API_URL}/ai/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prompt.slice(0, 950),
        }),
      });

      const aiData = await aiResponse.json();

      if (!aiResponse.ok || !aiData.success || !aiData.answer) {
        throw new Error(
          aiData.message || "The AI service could not answer right now."
        );
      }

      addAssistantMessage(aiData.answer);
    } catch (err) {
      setError(err.message || "The assistant could not answer right now.");
      addAssistantMessage(
        "I couldn't get an AI response just now. You can still review your saved sessions or prepare a study session using the action form."
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmSession(event) {
    event.preventDefault();

    if (!proposal || loading) return;

    const subject = subjects.find(
      (item) => String(item._id) === sessionForm.subjectId
    );

    if (!subject) {
      setError("Please choose a valid subject.");
      return;
    }

    setLoading(true);
    setError("");
    setConfirmation("");

    try {
      const response = await fetch(`${API_URL}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: sessionForm.subjectId,
          date: sessionForm.date,
          startTime: sessionForm.startTime,
          durationMinutes: Number(sessionForm.durationMinutes),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not schedule the session.");
      }

      const successMessage =
        `Confirmed! Your ${subject.name} session is saved for ` +
        `${data.date} at ${data.startTime}, lasting ` +
        `${data.durationMinutes} minutes.`;

      setConfirmation(successMessage);
      addAssistantMessage(successMessage);
      setProposal(null);

      await loadData();
      onDataChange?.();
    } catch (err) {
      setError(err.message || "Could not schedule the session.");
    } finally {
      setLoading(false);
    }
  }

  function startListening() {
    setError("");

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError("Voice input is not supported in this browser. Please use Chrome or type your request.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setQuestion(transcript);

      if (transcript.trim()) {
        askAssistant(transcript);
      }
    };

    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone permission was denied. Allow microphone access in Chrome."
          : `Voice input failed: ${event.error}. You can type instead.`
      );
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("Could not start the microphone. Please try again.");
    }
  }

  const completedCount = sessions.filter(
    (session) => session.status === "completed"
  ).length;

  const upcomingCount = sessions.filter(
    (session) => session.status === "planned"
  ).length;

  return (
    <div className="voice-page">
      <section className="panel" style={{ padding: 24 }}>
        <span className="section-eyebrow">VOICE-FIRST STUDY ASSISTANT</span>
        <h2 style={{ marginTop: 10 }}>Your study assistant, ready to help.</h2>
        <p className="panel-description">
          Ask questions, review your study activity, or prepare a session.
          Proposed actions are not saved until you confirm them.
        </p>

        <div className="voice-stat-grid">
          <article className="voice-stat-card">
            <div>
              <strong>{subjects.length}</strong>
              <span>Subjects</span>
            </div>
          </article>
          <article className="voice-stat-card">
            <div>
              <strong>{completedCount}</strong>
              <span>Completed sessions</span>
            </div>
          </article>
          <article className="voice-stat-card">
            <div>
              <strong>{upcomingCount}</strong>
              <span>Planned sessions</span>
            </div>
          </article>
        </div>
      </section>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {confirmation && (
        <div className="alert" role="status">
          {confirmation}
        </div>
      )}

      <section className="panel" style={{ padding: 24, marginTop: 20 }}>
        <div className="panel-heading">
          <div>
            <span className="section-eyebrow">CONVERSATION</span>
            <h3>Talk to StudyPilot</h3>
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={loadData}
            disabled={loading}
            title="Refresh study data"
          >
            ↻
          </button>
        </div>

        <div
          aria-live="polite"
          style={{
            display: "grid",
            gap: 14,
            maxHeight: 400,
            overflowY: "auto",
            padding: "16px 0",
          }}
        >
          {messages.map((message, index) => (
            <article
              key={`${message.role}-${index}`}
              style={{
                padding: 14,
                borderRadius: 12,
                background:
                  message.role === "user"
                    ? "rgba(124, 92, 255, 0.14)"
                    : "rgba(255, 255, 255, 0.04)",
              }}
            >
              <strong>
                {message.role === "user" ? "YOU" : "STUDYPILOT"}
              </strong>
              <p style={{ whiteSpace: "pre-wrap", marginBottom: 8 }}>
                {message.text}
              </p>
              {message.role === "assistant" && (
                <button
                  type="button"
                  className="voice-speak-button"
                  onClick={() => speak(message.text)}
                >
                  Read aloud
                </button>
              )}
            </article>
          ))}

          {loading && <p>Working on your request…</p>}
        </div>

        <form
          className="voice-composer"
          onSubmit={(event) => {
            event.preventDefault();
            askAssistant(question);
          }}
        >
          <button
            className="voice-mic-button"
            type="button"
            onClick={startListening}
            disabled={loading || listening}
            aria-label="Start voice input"
          >
            {listening ? "Listening…" : "🎙"}
          </button>

          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask a question or request a study session…"
            maxLength={500}
            disabled={loading}
            aria-label="Message StudyPilot"
          />

          <button
            className="voice-send-button"
            type="submit"
            disabled={!question.trim() || loading}
            aria-label="Send message"
          >
            Send
          </button>
        </form>

        <div className="voice-suggestions" style={{ marginTop: 16 }}>
          {[
            "What should I study today?",
            "Summarize my progress",
            "Schedule a 30-minute session for tomorrow",
            "Help me prepare for placements",
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="voice-suggestion"
              type="button"
              disabled={loading}
              onClick={() => askAssistant(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </section>

      {proposal && (
        <section className="panel" style={{ padding: 24, marginTop: 20 }}>
          <span className="section-eyebrow">ACTION REQUIRES CONFIRMATION</span>
          <h3>Review your proposed study session</h3>
          <p className="panel-description">
            Nothing has been saved yet. Check these details, then confirm to
            create the session in your StudyPilot database.
          </p>

          <form onSubmit={confirmSession} style={{ display: "grid", gap: 16 }}>
            <label>
              Subject
              <select
                value={sessionForm.subjectId}
                onChange={(event) => {
                  const subjectId = event.target.value;
                  setSessionForm((current) => ({ ...current, subjectId }));

                  const selected = subjects.find(
                    (item) => String(item._id) === subjectId
                  );

                  setProposal((current) =>
                    current
                      ? { ...current, subjectId, subjectName: selected?.name || "" }
                      : current
                  );
                }}
                required
              >
                {subjects.map((subject) => (
                  <option key={subject._id} value={String(subject._id)}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Date
              <input
                type="date"
                value={sessionForm.date}
                min={localDate(0)}
                onChange={(event) =>
                  setSessionForm((current) => ({
                    ...current,
                    date: event.target.value,
                  }))
                }
                required
              />
            </label>

            <label>
              Start time
              <input
                type="time"
                value={sessionForm.startTime}
                onChange={(event) =>
                  setSessionForm((current) => ({
                    ...current,
                    startTime: event.target.value,
                  }))
                }
                required
              />
            </label>

            <label>
              Duration (minutes)
              <input
                type="number"
                min="15"
                max="600"
                step="15"
                value={sessionForm.durationMinutes}
                onChange={(event) =>
                  setSessionForm((current) => ({
                    ...current,
                    durationMinutes: Number(event.target.value),
                  }))
                }
                required
              />
            </label>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                className="voice-send-button"
                type="submit"
                disabled={loading || !sessionForm.subjectId}
              >
                Confirm and schedule
              </button>

              <button
                className="icon-button"
                type="button"
                disabled={loading}
                onClick={() => setProposal(null)}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel" style={{ padding: 24, marginTop: 20 }}>
        <span className="section-eyebrow">QUICK NAVIGATION</span>
        <h3>Open a StudyPilot workspace</h3>
        <div className="voice-suggestions">
          <button className="voice-suggestion" onClick={() => onNavigate?.("planner")}>
            Study Planner →
          </button>
          <button className="voice-suggestion" onClick={() => onNavigate?.("rescue")}>
            AI Schedule Rescue →
          </button>
          <button className="voice-suggestion" onClick={() => onNavigate?.("twin")}>
            Academic Twin →
          </button>
        </div>
      </section>
    </div>
  );
}
