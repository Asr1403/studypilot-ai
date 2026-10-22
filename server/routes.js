
const express = require("express");
const { ObjectId } = require("mongodb");
const { getDatabase } = require("./database");

const router = express.Router();

const validDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

const validTime = (value) =>
  typeof value === "string" &&
  /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

function getSessionDateTime(session) {
  if (!validDate(session.date) || !validTime(session.startTime)) {
    return null;
  }

  const value = new Date(`${session.date}T${session.startTime}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function getSessionDuration(session) {
  const duration = Number(
    session.durationMinutes ?? session.duration ?? 45
  );

  return Number.isFinite(duration) && duration > 0 ? duration : 45;
}

function sessionsOverlap(start, duration, existingSessions) {
  const end = new Date(start.getTime() + duration * 60000);

  return existingSessions.some((existing) => {
    const existingStart = getSessionDateTime(existing);

    if (!existingStart) return false;

    const existingEnd = new Date(
      existingStart.getTime() + getSessionDuration(existing) * 60000
    );

    return start < existingEnd && end > existingStart;
  });
}

// ---------------- SUBJECTS ----------------

router.get("/subjects", async (req, res) => {
  try {
    const db = getDatabase();

    const subjects = await db
      .collection("subjects")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.json(subjects);
  } catch (error) {
    console.error("Fetch subjects:", error.message);
    res.status(500).json({ error: "Could not fetch subjects" });
  }
});

router.post("/subjects", async (req, res) => {
  try {
    const { name, targetHours } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      name.trim().length > 100
    ) {
      return res.status(400).json({
        error: "Subject name must be between 1 and 100 characters",
      });
    }

    const hours = Number(targetHours);

    if (!Number.isFinite(hours) || hours < 1 || hours > 100) {
      return res.status(400).json({
        error: "Target hours must be between 1 and 100",
      });
    }

    const db = getDatabase();

    const subject = {
      name: name.trim(),
      targetHours: hours,
      createdAt: new Date(),
    };

    const result = await db.collection("subjects").insertOne(subject);

    res.status(201).json({
      _id: result.insertedId,
      ...subject,
    });
  } catch (error) {
    console.error("Add subject:", error.message);
    res.status(500).json({ error: "Could not add subject" });
  }
});

router.delete("/subjects/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid subject ID" });
    }

    const db = getDatabase();

    const result = await db.collection("subjects").deleteOne({
      _id: new ObjectId(req.params.id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Subject not found" });
    }

    res.json({ message: "Subject deleted successfully" });
  } catch (error) {
    console.error("Delete subject:", error.message);
    res.status(500).json({ error: "Could not delete subject" });
  }
});

// ---------------- STUDY SESSIONS ----------------

router.get("/sessions", async (req, res) => {
  try {
    const db = getDatabase();

    const sessions = await db
      .collection("sessions")
      .find({})
      .sort({ date: 1, startTime: 1 })
      .toArray();

    res.json(sessions);
  } catch (error) {
    console.error("Fetch sessions:", error.message);
    res.status(500).json({ error: "Could not fetch study sessions" });
  }
});

router.post("/sessions", async (req, res) => {
  try {
    const { subjectId, date, startTime, durationMinutes } = req.body;

    if (
      typeof subjectId !== "string" ||
      !ObjectId.isValid(subjectId)
    ) {
      return res.status(400).json({ error: "Select a valid subject" });
    }

    if (!validDate(date)) {
      return res.status(400).json({
        error: "Enter a valid session date in YYYY-MM-DD format",
      });
    }

    if (!validTime(startTime)) {
      return res.status(400).json({
        error: "Enter a valid start time in HH:mm format",
      });
    }

    const duration = Number(durationMinutes);

    if (
      !Number.isInteger(duration) ||
      duration < 15 ||
      duration > 600
    ) {
      return res.status(400).json({
        error: "Duration must be between 15 and 600 minutes",
      });
    }

    const db = getDatabase();

    const subject = await db.collection("subjects").findOne({
      _id: new ObjectId(subjectId),
    });

    if (!subject) {
      return res.status(404).json({ error: "Subject not found" });
    }

    const sessionStart = new Date(`${date}T${startTime}:00`);

    const plannedSessions = await db
      .collection("sessions")
      .find({ status: "planned" })
      .toArray();

    if (sessionsOverlap(sessionStart, duration, plannedSessions)) {
      return res.status(409).json({
        error: "This session overlaps another planned study session.",
      });
    }

    const session = {
      subjectId: subject._id,
      subjectName: subject.name,
      date,
      startTime,
      durationMinutes: duration,
      actualMinutes: 0,
      status: "planned",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("sessions").insertOne(session);

    res.status(201).json({
      _id: result.insertedId,
      ...session,
    });
  } catch (error) {
    console.error("Create session:", error.message);
    res.status(500).json({ error: "Could not create study session" });
  }
});

router.patch("/sessions/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    const { status, actualMinutes } = req.body;
    const allowedStatuses = ["planned", "completed", "missed"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Status must be planned, completed, or missed",
      });
    }

    const db = getDatabase();

    const session = await db.collection("sessions").findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    const update = {
      status,
      updatedAt: new Date(),
    };

    if (actualMinutes !== undefined) {
      const minutes = Number(actualMinutes);

      if (
        !Number.isInteger(minutes) ||
        minutes < 0 ||
        minutes > 600
      ) {
        return res.status(400).json({
          error: "Actual study time must be between 0 and 600 minutes",
        });
      }

      update.actualMinutes = minutes;
    } else if (status === "completed") {
      update.actualMinutes = session.durationMinutes;
    } else if (status === "missed") {
      update.actualMinutes = 0;
    }

    await db.collection("sessions").updateOne(
      { _id: session._id },
      { $set: update }
    );

    res.json({
      ...session,
      ...update,
      _id: session._id,
    });
  } catch (error) {
    console.error("Update session:", error.message);
    res.status(500).json({ error: "Could not update study session" });
  }
});

router.delete("/sessions/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    const db = getDatabase();

    const result = await db.collection("sessions").deleteOne({
      _id: new ObjectId(req.params.id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Session not found" });
    }

    res.json({ message: "Study session deleted successfully" });
  } catch (error) {
    console.error("Delete session:", error.message);
    res.status(500).json({ error: "Could not delete study session" });
  }
});

// ---------------- AUTO-RECOVERY SUGGESTIONS ----------------

// Generates suggestions only. It does not create or modify sessions.
// GET /api/rescue/suggestions?sessionId=YOUR_MISSED_SESSION_ID

router.get("/rescue/suggestions", async (req, res) => {
  try {
    const { sessionId } = req.query;

    if (
      typeof sessionId !== "string" ||
      !ObjectId.isValid(sessionId)
    ) {
      return res.status(400).json({
        error: "A valid missed sessionId is required",
      });
    }

    const db = getDatabase();

    const sourceSession = await db.collection("sessions").findOne({
      _id: new ObjectId(sessionId),
    });

    if (!sourceSession) {
      return res.status(404).json({
        error: "Source session not found",
      });
    }

    if (sourceSession.status !== "missed") {
      return res.status(409).json({
        error: "Only missed sessions can have recovery suggestions",
      });
    }

    const plannedSessions = await db
      .collection("sessions")
      .find({ status: "planned" })
      .toArray();

    const now = new Date();
    const duration = getSessionDuration(sourceSession);
    const candidateTimes = [
      "18:00",
      "19:00",
      "20:00",
      "10:00",
      "14:00",
    ];

    const suggestions = [];

    // Search the next 14 days for up to five conflict-free options.
    for (
      let dayOffset = 1;
      dayOffset <= 14 && suggestions.length < 5;
      dayOffset += 1
    ) {
      const day = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + dayOffset
      );

      const date = [
        day.getFullYear(),
        String(day.getMonth() + 1).padStart(2, "0"),
        String(day.getDate()).padStart(2, "0"),
      ].join("-");

      for (const startTime of candidateTimes) {
        const start = new Date(`${date}T${startTime}:00`);

        if (start <= now) continue;

        if (!sessionsOverlap(start, duration, plannedSessions)) {
          suggestions.push({
            date,
            startTime,
            durationMinutes: duration,
          });

          // One suggestion per day keeps the options spread out.
          break;
        }
      }
    }

    return res.json({
      success: true,
      sessionId,
      suggestions,
      message: suggestions.length
        ? "Found conflict-free recovery options. Review one before scheduling."
        : "No conflict-free slots were found in the next 14 days.",
    });
  } catch (error) {
    console.error("Recovery suggestions failed:", error.message);

    return res.status(500).json({
      error: "Could not generate recovery suggestions",
    });
  }
});

// ---------------- AI SCHEDULE RESCUE ANALYSIS ----------------

router.get("/rescue/analysis", async (req, res) => {
  try {
    const db = getDatabase();

    const plannedSessions = await db
      .collection("sessions")
      .find({ status: "planned" })
      .sort({ date: 1, startTime: 1 })
      .toArray();

    const now = new Date();
    const overdueSessions = [];
    const upcomingSessions = [];

    for (const session of plannedSessions) {
      const scheduledTime = getSessionDateTime(session);

      if (!scheduledTime) continue;

      if (scheduledTime < now) {
        overdueSessions.push(session);
      } else {
        upcomingSessions.push(session);
      }
    }

    res.json({
      success: true,
      summary: {
        overdueCount: overdueSessions.length,
        upcomingCount: upcomingSessions.length,
      },
      overdueSessions,
      upcomingSessions,
      message:
        overdueSessions.length > 0
          ? "Overdue sessions found. A recovery plan can be proposed."
          : "No overdue planned sessions found.",
    });
  } catch (error) {
    console.error("Schedule Rescue analysis failed:", error.message);

    res.status(500).json({
      success: false,
      error: "Could not analyze study sessions.",
    });
  }
});

// ---------------- ACADEMIC TWIN ----------------

// Read-only analysis of existing study data.
// This is a transparent rules-based baseline, not an AI-generated prediction.

router.get("/twin/analysis", async (req, res) => {
  try {
    const db = getDatabase();

    const [subjects, sessions] = await Promise.all([
      db.collection("subjects").find({}).toArray(),
      db.collection("sessions").find({}).toArray(),
    ]);

    const now = new Date();

    const today = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-");

    const completed = sessions.filter(
      (session) => session.status === "completed"
    );

    const missed = sessions.filter(
      (session) => session.status === "missed"
    );

    const planned = sessions.filter(
      (session) => session.status === "planned"
    );

    const overdue = planned.filter((session) => {
      const start = getSessionDateTime(session);
      return start && start < now;
    });

    const upcoming = planned.filter((session) => {
      const start = getSessionDateTime(session);
      return start && start >= now;
    });

    const total = sessions.length;

    const completionRate = total
      ? Math.round((completed.length / total) * 100)
      : 0;

    const plannedMinutes = upcoming.reduce(
      (sum, session) =>
        sum +
        Number(
          session.durationMinutes ?? session.duration ?? 0
        ),
      0
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

    // Calculate risk for every subject.
    const subjectInsights = subjects.map((subject) => {
      const related = sessions.filter(
        (session) =>
          String(session.subjectId) === String(subject._id) ||
          (!session.subjectId &&
            session.subjectName === subject.name)
      );

      const subjectCompleted = related.filter(
        (session) => session.status === "completed"
      );

      const subjectMissed = related.filter(
        (session) => session.status === "missed"
      );

      const subjectOverdue = related.filter((session) => {
        if (session.status !== "planned") return false;

        const start = getSessionDateTime(session);
        return start && start < now;
      });

      const subjectUpcoming = related.filter((session) => {
        if (session.status !== "planned") return false;

        const start = getSessionDateTime(session);
        return start && start >= now;
      });

      const reasons = [];
      let riskScore = 0;

      if (subjectMissed.length > 0) {
        riskScore += Math.min(50, subjectMissed.length * 20);
        reasons.push(
          `${subjectMissed.length} missed session(s)`
        );
      }

      if (subjectOverdue.length > 0) {
        riskScore += Math.min(40, subjectOverdue.length * 25);
        reasons.push(
          `${subjectOverdue.length} overdue planned session(s)`
        );
      }

      if (related.length >= 3) {
        const rate =
          subjectCompleted.length / related.length;

        if (rate < 0.5) {
          riskScore += 20;
          reasons.push(
            "Less than half of recorded sessions are completed"
          );
        }
      }

      if (related.length > 0 && subjectUpcoming.length === 0) {
        riskScore += 15;
        reasons.push("No future study session is scheduled");
      }

      riskScore = Math.min(100, riskScore);

      const riskLevel =
        riskScore >= 60
          ? "high"
          : riskScore >= 25
            ? "moderate"
            : "low";

      let recommendation =
        "Keep your next planned session and review progress regularly.";

      if (
        subjectOverdue.length > 0 ||
        subjectMissed.length > 0
      ) {
        recommendation =
          "Recover a missed or overdue session and choose a conflict-free slot.";
      } else if (related.length === 0) {
        recommendation =
          "Schedule your first study session to start building a progress history.";
      } else if (subjectUpcoming.length === 0) {
        recommendation =
          "Add a future session so this subject remains part of your study routine.";
      }

      return {
        subjectId: String(subject._id),
        subjectName: subject.name,
        targetHoursPerWeek: Number(subject.targetHours || 0),
        sessionsRecorded: related.length,
        completedSessions: subjectCompleted.length,
        missedSessions: subjectMissed.length,
        overdueSessions: subjectOverdue.length,
        upcomingSessions: subjectUpcoming.length,
        completionRate: related.length
          ? Math.round(
              (subjectCompleted.length / related.length) * 100
            )
          : 0,
        riskScore,
        riskLevel,
        reasons,
        recommendation,
      };
    });

    // Overall risk combines missed work, overdue work,
    // low completion, and the absence of future sessions.
    const totalMissedAndOverdue =
      missed.length + overdue.length;

    const overallRiskScore = Math.min(
      100,
      missed.length * 20 +
        overdue.length * 25 +
        (total >= 3 && completionRate < 50 ? 15 : 0) +
        (total > 0 && upcoming.length === 0 ? 15 : 0)
    );

    const overallRiskLevel =
      overallRiskScore >= 60
        ? "high"
        : overallRiskScore >= 25
          ? "moderate"
          : "low";

    const recommendations = [];

    if (totalMissedAndOverdue > 0) {
      recommendations.push({
        priority: "high",
        title: "Recover unfinished study work",
        detail:
          `You have ${missed.length} missed session(s) and ` +
          `${overdue.length} overdue planned session(s). ` +
          (
            upcoming.length === 0
              ? "No future study sessions are scheduled, so choose a recovery slot and rebuild your plan."
              : "Review these before adding more work."
          ),
        action: "open-recovery",
      });
    }

    if (upcoming.length === 0 && subjects.length > 0) {
      recommendations.push({
        priority: "medium",
        title: "Build your next study block",
        detail:
          "You have no future planned sessions. Schedule a realistic next step.",
        action: "open-planner",
      });
    }

    const riskiestSubject = [...subjectInsights].sort(
      (a, b) => b.riskScore - a.riskScore
    )[0];

    if (riskiestSubject && riskiestSubject.riskScore > 0) {
      recommendations.push({
        priority: "medium",
        title: `Review ${riskiestSubject.subjectName}`,
        detail: riskiestSubject.recommendation,
        action: "review-subject",
        subjectId: riskiestSubject.subjectId,
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: "low",
        title: "Keep building your study history",
        detail:
          total === 0
            ? "Add a subject and schedule your first session to start your Academic Twin."
            : "No major scheduling warning was detected from the recorded data. Keep your plan updated.",
        action: "open-planner",
      });
    }

    res.json({
      success: true,
      generatedAt: now.toISOString(),

      model: {
        type: "rules-based-baseline",
        description:
          "Risk indicators are calculated from recorded sessions, statuses, and subject data. They are not exam-score predictions.",
      },

      overview: {
        subjectsTracked: subjects.length,
        sessionsRecorded: total,
        completedSessions: completed.length,
        missedSessions: missed.length,
        overdueSessions: overdue.length,
        upcomingSessions: upcoming.length,
        completionRate,
        completedStudyMinutes: completedMinutes,
        upcomingStudyMinutes: plannedMinutes,
        overallRiskScore,
        overallRiskLevel,
        today,
      },

      subjectInsights,
      recommendations,
    });
  } catch (error) {
    console.error("Academic Twin analysis failed:", error.message);

    res.status(500).json({
      success: false,
      error: "Could not generate Academic Twin analysis.",
    });
  }
});

module.exports = router;
