# StudyPilot AI

StudyPilot AI is an AI-powered study planning and academic productivity web application designed to help students organize their subjects, plan study sessions, prepare for exams, and recover missed sessions.

## Features

- Subject management with persistent storage
- Study session planning and tracking
- AI-assisted study coaching
- Voice input and read-aloud support
- Exam preparation tools
- Academic Twin study insights
- Missed-session recovery support

## Technology Stack

- **Frontend:** React and Vite
- **Backend:** Node.js and Express
- **Database:** MongoDB Atlas
- **AI:** AI provider integration, depending on configured credentials and available quota
- **Voice:** Browser speech recognition and speech synthesis

## Project Structure

- `client/` — React frontend
- `server/` — Express backend and API routes

## Prerequisites

- Node.js and npm
- MongoDB Atlas or another configured MongoDB connection
- Valid credentials and available quota for the configured AI provider

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/Asr1403/studypilot-ai.git
cd studypilot-ai
```

### 2. Install and run the backend

```bash
cd server
npm install
npm run dev
```

Configure the required environment variables in `server/.env` before starting the backend. Use the variable names expected by the server code. Never publish API keys, database credentials, or AWS credentials.

### 3. Install and run the frontend

Open a second terminal:

```bash
cd client
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

## Notes

AI functionality depends on the configured provider, credentials, network access, and available quota. Voice features depend on browser and operating-system support.

## License

See the `LICENSE` file for licensing information.
