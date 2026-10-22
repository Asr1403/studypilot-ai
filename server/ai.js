
const express = require("express");

const {
  BedrockRuntimeClient,
  ConverseCommand,
} = require("@aws-sdk/client-bedrock-runtime");

const router = express.Router();

const REGION = process.env.AWS_REGION || "us-east-1";
const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID || "amazon.nova-micro-v1:0";

const GROQ_MODEL =
  process.env.GROQ_MODEL || "openai/gpt-oss-20b";

const bedrock = new BedrockRuntimeClient({
  region: REGION,
  maxAttempts: 1,
  retryMode: "standard",
});

const SYSTEM_PROMPT =
  "You are StudyPilot AI, a supportive academic study coach. " +
  "Give clear, practical study advice and short explanations. " +
  "Provide actionable steps when helpful. " +
  "Do not invent a student's grades, schedule, or academic history. " +
  "Ask a brief follow-up if important information is missing. " +
  "Never claim that you changed or saved a study schedule.";

router.post("/chat", async (req, res) => {
  try {
    const question =
      typeof req.body?.message === "string"
        ? req.body.message.trim()
        : "";

    if (!question) {
      return res.status(400).json({
        success: false,
        message: "Please provide a study question.",
      });
    }

    if (question.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Your question must be 1000 characters or fewer.",
      });
    }

    // Prefer Groq when a key is configured.
    // Keep Bedrock available when Groq is not configured.
    if (process.env.GROQ_API_KEY) {
      return await callGroq(question, res);
    }

    return await callBedrock(question, res);
  } catch (error) {
    console.error("StudyPilot AI route failed:", {
      name: error.name,
      message: error.message,
    });

    return res.status(500).json({
      success: false,
      code: "AI_ROUTE_ERROR",
      message: "StudyPilot AI encountered an unexpected error.",
    });
  }
});

async function callGroq(question, res) {
  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: question,
            },
          ],
          max_completion_tokens: 200,
          temperature: 0.3,
          stream: false,
        }),
        signal: AbortSignal.timeout(30000),
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Log status and safe error details, never the API key.
      console.error("Groq request failed:", {
        status: response.status,
        error: result.error?.message || "Unknown Groq API error",
        model: GROQ_MODEL,
      });

      if (response.status === 401 || response.status === 403) {
        return res.status(502).json({
          success: false,
          code: "GROQ_AUTH_ERROR",
          message:
            "Groq authorization failed. Check the API key in server/.env.",
        });
      }

      if (response.status === 429) {
        return res.status(429).json({
          success: false,
          code: "GROQ_RATE_LIMIT",
          message:
            "Groq has reached a rate or usage limit. Check your Groq console.",
        });
      }

      if (response.status === 400 || response.status === 404) {
        return res.status(502).json({
          success: false,
          code: "GROQ_MODEL_ERROR",
          message:
            "Groq rejected the model or request. Check GROQ_MODEL and the API configuration.",
        });
      }

      return res.status(502).json({
        success: false,
        code: "GROQ_REQUEST_FAILED",
        message: "Groq could not complete the AI request.",
      });
    }

    const answer = result.choices?.[0]?.message?.content?.trim();

    if (!answer) {
      return res.status(502).json({
        success: false,
        code: "GROQ_EMPTY_RESPONSE",
        message: "The AI model returned an empty response.",
      });
    }

    return res.status(200).json({
      success: true,
      answer,
      model: result.model || GROQ_MODEL,
      provider: "groq",
      usage: result.usage || null,
    });
  } catch (error) {
    console.error("Groq connection failed:", {
      name: error.name,
      message: error.message,
    });

    return res.status(502).json({
      success: false,
      code: "GROQ_CONNECTION_FAILED",
      message:
        error.name === "TimeoutError"
          ? "Groq took too long to respond. Please try again."
          : "Could not connect to Groq. Check your internet connection and try again.",
    });
  }
}

async function callBedrock(question, res) {
  try {
    const command = new ConverseCommand({
      modelId: BEDROCK_MODEL_ID,
      system: [{ text: SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: [{ text: question }],
        },
      ],
      inferenceConfig: {
        maxTokens: 200,
        temperature: 0.3,
      },
    });

    const result = await bedrock.send(command);

    const answer = (result.output?.message?.content || [])
      .filter((item) => typeof item.text === "string")
      .map((item) => item.text)
      .join("\n")
      .trim();

    if (!answer) {
      return res.status(502).json({
        success: false,
        code: "BEDROCK_EMPTY_RESPONSE",
        message: "The AI model returned an empty response.",
      });
    }

    return res.status(200).json({
      success: true,
      answer,
      model: BEDROCK_MODEL_ID,
      provider: "bedrock",
      usage: result.usage || null,
    });
  } catch (error) {
    console.error("Bedrock request failed:", {
      name: error.name,
      message: error.message,
      httpStatusCode: error.$metadata?.httpStatusCode,
      requestId: error.$metadata?.requestId,
      region: REGION,
      modelId: BEDROCK_MODEL_ID,
    });

    if (
      error.name === "ThrottlingException" ||
      error.name === "TooManyRequestsException"
    ) {
      return res.status(429).json({
        success: false,
        code: "BEDROCK_THROTTLED",
        message:
          "Amazon Bedrock is limiting requests. Check your account quota.",
      });
    }

    if (
      error.name === "AccessDeniedException" ||
      error.name === "UnrecognizedClientException" ||
      error.name === "ExpiredTokenException" ||
      error.name === "InvalidSignatureException"
    ) {
      return res.status(403).json({
        success: false,
        code: "AWS_AUTHORIZATION_ERROR",
        message:
          "AWS authorization failed. Check your AWS login and permissions.",
      });
    }

    return res.status(502).json({
      success: false,
      code: "BEDROCK_REQUEST_FAILED",
      message: "StudyPilot AI could not get a response from Amazon Bedrock.",
    });
  }
}

module.exports = router;
