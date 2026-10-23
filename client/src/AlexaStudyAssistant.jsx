
import React, { useCallback, useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:3000/api";

const PAGE_COMMANDS = [
  { page: "overview", names: ["dashboard", "home", "overview"] },
  { page: "subjects", names: ["subjects", "my subjects", "subject list"] },
  { page: "planner", names: ["planner", "study planner", "schedule", "calendar"] },
  { page: "exams", names: ["exam prep", "exams", "exam preparation"] },
  { page: "twin", names: ["academic twin", "twin", "academic analysis"] },
  { page: "rescue", names: ["ai rescue", "rescue", "missed sessions", "schedule rescue"] },
  { page: "voice", names: ["voice coach", "voice coaching"] },
];

function getTomorrowDate(offset = 1) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDate(text) {
  const value = text.toLowerCase();

  if (value.includes("day after tomorrow")) return getTomorrowDate(2);
  if (value.includes("tomorrow")) return getTomorrowDate(1);
  if (value.includes("today")) return getTomorrowDate(0);

  const explicit = value.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (explicit) return explicit[1];

  return getTomorrowDate(1);
}

function parseDuration(text) {
  const value = text.toLowerCase();

  const hours = value.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/);
  const minutes = value.match(/(\d+)\s*(?:minutes?|mins?)\b/);

  if (hours) return Math.round(Number(hours[1]) * 60);
  if (minutes) return Number(minutes[1]);

  return 30;
}

