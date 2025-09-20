import axios from "axios";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export interface GeminiAnalysisRequest {
  dataset: any[];
  prompt?: string;
}

export interface GeminiAnalysisResponse {
  features: Array<{
    canonical: string;
    evidence_ids: string[];
  }>;
  complaints: Array<{
    canonical: string;
    evidence_ids: string[];
  }>;
  leads: Array<{
    username: string;
    platform: string;
    excerpt: string;
    reason: string;
  }>;
}

export interface GeminiTextRequest {
  text: string;
  prompt?: string;
}

export interface GeminiTextResponse {
  text: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Analyzes social media data using Gemini AI for competitor research
 * @param request - The analysis request containing dataset and optional custom prompt
 * @returns Promise<GeminiAnalysisResponse> - Structured analysis results
 */
export async function analyzeCompetitorData(request: GeminiAnalysisRequest): Promise<GeminiAnalysisResponse> {
  if (!GEMINI_API_KEY) {
    console.log(GEMINI_API_KEY);
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const defaultPrompt = `You are an analysis engine for competitor research.
Your job is to analyze social media posts and comments about competitors and extract ONLY structured insights.
STRICTLY follow these rules:

### 🎯 Categories
Classify extracted information into THREE categories only:
1. **features** → competitor feature announcements, launches, new capabilities.
2. **complaints** → user pain points, frustrations, bugs, missing features, poor service.
3. **leads** → posts/comments that show switching intent (looking for alternatives, leaving competitor, asking what else to use).

### 📋 Output Schema
You must return a single JSON object in this exact shape:
{
  "features": [
    { "canonical": string, "evidence_ids": [string] }
  ],
  "complaints": [
    { "canonical": string, "evidence_ids": [string] }
  ],
  "leads": [
    { "username": string, "platform": string, "excerpt": string, "reason": string }
  ]
}

### 🔒 Hard Rules
- NO prose, NO markdown, NO explanations — ONLY the JSON object.
- Maximum 5 items per section.
- Use evidence_ids from the provided post_id or comment_id fields (never invent).
- Canonical text should be short, generalizable phrases (e.g., "Shadowbans on creators" not "user123 says they are shadowbanned today").
- If a category has no items, return an empty array [].
- Do not hallucinate data or invent user intent — extract only what is present.

### 📦 Dataset
Analyze the following dataset of competitor posts and comments:`;

  const prompt = request.prompt || defaultPrompt;
  const datasetMinified = JSON.stringify(request.dataset);
  console.log(datasetMinified);


 //json ko theek karneka hai
  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { text: datasetMinified }
        ]
      }
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.1,
      maxOutputTokens: 2048
    }
  };

  try {
  const response = await axios.post(GEMINI_API_URL,
    body,
    {
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
      }
    }
  );

    if (!response.data) {
      const errorText = await response.data.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    if (!response.data.candidates || !response.data.candidates[0] || !response.data.candidates[0].content) {
      throw new Error("Invalid response format from Gemini API");
    }

    const content = response.data.candidates[0].content.parts[0].text; // Removed `.json()` call
    const parsedContent = JSON.parse(content) as GeminiAnalysisResponse;

    return parsedContent;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse Gemini response: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Generates text using Gemini AI
 * @param request - The text generation request
 * @returns Promise<GeminiTextResponse> - Generated text response
 */
export async function generateText(request: GeminiTextRequest): Promise<GeminiTextResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const prompt = request.prompt || "Please provide a helpful response to the following:";
  const fullPrompt = `${prompt}\n\n${request.text}`;

  const body = {
    contents: [
      {
        parts: [
          { text: fullPrompt }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024
    }
  };

  try {
    const response = await axios.post(GEMINI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY
      },
      body: JSON.stringify(body)
    });

    if (!response.data.ok) {
      const errorText = await response.data.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    if (!response.data.candidates || !response.data.candidates[0] || !response.data.candidates[0].content) {
      throw new Error("Invalid response format from Gemini API");
    }

    const generatedText = response.data.candidates[0].content.parts[0].text; // Removed `.json()` call
    const usage = response.data.usageMetadata ? {
      prompt_tokens: response.data.usageMetadata.promptTokenCount || 0,
      completion_tokens: response.data.usageMetadata.candidatesTokenCount || 0,
      total_tokens: response.data.usageMetadata.totalTokenCount || 0
    } : undefined;

    return {
      text: generatedText,
      usage
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse Gemini response: ${error.message}`);
    }
    throw error;
  }
}
