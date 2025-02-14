import FactChecker from "@/components/fact-checker"

export default function Home() {
  return (
    <main className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-6">Fact Checker</h1>
      <p className="text-sm text-gray-500 mb-2">
        Don&apos;t trust anything the media tells you. Fact-check it yourself.
      </p>
      <p className="text-sm text-gray-500 mb-2">Cutoff: October 2023</p>
      <p className="text-sm text-gray-500 mb-4">
        Disclaimer: This is not a professional fact-checking service. It is a
        proof-of-concept for a fact-checking tool that uses AI to check the
        accuracy of statements made in the media.
      </p>
      <FactChecker />
    </main>
  )
}