function parseStartTime(text) {
  const value = text.toLowerCase();

  const match = value.match(
    /\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i
  );

  if (!match) return "18:00";

  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const meridiem = match[3].replace(/\./g, "").toLowerCase();

  if (hour < 1 || hour > 12 || minute > 59) return "18:00";

  if (meridiem === "pm" && hour !== 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatDate(date) {
  if (!date) return "";
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
}

function getErrorMessage(data, fallback) {
  return data?.message || data?.error || fallback;
}

export default function AlexaStudyAssistant({
  onNavigate,
  onDataChange,
}) {
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! I'm your StudyPilot assistant. You can ask a question, open a page, check your study sessions, or ask me to prepare a study session for your confirmation.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [proposal, setProposal] = useState(null);
  const [saving, setSaving] = useState(false);

  const recognitionRef = useRef(null);
  const transcriptRef = useRef("");
  const mountedRef = useRef(true);

  const [form, setForm] = useState({
    subjectId: "",
    date: getTomorrowDate(1),
    startTime: "18:00",
    durationMinutes: 30,
  });

  const addMessage = useCallback((role, text) => {
    setMessages((previous) => [...previous, { role, text }]);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [subjectsResponse, sessionsResponse] = await Promise.all([
        fetch(`${API_URL}/subjects`),
        fetch(`${API_URL}/sessions`),
      ]);

      if (!subjectsResponse.ok || !sessionsResponse.ok) {
        throw new Error("Could not load your subjects and study sessions.");
      }

      const subjectsData = await subjectsResponse.json();
      const sessionsData = await sessionsResponse.json();

      if (!Array.isArray(subjectsData) || !Array.isArray(sessionsData)) {
        throw new Error("The subjects or sessions API returned an unexpected response.");
      }

      if (!mountedRef.current) return;

      setSubjects(subjectsData);
      setSessions(sessionsData);

      setForm((previous) => ({
        ...previous,
        subjectId:
          previous.subjectId ||
          subjectsData[0]?._id ||
          subjectsData[0]?.id ||
          "",
      }));
    } catch (err) {
      if (mountedRef.current) {
        setError(err.message || "Unable to load StudyPilot data.");
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadData();

    return () => {
      mountedRef.current = false;
      recognitionRef.current?.abort();

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [loadData]);

  const speak = useCallback((text) => {
    if (!("speechSynthesis" in window)) {
      setError("Speech playback is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const navigateTo = useCallback(
    (page, message) => {
      setProposal(null);
      setNotice(message);
      setError("");
      onNavigate?.(page);
      addMessage("assistant", message);
    },
    [addMessage, onNavigate]
  );

  const prepareSession = useCallback(
    (text) => {
      if (!subjects.length) {
        addMessage(
          "assistant",
          "You need to add a subject before scheduling a session. Open My Subjects and add one first."
        );
        setNotice("Add a subject before scheduling.");
        return;
      }

      const lower = text.toLowerCase();

      const matchedSubject = subjects.find((subject) =>
        lower.includes(String(subject.name || "").toLowerCase())
      );

      const subjectId =
        matchedSubject?._id ||
        matchedSubject?.id ||
        subjects[0]?._id ||
        subjects[0]?.id ||
        "";

      const duration = parseDuration(text);

      if (duration < 15 || duration > 600) {
        addMessage(
          "assistant",
          "Study sessions must be between 15 and 600 minutes. Please say a valid duration."
        );
        return;
      }

      const proposalForm = {
        subjectId,
        date: parseDate(text),
        startTime: parseStartTime(text),
        durationMinutes: duration,
      };

      setForm(proposalForm);
      setProposal({ originalRequest: text });
      setNotice("");
      setError("");

      addMessage(
        "assistant",
        `I've prepared a session for ${matchedSubject?.name || subjects[0]?.name || "your subject"}. Please review the subject, date, time and duration below. Nothing has been saved yet.`
      );
    },
    [addMessage, subjects]
  );

  const handleCommand = useCallback(
    async (rawText) => {
      const text = rawText.trim();
      if (!text) return;

      const lower = text.toLowerCase().replace(/[?!.,]+$/g, "").trim();

      setError("");
      setNotice("");

      // Open pages directly rather than asking the AI to interpret navigation.
      const pageCommand = PAGE_COMMANDS.find((item) =>
        item.names.some((name) => {
          const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return new RegExp(
            `\\b(?:open|go to|show|take me to|navigate to|visit)\\s+(?:the\\s+)?${escaped}\\b`,
            "i"
          ).test(lower);
        })
      );

      if (pageCommand) {
        navigateTo(pageCommand.page, `Opening ${pageCommand.names[0]}.`);
        return;
      }

      // Read subjects from the backend.
      if (
        /\b(list|show|read|tell me|what are)\b/.test(lower) &&
        /\b(subjects|my subjects)\b/.test(lower)
      ) {
        if (!subjects.length) {
          addMessage("assistant", "You haven't added any subjects yet.");
        } else {
          addMessage(
            "assistant",
            `Your subjects are: ${subjects
              .map((subject) => subject.name)
              .filter(Boolean)
              .join(", ")}.`
          );
        }
        return;
      }

      // Summarize sessions using the current backend data.
      if (
        /\b(show|list|check|what are|tell me|read)\b/.test(lower) &&
        /\b(sessions|study sessions|study schedule|my schedule|upcoming sessions)\b/.test(lower)
      ) {
        if (!sessions.length) {
          addMessage(
            "assistant",
            "You don't have any study sessions saved yet. Ask me to schedule one."
          );
        } else {
          const upcoming = [...sessions]
            .sort((a, b) =>
              `${a.date || ""} ${a.startTime || ""}`.localeCompare(
                `${b.date || ""} ${b.startTime || ""}`
              )
            )
            .slice(0, 8);

          const summary = upcoming
            .map((session) => {
              const subject =
                session.subjectName ||
                subjects.find(
                  (item) =>
                    (item._id || item.id) === session.subjectId
                )?.name ||
                "Study session";

              return `${subject} on ${formatDate(session.date)} at ${
                session.startTime || "an unspecified time"
              } for ${session.durationMinutes || 0} minutes`;
            })
            .join(". ");

          addMessage("assistant", `Here are your saved sessions: ${summary}.`);
        }
        return;
      }

      // Schedule requests must become a reviewable proposal.
      const schedulingIntent =
        /\b(schedule|create|book|add|plan|set up|arrange)\b/.test(lower) &&
        /\b(session|study|studying|block|minutes?|mins?|hours?|hrs?|tomorrow|today)\b/.test(
          lower
        );

      if (schedulingIntent) {
        prepareSession(text);
        return;
      }

      // Refresh local data on request.
      if (/\b(refresh|reload|update)\b/.test(lower) && /\b(data|dashboard|subjects|sessions)\b/.test(lower)) {
        await loadData();
        addMessage("assistant", "I've refreshed your subjects and study sessions.");
        return;
      }

      // General questions use the existing backend Groq integration.
      setLoading(true);

      try {
        const response = await fetch(`${API_URL}/ai/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: text,
            context: {
              app: "StudyPilot AI",
              subjects: subjects.map((subject) => subject.name),
              sessions: sessions.slice(0, 20).map((session) => ({
                subjectName: session.subjectName,
                subjectId: session.subjectId,
                date: session.date,
                startTime: session.startTime,
                durationMinutes: session.durationMinutes,
                status: session.status,
              })),
            },
          }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            getErrorMessage(data, `AI request failed (${response.status}).`)
          );
        }

        const answer = data.answer || data.message;

        if (!answer) {
          throw new Error("The AI endpoint returned no answer.");
        }

        addMessage("assistant", answer);
      } catch (err) {
        setError(err.message || "Could not get an AI response.");
        addMessage(
          "assistant",
          "I couldn't reach the AI service just now. Your microphone is working, but please check the backend terminal and the /api/ai/chat request."
        );
      } finally {
        setLoading(false);
      }
    },
    [
      addMessage,
      loadData,
      navigateTo,
      prepareSession,
      sessions,
      subjects,
    ]
  );

  const submitText = useCallback(
    async (value = input) => {
      const text = value.trim();
      if (!text || loading || saving) return;

      setInput("");
      addMessage("user", text);
      await handleCommand(text);
    },
    [addMessage, handleCommand, input, loading, saving]
  );

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "Speech recognition isn't supported here. Use the latest Google Chrome and allow microphone access."
      );
      return;
    }

    recognitionRef.current?.abort();

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    transcriptRef.current = "";
    setListening(true);
    setError("");
    setNotice("Listening… speak now.");

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (finalTranscript.trim()) {
        transcriptRef.current += ` ${finalTranscript.trim()}`;
      }

      setInput(
        `${transcriptRef.current} ${interimTranscript}`.trim()
      );
    };

    recognition.onerror = (event) => {
      setListening(false);
      setNotice("");

      if (event.error !== "aborted" && event.error !== "no-speech") {
        setError(`Microphone error: ${event.error}.`);
      }
    };

    recognition.onend = () => {
      setListening(false);
      setNotice("");

      const transcript = transcriptRef.current.trim();

      // Process only the final recognized transcript.
      if (transcript) {
        setInput("");
        addMessage("user", transcript);
        handleCommand(transcript);
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("Couldn't start listening. Please try the microphone again.");
    }
  }, [addMessage, handleCommand]);

  const confirmSession = useCallback(async () => {
    if (saving || !proposal) return;

    if (!form.subjectId) {
      setError("Please choose a subject before confirming.");
      return;
    }

    if (!form.date || !form.startTime) {
      setError("Please choose a date and start time.");
      return;
    }

    if (
      !Number.isInteger(Number(form.durationMinutes)) ||
      Number(form.durationMinutes) < 15 ||
      Number(form.durationMinutes) > 600
    ) {
      setError("Duration must be between 15 and 600 minutes.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API_URL}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectId: form.subjectId,
          date: form.date,
          startTime: form.startTime,
          durationMinutes: Number(form.durationMinutes),
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          getErrorMessage(
            data,
            `Couldn't save the session (${response.status}).`
          )
        );
      }

      const subject = subjects.find(
        (item) => (item._id || item.id) === form.subjectId
      );

      setProposal(null);
      await loadData();
      onDataChange?.();

      const confirmation =
        `Session saved successfully: ${subject?.name || data.subjectName || "Study session"}, ` +
        `${formatDate(form.date)} at ${form.startTime}, ` +
        `${Number(form.durationMinutes)} minutes.`;

      setNotice(confirmation);
      addMessage("assistant", confirmation);
    } catch (err) {
      setError(
        err.message ||
          "The session couldn't be saved. Check the backend terminal for details."
      );
    } finally {
      setSaving(false);
    }
  }, [
    addMessage,
    form,
    loadData,
    onDataChange,
    proposal,
    saving,
    subjects,
  ]);

  const cancelProposal = () => {
    setProposal(null);
    setNotice("Scheduling cancelled. No session was saved.");
    addMessage("assistant", "No problem. I cancelled the proposed session.");
  };

  const suggestions = [
    "Open the study planner",
    "Show my subjects",
    "Show my study sessions",
    "Schedule a 30-minute session for tomorrow",
    "Explain cloud computing simply",
  ];

  return (
    <div className="voice-page">
      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="section-eyebrow">STUDYPILOT AI</div>
        <div className="panel-heading">
          <h2>Study Assistant</h2>
          <span className="badge">Voice + AI</span>
        </div>
        <p className="panel-description">
          Speak naturally. Supported commands perform actions, scheduling
          requires your confirmation, and general questions use your existing
          AI backend.
        </p>

        <div className="voice-stat-grid">
          <div className="voice-stat-card">
            <span>Subjects</span>
            <strong>{subjects.length}</strong>
          </div>
          <div className="voice-stat-card">
            <span>Saved sessions</span>
            <strong>{sessions.length}</strong>
          </div>
          <div className="voice-stat-card">
            <span>Assistant</span>
            <strong>{loading ? "Thinking…" : listening ? "Listening…" : "Ready"}</strong>
          </div>
        </div>

        {error && (
          <div className="alert" role="alert" style={{ marginTop: 16 }}>
            {error}
          </div>
        )}

        {notice && (
          <div className="alert" role="status" style={{ marginTop: 16 }}>
            {notice}
          </div>
        )}
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="panel-heading">
          <h3>Conversation</h3>
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setMessages([]);
              setError("");
              setNotice("");
              setProposal(null);
            }}
            title="Clear conversation"
          >
            Clear
          </button>
        </div>

        <div
          aria-live="polite"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            maxHeight: 400,
            overflowY: "auto",
            padding: "8px 2px",
          }}
        >
          {messages.map((message, index) => (
            <div
              key={`${index}-${message.role}`}
              style={{
                alignSelf:
                  message.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "90%",
                padding: "12px 14px",
                borderRadius: 14,
                background:
                  message.role === "user"
                    ? "rgba(124, 92, 255, 0.22)"
                    : "rgba(255,255,255,0.055)",
                border: "1px solid rgba(255,255,255,0.08)",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  opacity: 0.7,
                  marginBottom: 5,
                  textTransform: "uppercase",
                }}
              >
                {message.role === "user" ? "You" : "StudyPilot"}
              </div>
              {message.text}
              {message.role === "assistant" && (
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => speak(message.text)}
                  >
                    Read aloud
                  </button>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="panel-description">StudyPilot is thinking…</div>
          )}
        </div>

        <form
          className="voice-composer"
          onSubmit={(event) => {
            event.preventDefault();
            submitText();
          }}
        >
          <input
            aria-label="Message StudyPilot"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Say or type a command…"
            disabled={loading || saving}
          />

          <button
            type="button"
            className="voice-mic-button"
            onClick={listening ? () => recognitionRef.current?.stop() : startListening}
            disabled={loading || saving}
            title={listening ? "Stop listening" : "Start voice input"}
          >
            {listening ? "Stop" : "Mic"}
          </button>

          <button
            type="submit"
            className="voice-send-button"
            disabled={!input.trim() || loading || saving}
          >
            Send
          </button>
        </form>

        <div className="panel-description" style={{ marginTop: 10 }}>
          {listening
            ? "Listening now. Your final recognized sentence will be processed automatically."
            : speaking
              ? "Speaking the selected response."
              : "You can also type a command and press Send."}
        </div>
      </div>

      {proposal && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="section-eyebrow">REVIEW BEFORE SAVING</div>
          <div className="panel-heading">
            <h3>Proposed study session</h3>
          </div>
          <p className="panel-description">
            Check these details carefully. The session will not be saved until
            you select Confirm and schedule.
          </p>

          <div style={{ display: "grid", gap: 14 }}>
            <label>
              <span style={{ display: "block", marginBottom: 6 }}>Subject</span>
              <select
                value={form.subjectId}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    subjectId: event.target.value,
                  }))
                }
                style={{ width: "100%", padding: 10 }}
              >
                {subjects.map((subject) => (
                  <option
                    key={subject._id || subject.id}
                    value={subject._id || subject.id}
                  >
                    {subject.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span style={{ display: "block", marginBottom: 6 }}>Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    date: event.target.value,
                  }))
                }
                style={{ width: "100%", padding: 10 }}
              />
            </label>

            <label>
              <span style={{ display: "block", marginBottom: 6 }}>Start time</span>
              <input
                type="time"
                value={form.startTime}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    startTime: event.target.value,
                  }))
                }
                style={{ width: "100%", padding: 10 }}
              />
            </label>

            <label>
              <span style={{ display: "block", marginBottom: 6 }}>
                Duration in minutes
              </span>
              <input
                type="number"
                min="15"
                max="600"
                step="15"
                value={form.durationMinutes}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    durationMinutes: event.target.value,
                  }))
                }
                style={{ width: "100%", padding: 10 }}
              />
            </label>

            <div className="panel-description">
              Summary:{" "}
              {subjects.find(
                (subject) =>
                  (subject._id || subject.id) === form.subjectId
              )?.name || "Choose a subject"}{" "}
              · {formatDate(form.date)} · {form.startTime} ·{" "}
              {form.durationMinutes} minutes
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                className="voice-send-button"
                onClick={confirmSession}
                disabled={saving}
              >
                {saving ? "Saving…" : "Confirm and schedule"}
              </button>
              <button
                type="button"
                className="icon-button"
                onClick={cancelProposal}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-heading">
          <h3>Try saying</h3>
        </div>
        <div className="voice-suggestions">
          {suggestions.map((suggestion) => (
            <button
              type="button"
              className="voice-suggestion"
              key={suggestion}
              onClick={() => submitText(suggestion)}
              disabled={loading || saving}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
