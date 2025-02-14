"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { useDebouncedCallback } from "use-debounce"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, Loader2, RefreshCcw } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { withRetry } from "@/utils/retry"

interface FactCheckResult {
  text: string
  result: "correct" | "incorrect" | "unverifiable" | "debatable" | "not-applicable"
  explanation: string
  sources: string[]
}

export default function FactChecker() {
  const [inputText, setInputText] = useState("")
  const [factCheckResults, setFactCheckResults] = useState<FactCheckResult[]>([])
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const performFactCheck = useCallback(async (value: string) => {
    return await withRetry(
      async () => {
        const response = await fetch("/api/fact-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to fact-check the text")
        }

        return response.json()
      },
      {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffFactor: 2,
      },
    )
  }, [])

  const debouncedFactCheck = useDebouncedCallback(async (value: string) => {
    if (value.trim() === "") {
      setFactCheckResults([])
      setError(null)
      return
    }

    setIsChecking(true)
    setError(null)

    try {
      const results = await performFactCheck(value)
      console.log("Fact-check results:", results) // Debugging line
      setFactCheckResults(results)
    } catch (error) {
      console.error("Error fact-checking:", error)
      setError(error instanceof Error ? error.message : "An error occurred while fact-checking")
      setFactCheckResults([])
    } finally {
      setIsChecking(false)
    }
  }, 1000)

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value
    setInputText(newText)
    debouncedFactCheck(newText)
  }

  const handleRetry = () => {
    if (inputText.trim()) {
      debouncedFactCheck(inputText)
    }
  }

  const getResultColor = (result: FactCheckResult["result"]) => {
    switch (result) {
      case "correct":
        return "bg-green-200 dark:bg-green-800"
      case "incorrect":
        return "bg-red-200 dark:bg-red-800"
      case "unverifiable":
        return "bg-yellow-200 dark:bg-yellow-800"
      case "debatable":
        return "bg-purple-200 dark:bg-purple-800"
      default:
        return "bg-gray-200 dark:bg-gray-800"
    }
  }

  const renderFactCheckedText = () => {
    if (factCheckResults.length === 0) {
      return <p className="text-muted-foreground">No fact-checkable statements found.</p>
    }

    let lastIndex = 0
    const elements: React.ReactNode[] = []

    factCheckResults.forEach((result, index) => {
      const startIndex = inputText.indexOf(result.text, lastIndex)
      if (startIndex > lastIndex) {
        elements.push(<span key={`text-${index}`}>{inputText.slice(lastIndex, startIndex)}</span>)
      }
      elements.push(
        <TooltipProvider key={`tooltip-${index}`}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className={`cursor-help px-1 rounded ${getResultColor(result.result)}`}>{result.text}</span>
            </TooltipTrigger>
            <TooltipContent>
              <FactCheckTooltip result={result} />
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      )
      lastIndex = startIndex + result.text.length
    })

    if (lastIndex < inputText.length) {
      elements.push(<span key="text-last">{inputText.slice(lastIndex)}</span>)
    }

    return <div className="whitespace-pre-wrap break-words">{elements}</div>
  }

  return (
    <div className="space-y-4">
      <Textarea
        placeholder="Enter text to fact-check..."
        value={inputText}
        onChange={handleTextChange}
        className="min-h-[200px] resize-none"
      />
      {isChecking && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Fact-checking in progress...
        </div>
      )}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center gap-4">
            {error}
            <Button variant="outline" size="sm" onClick={handleRetry} className="ml-auto" disabled={isChecking}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
      <div className="border rounded-md p-4 bg-white dark:bg-gray-800">
        <h2 className="text-lg font-semibold mb-2">Fact-Checked Text</h2>
        {renderFactCheckedText()}
      </div>
    </div>
  )
}

function FactCheckTooltip({ result }: { result: FactCheckResult }) {
  return (
    <div className="max-w-xs">
      <p className="font-semibold mb-1">
        {result.result === "correct" && "Correct"}
        {result.result === "incorrect" && "Incorrect"}
        {result.result === "unverifiable" && "Unverifiable"}
        {result.result === "debatable" && "Debatable"}
        {result.result === "not-applicable" && "Not Applicable"}
      </p>
      <p className="text-sm mb-2">{result.explanation}</p>
      {result.sources.length > 0 && (
        <div>
          <p className="text-xs font-semibold mb-1">Sources:</p>
          <ul className="text-xs list-disc list-inside">
            {result.sources.map((source, index) => (
              <li key={index}>
                <a href={source} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                  {new URL(source).hostname}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}