import { NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { Cache } from "@/utils/cache"
import { withRetry } from "@/utils/retry"

// Initialize cache with 1-hour TTL
const factCheckCache = new Cache<FactCheckResult[]>(60)

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000 // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10
const requestLog = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const requests = requestLog.get(ip) || []
  const recentRequests = requests.filter((time) => time > now - RATE_LIMIT_WINDOW)
  requestLog.set(ip, recentRequests)
  return recentRequests.length >= MAX_REQUESTS_PER_WINDOW
}

interface FactCheckResult {
  text: string
  result: "correct" | "incorrect" | "unverifiable" | "debatable" | "not-applicable"
  explanation: string
  sources: string[]
}

function isValidFactCheckResult(obj: FactCheckResult): obj is FactCheckResult {
  return (
    typeof obj === "object" &&
    typeof obj.text === "string" &&
    ["correct", "incorrect", "unverifiable", "debatable", "not-applicable"].includes(obj.result) &&
    typeof obj.explanation === "string" &&
    Array.isArray(obj.sources) &&
    obj.sources.every((source: string) => typeof source === "string")
  )
}

async function performFactCheck(text: string): Promise<FactCheckResult[]> {
  return await withRetry(
    async () => {
      const { text: factCheckResult } = await generateText({
        model: openai("gpt-4o"),
        prompt: `Fact-check the following text: "${text}"
        Provide a JSON array of objects, where each object represents a fact-check for a specific clause or statement in the text.
        Each object MUST have the following properties:
        - text: the specific clause or statement being fact-checked (can be multiple words or a full sentence)
        - result: MUST be one of "correct", "incorrect", "unverifiable", "debatable", or "not-applicable"
        - explanation: a detailed explanation of the fact-check result, including specific numbers or data when relevant
        - sources: an array of full, clickable URLs to reputable sources used for fact-checking (if applicable)
        
        For statements that are correct or incorrect, provide detailed information and context.
        For statements that are up for debate or a matter of opinion, use the "debatable" result.
        For opinions, subjective statements, or personal experiences, use "not-applicable".
        If there are no fact-checkable statements, return an empty array.
        Ensure that the 'text' field contains the exact wording from the original text for accurate highlighting.
        
        Your response MUST be a valid JSON array, even if it's empty. Do not include any text outside of the JSON array.`,
        temperature: 0.2,
        maxTokens: 1500,
      })

      console.log("Raw AI response:", factCheckResult) // Debugging line

      try {
        const jsonMatch = factCheckResult.match(/\[[\s\S]*\]/);
        const parsedJson = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
        if (!Array.isArray(parsedJson)) {
          throw new Error("Expected an array of fact-check results")
        }
        const validatedResults = parsedJson.filter(isValidFactCheckResult)
        if (validatedResults.length === 0 && parsedJson.length > 0) {
          throw new Error("No valid fact-check results found in the response")
        }
        return validatedResults
      } catch (error) {
        console.error("Error parsing AI response:", error)
        throw new Error(`Failed to parse fact-check results: ${factCheckResult}`)
      }
    },
    {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffFactor: 2,
    },
  )
}

export async function POST(req: Request) {
  try {
    // Basic rate limiting
    const ip = req.headers.get("x-forwarded-for") || "unknown"
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 })
    }

    // Log the request
    const requests = requestLog.get(ip) || []
    requests.push(Date.now())
    requestLog.set(ip, requests)

    const { text } = await req.json()

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Invalid input. Please provide a text to fact-check." }, { status: 400 })
    }

    // Check cache first
    const cachedResult = factCheckCache.get(text)

    if (cachedResult) {
      return NextResponse.json(cachedResult)
    }

    // Perform fact-check with retry logic
    const result = await performFactCheck(text)

    // Cache the result
    factCheckCache.set(text, result)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in fact-checking:", error)
    return NextResponse.json(
      {
        error: "An error occurred during fact-checking.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

