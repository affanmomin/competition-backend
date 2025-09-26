import axios from "axios";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

export interface GeminiAnalysisRequest {
  dataset: any[];
}

export interface GeminiAnalysisResponse {
  features: Array<{
    canonical: string;
    evidence_ids: string[];
    feature_type?: string;
    impact_level?: string;
    confidence_score?: number;
  }>;
  complaints: Array<{
    canonical: string;
    evidence_ids: string[];
    category?: string;
    severity?: string;
    sentiment_score?: number;
    confidence_score?: number;
  }>;
  leads: Array<{
    username: string;
    platform: string;
    excerpt: string;
    reason: string;
    lead_type?: string;
    urgency?: string;
    confidence_score?: number;
  }>;
  alternatives: Array<{
    name: string;
    evidence_ids: string[];
    platform: string;
    mention_context?: string;
    confidence_score?: number;
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

export interface GeminiWebpageRequest {
  dataset: any[];
  companyName?: string;
}

/**
 * Analyzes social media data using Gemini AI for competitor research
 * @param request - The analysis request containing dataset and optional custom prompt
 * @returns Promise<GeminiAnalysisResponse> - Structured analysis results
 */
export async function analyzeCompetitorData(
  request: GeminiAnalysisRequest,
): Promise<GeminiAnalysisResponse> {
  if (!GEMINI_API_KEY) {
    console.log(GEMINI_API_KEY);
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const defaultPrompt = `# You are a precision analysis engine for competitor research. Your task is to extract ONLY high-value, structured insights from social media posts with maximum efficiency.

  IMPORTANT: Return ONLY valid JSON. Do not include any markdown formatting, code blocks, or explanatory text. The response must be a valid JSON object that can be parsed directly.


## 🎯 Analysis Categories (Extract ONLY these 4)

### 1. **FEATURES** 
Product announcements, launches, updates, new capabilities, integrations, or deprecations.

### 2. **COMPLAINTS**
User pain points, bugs, service issues, missing features, pricing concerns, or performance problems.

### 3. **LEADS** 
Clear switching intent: Users expressing frustration, dissatisfaction, or actively seeking alternatives to the competitor.

### 4. **ALTERNATIVES**
Clear switching intent: direct mentions of possible competitor alternatives, recommendations, comparisons, or substitute products/services being suggested.

## 📋 Required JSON Output Schema

\`\`\`json
{
  "features": [
    {
      "canonical": "string (max 60 chars)",
      "evidence_ids": ["string"],
      "feature_type": "new|update|integration|beta|deprecated",
      "impact_level": "minor|major|breaking",
      "confidence_score": 0.0-1.0
    }
  ],
  "complaints": [
    {
      "canonical": "string (max 60 chars)", 
      "evidence_ids": ["string"],
      "category": "performance|ui_ux|pricing|support|features|bugs|other",
      "severity": "low|medium|high|critical",
      "sentiment_score": -1.0 to 1.0,
      "confidence_score": 0.0-1.0
    }
  ],
  "leads": [
    {
      "username": "string",
      "platform": "string", 
      "excerpt": "string (max 200 chars)",
      "reason": "string (max 100 chars)",
      "lead_type": "switching|evaluating|dissatisfied|researching",
      "urgency": "low|medium|high|immediate",
      "confidence_score": 0.0-1.0
    }
  ],
  "alternatives": [
    {
      "name": "string (max 50 chars)",
      "evidence_ids": ["string"],
      "platform": "string",
      "mention_context": "recommendation|comparison|replacement|evaluation",
      "confidence_score": 0.0-1.0
    }
  ]
}
\`\`\`

## 🚨 CRITICAL ANTI-HALLUCINATION RULES

**ZERO TOLERANCE FOR FABRICATION:**
- **NEVER** create or invent evidence_ids that don't exist in the dataset
- **NEVER** extract insights from posts that weren't provided in the dataset  
- **NEVER** combine information from multiple posts into a single insight
- **NEVER** assume or infer information not explicitly stated in the text
- **NEVER** create usernames, platforms, or excerpts that don't exist in the source data

**STRICT DATA VALIDATION:**
- Every \`evidence_id\` MUST correspond to an actual \`post_id\` or \`comment_id\` from the dataset
- Every \`username\` MUST be copied exactly from the source post (no modifications)
- Every \`platform\` MUST match the platform specified in the source data
- Every \`excerpt\` MUST be a direct quote from the original post (max 200 chars)
- All \`canonical\` text MUST be derived only from content actually present in the posts

**VERIFICATION REQUIREMENTS:**
- Before adding any insight, verify the evidence_id exists in the provided dataset
- Before extracting any feature, verify it's explicitly mentioned as a product update/launch
- Before classifying a complaint, verify the user actually expressed dissatisfaction
- Before identifying a lead, verify clear switching intent is stated in the text
- Before listing an alternative, verify a specific product/service name is mentioned

**CONFIDENCE SCORING INTEGRITY:**
- Set confidence_score < 0.6 if ANY doubt exists about the classification
- Set confidence_score = 0.0 if you cannot find direct evidence in the text
- **DO NOT** boost confidence scores to meet the 0.6 threshold requirement
- **EXCLUDE** any insight with confidence_score < 0.6 from the final output

## 🔒 Strict Processing Rules

**EFFICIENCY FIRST:**
- Process posts in order of relevance (complaints > leads > alternatives > features)
- Stop processing if you hit 5 items in each category
- Skip obvious spam, promotional, or irrelevant content
- Only extract insights with confidence_score ≥ 0.6

**QUALITY CONTROLS:**
- \`canonical\` text must be generalizable, not user-specific
- \`evidence_ids\` must match exactly from dataset (never fabricate)
- \`confidence_score\` reflects certainty of classification (0.6-1.0 range)
- \`sentiment_score\` only for complaints (-1.0 negative to 1.0 positive)

**OUTPUT CONSTRAINTS:**
- Return ONLY the JSON object (no explanations, markdown, or prose)
- Maximum 5 items per category (features, complaints, leads, alternatives)
- Empty arrays \`[]\` if no valid items found
- All text fields must be concise and actionable

**DATASET FIDELITY:**
- **ONLY** analyze posts and comments provided in the dataset section
- **NEVER** reference external knowledge about companies or products
- **NEVER** make assumptions about what users "probably meant"
- **IF UNSURE** about any classification, exclude it rather than guess

## 🚨 Cost Optimization Instructions

- **IGNORE** duplicate or near-duplicate insights across all categories
- **PRIORITIZE** high-impact items (critical complaints, major features, immediate leads, frequently mentioned alternatives)
- **SKIP** vague posts without clear actionable insights
- **CONSOLIDATE** similar items under one canonical phrase
- **ALTERNATIVES**: Focus on specific product names, not generic terms like "other tools"
- **ABORT PROCESSING** any post that lacks clear evidence for categorization

## 📦 Dataset Analysis

Process the following competitor posts and comments:`;

  const prompt = defaultPrompt;
  const datasetMinified = JSON.stringify(request.dataset);
  console.log(datasetMinified);

  //json ko theek karneka hai
  const body = {
    contents: [
      {
        parts: [{ text: prompt }, { text: datasetMinified }],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  };

  try {
    const response = await axios.post(GEMINI_API_URL, body, {
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY,
      },
    });

    if (!response.data) {
      const errorText = await response.data.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    if (
      !response.data.candidates ||
      !response.data.candidates[0] ||
      !response.data.candidates[0].content
    ) {
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
 * Analyzes website content data using Gemini AI for competitor research
 * @param request - The analysis request containing website dataset and optional company name
 * @returns Promise<GeminiAnalysisResponse> - Structured analysis results from website content
 */
export async function analyzeWebpageData(
  request: GeminiWebpageRequest,
): Promise<GeminiAnalysisResponse> {
  if (!GEMINI_API_KEY) {
    console.log(GEMINI_API_KEY);
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const defaultPrompt = `# You are a precision analysis engine for competitor landing pages. Your task is to extract ONLY high-value, structured insights from the provided marketing text.

IMPORTANT: Return ONLY valid JSON. Do not include any markdown formatting, code blocks, or explanatory text. The response must be a valid JSON object that can be parsed directly.

## 🎯 Analysis Categories (Landing Page Mode)

### 1. **FEATURES**
- Extract every explicit product capability, functionality, or offering mentioned in the text.
- Include product tiers, pricing details, integrations, AI features, automation, analytics, onboarding, and team/individual use cases.
- Each feature must be listed separately (don’t merge multiple into one).
- Do not infer — extract only what is explicitly stated.

### 2. **COMPLAINTS**
- Rare in landing pages, but if the text explicitly mentions disclaimers, limitations, or weaknesses, capture them.
- If none exist, return an empty array.

### 3. **LEADS & ALTERNATIVES**
- Not applicable for landing page text.
- Always return empty arrays.

## 📋 Required JSON Output Schema

{
  "features": [
    {
      "canonical": "string (max 60 chars)",
      "evidence_ids": ["string"],
      "feature_type": "core|integration|plan|pricing|automation|ai|analytics|onboarding|team",
      "impact_level": "minor|major|breaking",
      "confidence_score": 0.0-1.0
    }
  ],
  "complaints": [
    {
      "canonical": "string (max 60 chars)", 
      "evidence_ids": ["string"],
      "category": "performance|ui_ux|pricing|support|features|bugs|limitations|other",
      "severity": "low|medium|high|critical",
      "sentiment_score": -1.0 to 1.0,
      "confidence_score": 0.0-1.0
    }
  ],
  "leads": [],
  "alternatives": []
}

## 🚨 CRITICAL ANTI-HALLUCINATION RULES

- **Evidence IDs:** Must reference actual section IDs, bullet numbers, or headers from the landing page dataset (e.g., "section_2", "faq_q1").  
- **Zero fabrication:** Only extract features that are explicitly present in the text.  
- **No assumptions:** Don’t assume missing integrations, pricing, or competitors.  
- **Confidence scoring:** Exclude any item with confidence_score < 0.6.  
- **Granularity:** Split features into atomic items (e.g., “AI content generation” separate from “Google Sheets integration”).  

## 🔒 Strict Processing Rules

- Extract up to 20 features maximum (stop after 20 if more exist).  
- Do not merge unrelated items into one feature.  
- Use concise, generalizable canonical names.  
- If no complaints are found, return "complaints": [].  

## 📦 Dataset Analysis

Process the following competitor landing page text:
`;

  const prompt = defaultPrompt;
  const datasetMinified = JSON.stringify(request.dataset);
  console.log("Website dataset for analysis:", datasetMinified);

  const body = {
    contents: [
      {
        parts: [{ text: prompt }, { text: datasetMinified }],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  };

  try {
    const response = await axios.post(GEMINI_API_URL, body, {
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY,
      },
    });

    if (!response.data) {
      const errorText = await response.data.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    if (
      !response.data.candidates ||
      !response.data.candidates[0] ||
      !response.data.candidates[0].content
    ) {
      throw new Error("Invalid response format from Gemini API");
    }

    const content = response.data.candidates[0].content.parts[0].text;
    const parsedContent = JSON.parse(content) as GeminiAnalysisResponse;

    return parsedContent;
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(
        `Failed to parse Gemini response for website analysis: ${error.message}`,
      );
    }
    throw error;
  }
}

/**
 * Generates text using Gemini AI
 * @param request - The text generation request
 * @returns Promise<GeminiTextResponse> - Generated text response
 */
export async function generateText(
  request: GeminiTextRequest,
): Promise<GeminiTextResponse> {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }

  const prompt =
    request.prompt || "Please provide a helpful response to the following:";
  const fullPrompt = `${prompt}\n\n${request.text}`;

  const body = {
    contents: [
      {
        parts: [{ text: fullPrompt }],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
  };

  try {
    const response = await axios.post(GEMINI_API_URL, body, {
      headers: {
        "Content-Type": "application/json",
        "X-goog-api-key": GEMINI_API_KEY,
      },
    });

    if (!response.data) {
      const errorText = await response.data.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    if (
      !response.data.candidates ||
      !response.data.candidates[0] ||
      !response.data.candidates[0].content
    ) {
      throw new Error("Invalid response format from Gemini API");
    }

    const generatedText = response.data.candidates[0].content.parts[0].text;
    const usage = response.data.usageMetadata
      ? {
          prompt_tokens: response.data.usageMetadata.promptTokenCount || 0,
          completion_tokens:
            response.data.usageMetadata.candidatesTokenCount || 0,
          total_tokens: response.data.usageMetadata.totalTokenCount || 0,
        }
      : undefined;

    return {
      text: generatedText,
      usage,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Failed to parse Gemini response: ${error.message}`);
    }
    throw error;
  }
}
