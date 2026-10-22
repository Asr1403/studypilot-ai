import { useCallback, useEffect, useRef, useState } from "react";

const API_URL = "http://localhost:3000/api";

function Icon({ name, size = 18 }) {
  const paths = {
    mic: (
      <>
        <rect x="9" y="2" width="6" height="12" rx="3" />
        <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    volume: (
      <>
        <path d="M11 5 6 9H2v6h4l5 4z" />
        <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
      </>
    ),
    stop: <rect x="6" y="6" width="12" height="12" rx="2" />,
    sparkles: (
      <>
        <path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7z" />
        <path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M16 3v4M8 3v4M3 10h18" />
      </>
    ),
    book: (
      <>
        <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21z" />
        <path d="M4 5.5v13A2.5 2.5 0 0 1 6.5 16H20" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" />
      </>
    ),
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.sparkles}
    </svg>
  );
}

function formatDate(date) {
  if (!date) return "date not set";

  const parsed = new Date(`${date}T12:00:00`);

  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
}

function formatDuration(minutes = 0) {
  const value = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(value / 60);
  const remaining = value % 60;

  if (hours && remaining) return `${hours}h ${remaining}m`;
  if (hours) return `${hours}h`;

  return `${remaining} minutes`;
}

function cleanCoachText(value = "") {
  return String(value)
    // Decode common HTML entities without rendering HTML.
    .replace(/&nbsp;|&#x20;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    // Remove escaped Markdown characters returned by some AI responses.
    .replace(/\\([*_`#-])/g, "$1")
    // Remove bold and italic markers while preserving their text.
    .replace(/\*\*(.*?)\*\*/gs, "$1")
    .replace(/__(.*?)__/gs, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1")
    // Remove code fences and heading markers.
    .replace(/```[\w-]*\n?/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*>\s?/gm, "")
    // Normalize whitespace but keep paragraph breaks.
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function makeAnswer(question, context) {
  const q = question.toLowerCase();
  const { subjects, sessions, analysis } = context;

  const completed = sessions.filter(
    (session) => session.status === "completed"
  );

  const missed = sessions.filter(
    (session) => session.status === "missed"
  );

  const now = new Date();

  const upcoming = sessions
    .filter((session) => {
      if (session.status !== "planned" || !session.date) {
        return false;
      }

      const start = new Date(
        `${session.date}T${session.startTime || "00:00"}`
      );

      return !Number.isNaN(start.getTime()) && start >= now;
    })
    .sort((a, b) =>
      `${a.date}T${a.startTime || "00:00"}`.localeCompare(
        `${b.date}T${b.startTime || "00:00"}`
      )
    );

  const completedMinutes = completed.reduce(
    (sum, session) =>
      sum +
      Number(
        session.actualMinutes ??
          session.durationMinutes ??
          session.duration ??
          0
      ),
    0
  );

  const twin = analysis?.overview || {};
  const insights = analysis?.subjectInsights || [];

  if (
    q.includes("hello") ||
    q.includes("hi ") ||
    q.trim() === "hi" ||
    q.includes("who are you")
  ) {
    return "Hi! I'm your StudyPilot Voice Coach. I can help you review your study activity, find your next session, and decide what to focus on. Ask me what to study today or which subject needs attention.";
  }

  if (
    q.includes("what should i study") ||
    q.includes("what do i study") ||
    q.includes("study today") ||
    q.includes("next task") ||
    q.includes("what next")
  ) {
    if (upcoming.length) {
      const next = upcoming[0];

      return `Your next planned session is ${
        next.subjectName || "your study session"
      } on ${formatDate(next.date)} at ${
        next.startTime || "a time not specified"
      }. It is scheduled for ${
        next.durationMinutes ?? next.duration ?? 45
      } minutes. Start with that session, keep your phone away, and take a short break afterwards.`;
    }

    if (missed.length) {
      return `You don't have a future planned session, and you have ${
        missed.length
      } missed session${missed.length === 1 ? "" : "s"}. Open AI Rescue to choose one missed session and find a new slot. If you want to start fresh, schedule a short 25-minute session in your Study Planner.`;
    }

    if (subjects.length) {
      return `You have ${subjects.length} subject${
        subjects.length === 1 ? "" : "s"
      } tracked, but no upcoming planned session. Choose the subject you find most difficult and schedule a focused 25-minute study block.`;
    }

    return "Let's start by adding your subjects in My Subjects. Then create a short study session in the Study Planner, and I'll be able to give you guidance based on your saved study data.";
  }

  if (
    q.includes("missed") ||
    q.includes("recover") ||
    q.includes("catch up") ||
    q.includes("behind")
  ) {
    if (!missed.length && !(twin.overdueSessions > 0)) {
      return "Your current data shows no sessions marked as missed and no overdue planned sessions. Keep the momentum by checking your upcoming sessions. If a session was missed, mark it as missed in the planner so I can help you recover it.";
    }

    return `Your study data shows ${
      missed.length
    } missed session${missed.length === 1 ? "" : "s"} and ${
      twin.overdueSessions || 0
    } overdue planned session${
      twin.overdueSessions === 1 ? "" : "s"
    }. Open AI Rescue, choose a missed session, and review a suggested recovery slot before confirming it. Your original missed session stays in your history.`;
  }

  if (
    q.includes("risk") ||
    q.includes("academic twin") ||
    q.includes("health") ||
    q.includes("attention") ||
    q.includes("weak subject") ||
    q.includes("struggling")
  ) {
    if (!insights.length) {
      return "Your Academic Twin does not have any subjects to analyse yet. Add a subject first, then record study sessions to build a useful progress history.";
    }

    const ranked = [...insights].sort(
      (a, b) => (b.riskScore || 0) - (a.riskScore || 0)
    );

    const highest = ranked[0];

    if (!highest || highest.sessionsRecorded === 0) {
      return `You have ${subjects.length} subject${
        subjects.length === 1 ? "" : "s"
      } tracked, but there isn't enough session history to assess study patterns. Schedule a session for one of your subjects and mark the outcome honestly afterward.`;
    }

    return `Your highest current risk indicator is for ${
      highest.subjectName
    }, with a rules-based score of ${
      highest.riskScore
    } out of 100 and a ${highest.riskLevel} risk label. ${
      highest.recommendation
    } This score reflects recorded scheduling activity, not your ability or predicted exam marks.`;
  }

  if (
    q.includes("progress") ||
    q.includes("how am i doing") ||
    q.includes("study stats") ||
    q.includes("statistics") ||
    q.includes("summary")
  ) {
    return `Here is your StudyPilot summary. You have ${
      subjects.length
    } subjects and ${sessions.length} recorded sessions. ${
      completed.length
    } sessions are completed, ${missed.length} are marked missed, and ${
      upcoming.length
    } are upcoming. Your completed study time is ${formatDuration(
      completedMinutes
    )}. Your Academic Twin completion rate is ${
      twin.completionRate ?? 0
    } percent.`;
  }

  if (
    q.includes("upcoming") ||
    q.includes("schedule") ||
    q.includes("next session") ||
    q.includes("calendar")
  ) {
    if (!upcoming.length) {
      return "There are no upcoming planned sessions in your saved data. Open the Study Planner and schedule your next session. A realistic short session is a good place to start.";
    }

    const preview = upcoming.slice(0, 3).map(
      (session) =>
        `${session.subjectName || "Study session"} on ${formatDate(
          session.date
        )} at ${session.startTime || "time not set"}`
    );

    return `Your next planned sessions are: ${preview.join(
      "; "
    )}. Start with the earliest one and avoid scheduling overlapping sessions.`;
  }

  if (q.includes("subject") && subjects.length) {
    const list = subjects.slice(0, 8).map(
      (subject) =>
        `${subject.name}, target ${subject.targetHours ?? 5} hours per week`
    );

    return `Your tracked subjects are: ${list.join(
      "; "
    )}. Ask me which subject needs attention, or ask what you should study today to get a more specific suggestion.`;
  }

  if (
    q.includes("30-minute") ||
    q.includes("30 minute") ||
    q.includes("revision plan") ||
    q.includes("revise")
  ) {
    const subject = subjects[0]?.name;
    const subjectText = subject ? ` for ${subject}` : " for one subject you are currently studying";
    return `Try this 30-minute revision block${subjectText}: spend 5 minutes recalling what you already know without notes, 15 minutes revising one small topic, 7 minutes answering practice questions, and 3 minutes writing down what to revisit. If you have a subject you find difficult, choose that one first. I do not have enough detail here to verify your upcoming exam topics, so use your syllabus to select the topic.`;
  }

  if (
    q.includes("quiz me") ||
    q.includes("practice question") ||
    q.includes("coding problem") ||
    q.includes("placement") ||
    q.includes("dsa")
  ) {
    return "Let's practise actively. For placement preparation, choose one DSA topic you are currently learning and solve one easy problem in 20 minutes. Then explain the approach, time complexity, and space complexity aloud. I do not know your current DSA level from the saved study data, so tell me a topic such as arrays, strings, hashing, or binary search and I can tailor the practice. For a quiz, tell me the subject and topic and I will ask questions one at a time.";
  }

  if (
    q.includes("exam") ||
    q.includes("syllabus") ||
    q.includes("test prep")
  ) {
    return "Use a three-step revision cycle: first, list the topics from your actual syllabus; second, practise recalling each topic without looking at notes; third, solve past-paper or sample questions and review mistakes. Start with the topic that is both important in your syllabus and least familiar to you. I cannot see your exam date or syllabus in the current study context, so check those before deciding how much to cover today.";
  }

  if (
    q.includes("motivat") ||
    q.includes("procrastinat") ||
    q.includes("focus")
  ) {
    return "Make the next step small enough that you can begin now. Pick one topic, set a 25-minute timer, and keep only the materials you need open. You don't need to finish the whole syllabus in one sitting; you just need to complete the next focused block.";
  }

  return "I can help with your study plan, upcoming sessions, missed sessions, subject health, and overall progress. Try asking: What should I study today? Which subject needs attention? How am I doing? Or help me recover a missed session.";
}

export default function VoiceCoach({ onNavigate }) {
  const [question, setQuestion] = useState("");

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi! I'm your StudyPilot Voice Coach. Ask what you should study today, check your progress, or find out which subject needs attention.",
    },
  ]);

  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState("");

  const recognitionRef = useRef(null);
  const bottomRef = useRef(null);

  const loadContext = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [
        subjectResponse,
        sessionResponse,
        twinResponse,
      ] = await Promise.all([
        fetch(`${API_URL}/subjects`),
        fetch(`${API_URL}/sessions`),
        fetch(`${API_URL}/twin/analysis`),
      ]);

      const [subjectData, sessionData, twinData] = await Promise.all([
        subjectResponse.json(),
        sessionResponse.json(),
        twinResponse.json(),
      ]);

      if (!subjectResponse.ok) {
        throw new Error(subjectData.error || "Could not load subjects.");
      }

      if (!sessionResponse.ok) {
        throw new Error(sessionData.error || "Could not load sessions.");
      }

      if (!twinResponse.ok || !twinData.success) {
        throw new Error(
          twinData.error || "Could not load Academic Twin."
        );
      }

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

      setAnalysis(twinData);
    } catch (err) {
      setError(
        err.message ||
          "Could not connect to StudyPilot. Check that your backend is running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContext();

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      }

      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [loadContext]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, thinking]);

  const speak = (rawText) => {
    if (!("speechSynthesis" in window)) {
      setError("Spoken responses are not supported by this browser.");
      return;
    }

    const cleanText = cleanCoachText(rawText);

    if (!cleanText) {
      setError("There is no readable text to speak.");
      return;
    }

    const synth = window.speechSynthesis;
    synth.cancel();
    setSpeaking(false);

    // Split long answers into short chunks for more reliable browser speech.
    const chunks = cleanText
      .match(/[^.!?]+[.!?]+|[^.!?]+$/g)
      ?.map((part) => part.trim())
      .filter(Boolean) || [cleanText];

    const voices = synth.getVoices();
    const selectedVoice =
      voices.find((voice) => voice.lang.toLowerCase() === "en-in") ||
      voices.find((voice) => voice.lang.toLowerCase() === "en-gb") ||
      voices.find((voice) => voice.lang.toLowerCase() === "en-us") ||
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));

    chunks.forEach((chunk, index) => {
      const utterance = new SpeechSynthesisUtterance(chunk);

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
      } else {
        utterance.lang = "en-IN";
      }

      utterance.rate = 1.12;
      utterance.pitch = 1.0;
      utterance.volume = 1;

      if (index === 0) {
        utterance.onstart = () => setSpeaking(true);
      }

      if (index === chunks.length - 1) {
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = (event) => {
          setSpeaking(false);
          if (event.error !== "canceled" && event.error !== "interrupted") {
            setError("Speech playback stopped. Please try Read aloud again.");
          }
        };
      }

      synth.speak(utterance);
    });
  };

  const askCoach = async (rawQuestion) => {
    const text = rawQuestion.trim();

    if (!text || thinking) return;

    setQuestion("");
    setError("");

    setMessages((current) => [
      ...current,
      { role: "user", text },
    ]);

    setThinking(true);

    try {
      // Refresh saved study data before generating an answer.
      const [
        subjectResponse,
        sessionResponse,
        twinResponse,
      ] = await Promise.all([
        fetch(`${API_URL}/subjects`),
        fetch(`${API_URL}/sessions`),
        fetch(`${API_URL}/twin/analysis`),
      ]);

      const [subjectData, sessionData, twinData] = await Promise.all([
        subjectResponse.json(),
        sessionResponse.json(),
        twinResponse.json(),
      ]);

      if (
        !subjectResponse.ok ||
        !sessionResponse.ok ||
        !twinResponse.ok ||
        !twinData.success
      ) {
        throw new Error("Could not refresh your study data.");
      }

      const latestSubjects = Array.isArray(subjectData)
        ? subjectData
        : subjectData.subjects || [];

      const latestSessions = Array.isArray(sessionData)
        ? sessionData
        : sessionData.sessions || [];

      setSubjects(latestSubjects);
      setSessions(latestSessions);
      setAnalysis(twinData);

      let answer;

      try {
        // Keep the request compact because the backend limits message length.
        // Send a small study summary instead of every database record.
        const compactStudyContext = {
          subjects: latestSubjects
            .slice(0, 5)
            .map((subject) => String(subject.name || "Subject").slice(0, 35)),
          sessionCounts: {
            total: latestSessions.length,
            completed: latestSessions.filter(
              (session) => session.status === "completed"
            ).length,
            missed: latestSessions.filter(
              (session) => session.status === "missed"
            ).length,
            planned: latestSessions.filter(
              (session) => session.status === "planned"
            ).length,
          },
          academicTwin: {
            completionRate: twinData.overview?.completionRate ?? null,
            overdueSessions: twinData.overview?.overdueSessions ?? null,
            overallRiskScore: twinData.overview?.overallRiskScore ?? null,
          },
        };

        const contextText = `Study context: ${JSON.stringify(compactStudyContext)}`;
        const instructions =
          "You are StudyPilot Coach, a thoughtful, practical study mentor. Answer the user's exact question first, in friendly natural English. Make advice specific and actionable: give one clear next step, a realistic time estimate, and a simple way to measure completion when relevant. Use the provided study context only for claims about this user's progress. Never invent subjects, marks, exam dates, deadlines, weak areas, or statistics. If data is missing, say so briefly and ask one useful follow-up question. For study plans, make a short prioritized plan with breaks; for missed sessions, suggest a manageable recovery plan without overloading the day; for exam revision, use active recall and practice questions; for placements, recommend a concrete coding/DSA task and a follow-up review. Explain concepts step by step when asked. Keep ordinary answers concise and voice-friendly, usually 2 to 5 sentences. Use plain text only: no Markdown bold, asterisk decoration, HTML entities, or unnecessary headings. Avoid generic motivation and repeated advice.";
        const availableContextLength = Math.max(
          0,
          950 - text.length - instructions.length - 4
        );
        const aiMessage = `${text}

${contextText.slice(
          0,
          availableContextLength
        )}

${instructions}`.slice(0, 950);

        const aiResponse = await fetch(`${API_URL}/ai/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ message: aiMessage }),
        });

        const aiData = await aiResponse.json();

        if (!aiResponse.ok || !aiData.success || !aiData.answer) {
          throw new Error(
            aiData.error || "The AI service could not answer right now."
          );
        }

        answer = cleanCoachText(aiData.answer);
      } catch (aiError) {
        // Keep the Voice Coach useful if the AI provider is unavailable.
        console.warn(
          "AI request failed; using the local study coach.",
          aiError.message
        );

        answer = makeAnswer(text, {
          subjects: latestSubjects,
          sessions: latestSessions,
          analysis: twinData,
        });
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", text: answer },
      ]);
    } catch (err) {
      const message =
        err.message || "I couldn't retrieve your latest study data.";

      setError(message);

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text: "I couldn't access your latest study data. Check that the StudyPilot backend is running, then try again.",
        },
      ]);
    } finally {
      setThinking(false);
    }
  };

  const startListening = () => {
    setError("");

    const SpeechRecognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setError(
        "Voice input is not supported in this browser. Try the latest Chrome or type your question instead."
      );
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognition();

    recognition.lang = "en-IN";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event) => {
      let transcript = "";

      for (
        let i = event.resultIndex;
        i < event.results.length;
        i += 1
      ) {
        transcript += event.results[i][0].transcript;
      }

      setQuestion(transcript);

      const finalResult =
        event.results[event.results.length - 1];

      if (finalResult?.isFinal) {
        setQuestion(transcript);
      }
    };

    recognition.onerror = (event) => {
      setListening(false);

      if (event.error === "not-allowed") {
        setError(
          "Microphone permission was denied. Allow microphone access in your browser settings."
        );
      } else if (event.error !== "aborted") {
        setError(
          `Voice input error: ${event.error}. You can type your question instead.`
        );
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("Could not start the microphone. Please try again.");
    }
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setSpeaking(false);
  };

  const suggestions = [
    "Create a realistic study plan for today",
    "Which subject should I prioritize, and why?",
    "Give me a 30-minute revision plan",
    "Help me recover my missed sessions",
    "Quiz me with 5 questions on a subject",
    "Give me one DSA problem for placement prep",
  ];

  const completedCount = sessions.filter(
    (session) => session.status === "completed"
  ).length;

  const missedCount = sessions.filter(
    (session) => session.status === "missed"
  ).length;

  return (
    <div className="voice-page">
      <section className="voice-hero">
        <div className="voice-hero-copy">
          <span className="voice-eyebrow">
            <Icon name="sparkles" size={14} />
            YOUR PERSONAL STUDY COMPANION
          </span>

          <h2>
            Meet your
            <br />
            <span>Voice Coach.</span>
          </h2>

          <p>
            Ask about your study plan, understand your progress, and
            choose your next step using your saved StudyPilot data.
          </p>

          <div className="voice-hero-tags">
            <span>
              <Icon name="mic" size={14} /> Voice input
            </span>
            <span>
              <Icon name="volume" size={14} /> Spoken answers
            </span>
            <span>
              <Icon name="check" size={14} /> Study-data grounded
            </span>
          </div>
        </div>

        <div
          className={`voice-orb ${
            listening ? "voice-orb-listening" : ""
          } ${speaking ? "voice-orb-speaking" : ""}`}
        >
          <div className="voice-orb-ring voice-orb-ring-one" />
          <div className="voice-orb-ring voice-orb-ring-two" />

          <div className="voice-orb-core">
            <Icon
              name={
                listening
                  ? "mic"
                  : speaking
                    ? "volume"
                    : "sparkles"
              }
              size={37}
            />
          </div>

          <span className="voice-orb-status">
            {listening
              ? "LISTENING"
              : speaking
                ? "SPEAKING"
                : "READY WHEN YOU ARE"}
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

      <section className="voice-stat-grid">
        <article className="voice-stat-card">
          <span className="voice-stat-icon">
            <Icon name="book" />
          </span>

          <div>
            <strong>{loading ? "—" : subjects.length}</strong>
            <span>Subjects tracked</span>
          </div>
        </article>

        <article className="voice-stat-card">
          <span className="voice-stat-icon voice-stat-green">
            <Icon name="check" />
          </span>

          <div>
            <strong>{loading ? "—" : completedCount}</strong>
            <span>Sessions completed</span>
          </div>
        </article>

        <article className="voice-stat-card">
          <span className="voice-stat-icon voice-stat-pink">
            <Icon name="clock" />
          </span>

          <div>
            <strong>{loading ? "—" : missedCount}</strong>
            <span>Sessions missed</span>
          </div>
        </article>

        <article className="voice-stat-card">
          <span className="voice-stat-icon voice-stat-blue">
            <Icon name="sparkles" />
          </span>

          <div>
            <strong>
              {loading
                ? "—"
                : `${analysis?.overview?.overallRiskScore ?? 0}/100`}
            </strong>
            <span>Academic Twin risk</span>
          </div>
        </article>
      </section>

      <section className="voice-layout">
        <div className="panel voice-chat-panel">
          <div className="panel-heading">
            <div>
              <span className="section-eyebrow">
                ASK. LEARN. TAKE ACTION.
              </span>
              <h3>Your study conversation</h3>
            </div>

            <button
              className="icon-button"
              title="Refresh study data"
              aria-label="Refresh study data"
              onClick={loadContext}
              disabled={loading || thinking}
            >
              <Icon name="refresh" />
            </button>
          </div>

          <p className="panel-description">
            Ask a question below or use the microphone. Your answers
            are based on your saved study records and the current
            Academic Twin.
          </p>

          <div className="voice-suggestions">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                className="voice-suggestion"
                onClick={() => askCoach(suggestion)}
                disabled={thinking || loading}
              >
                {suggestion}
                <Icon name="arrow" size={14} />
              </button>
            ))}
          </div>

          <div className="voice-messages" aria-live="polite">
            {messages.map((message, index) => (
              <article
                className={`voice-message ${
                  message.role === "user"
                    ? "voice-message-user"
                    : "voice-message-assistant"
                }`}
                key={`${message.role}-${index}`}
              >
                <div className="voice-message-avatar">
                  {message.role === "user" ? (
                    "YOU"
                  ) : (
                    <Icon name="sparkles" size={16} />
                  )}
                </div>

                <div className="voice-message-content">
                  <span className="voice-message-label">
                    {message.role === "user"
                      ? "YOU"
                      : "STUDYPILOT COACH"}
                  </span>

                  <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {message.role === "assistant"
                      ? cleanCoachText(message.text)
                      : message.text}
                  </p>

                  {message.role === "assistant" && index > 0 && (
                    <button
                      className="voice-speak-button"
                      onClick={() => speak(message.text)}
                    >
                      <Icon name="volume" size={14} />
                      Read aloud
                    </button>
                  )}
                </div>
              </article>
            ))}

            {thinking && (
              <div className="voice-thinking">
                <span className="loading-ring" />
                Checking your study data…
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <form
            className="voice-composer"
            onSubmit={(event) => {
              event.preventDefault();
              askCoach(question);
            }}
          >
            <button
              className={`voice-mic-button ${
                listening ? "voice-mic-active" : ""
              }`}
              type="button"
              onClick={startListening}
              title={listening ? "Stop listening" : "Start voice input"}
              aria-label={
                listening ? "Stop listening" : "Start voice input"
              }
              disabled={thinking}
            >
              <Icon
                name={listening ? "stop" : "mic"}
                size={20}
              />
            </button>

            <input
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder={
                listening
                  ? "Listening… speak now"
                  : "Ask your study coach anything…"
              }
              aria-label="Question for your study coach"
              maxLength={500}
              disabled={thinking}
            />

            <button
              className="voice-send-button"
              type="submit"
              aria-label="Send question"
              disabled={!question.trim() || thinking}
            >
              <Icon name="send" size={18} />
            </button>
          </form>

          <div className="voice-composer-footer">
            <span>
              {listening
                ? "Microphone active — speak clearly"
                : "Tip: ask a specific question for a more useful answer"}
            </span>

            {speaking && (
              <button
                className="voice-stop-speaking"
                onClick={stopSpeaking}
              >
                <Icon name="stop" size={13} />
                Stop speaking
              </button>
            )}
          </div>
        </div>

        <aside className="voice-side-column">
          <section className="panel voice-action-panel">
            <div className="panel-heading">
              <div>
                <span className="section-eyebrow">
                  QUICK ACTIONS
                </span>
                <h3>Make your next move</h3>
              </div>
            </div>

            <button
              className="voice-action-card"
              onClick={() => onNavigate?.("planner")}
            >
              <span className="voice-action-icon">
                <Icon name="calendar" />
              </span>

              <span>
                <strong>Open study planner</strong>
                <small>Schedule your next focused block</small>
              </span>

              <Icon name="arrow" size={16} />
            </button>

            <button
              className="voice-action-card"
              onClick={() => onNavigate?.("rescue")}
            >
              <span className="voice-action-icon voice-action-pink">
                <Icon name="refresh" />
              </span>

              <span>
                <strong>Recover a session</strong>
                <small>Find a new slot for missed work</small>
              </span>

              <Icon name="arrow" size={16} />
            </button>

            <button
              className="voice-action-card"
              onClick={() => onNavigate?.("twin")}
            >
              <span className="voice-action-icon voice-action-blue">
                <Icon name="sparkles" />
              </span>

              <span>
                <strong>View Academic Twin</strong>
                <small>Review subject health and risk</small>
              </span>

              <Icon name="arrow" size={16} />
            </button>
          </section>

          <section className="panel voice-how-panel">
            <span className="section-eyebrow">
              HOW THE COACH WORKS
            </span>

            <h3>Grounded in your data</h3>

            <div className="voice-how-item">
              <span>01</span>

              <div>
                <strong>Reads your study records</strong>
                <p>
                  Subjects, sessions, and Academic Twin analysis are
                  fetched from your backend.
                </p>
              </div>
            </div>

            <div className="voice-how-item">
              <span>02</span>

              <div>
                <strong>Responds to your question</strong>
                <p>
                  Groq AI answers your questions and uses your study
                  records to personalize guidance.
                </p>
              </div>
            </div>

            <div className="voice-how-item">
              <span>03</span>

              <div>
                <strong>You stay in control</strong>
                <p>
                  The coach suggests actions. You decide when to
                  change or schedule your plan.
                </p>
              </div>
            </div>

            <div className="voice-disclosure">
              AI responses are generated through the configured backend
              AI provider. Study statistics come from your saved
              records. Browser speech features provide voice input
              and read-aloud.
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}