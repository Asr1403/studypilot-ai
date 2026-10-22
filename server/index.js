
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const {
  connectDatabase,
  getDatabase,
} = require("./database");

const apiRoutes = require("./routes");
const aiRoutes = require("./ai");

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  })
);

app.use(express.json({ limit: "10kb" }));

// Existing application APIs
app.use("/api", apiRoutes);

// Amazon Bedrock AI endpoint: POST /api/ai/chat
app.use("/api/ai", aiRoutes);

// Basic backend health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "StudyPilot AI",
    message: "Backend is running successfully",
    timestamp: new Date().toISOString(),
  });
});

// Verify the MongoDB connection
app.get("/api/db-health", async (req, res) => {
  try {
    const db = getDatabase();
    await db.command({ ping: 1 });

    res.json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Database health check failed:", error.message);

    res.status(503).json({
      status: "error",
      message: "Database is not available",
    });
  }
});

async function startServer() {
  try {
    await connectDatabase();

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
      console.log(
        `StudyPilot AI backend running at http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
