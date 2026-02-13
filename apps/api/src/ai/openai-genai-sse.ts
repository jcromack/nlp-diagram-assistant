import OpenAI from "openai"
import { ChatMessage } from "./provider"

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function* streamGenAIExplanation(
  messages: ChatMessage[],
  diagram?: string
): AsyncGenerator<string> {

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    stream: true,
    messages: [
      {
        role: "system",
        content: `
        You are an AI diagram assistant.
        
        Generate ONE short action-style sentence describing what is being built.
        
        Rules:
        - Under 15 words.
        - Present tense.
        - Start with a strong verb (Building, Creating, Mapping, Designing, Constructing).
        - Do NOT start with "The diagram".
        - Do NOT describe steps.
        - Do NOT mention nodes, arrows, or edges.
        - No Mermaid code.
        - Single sentence only.
        
        Output only the sentence.
        `.trim()
      },
      {
        role: "user",
        content: `Current diagram:\n${diagram ?? "(none)"}`
      },
      ...messages
    ]
  })

  for await (const chunk of completion) {
    const token = chunk.choices?.[0]?.delta?.content
    if (!token) continue
    yield token
  }
}

export async function generateFinalDiagram(
  messages: ChatMessage[],
  diagram?: string
): Promise<string> {

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: [
      {
        role: "system",
        content: `
          You are an AI diagram editor.

          Return ONLY the full Mermaid diagram.
          Rules:
          - Must start with: flowchart TD
          - Node ids A-Z single letters
          - No explanation
          - No code fences
        `.trim()
      },
      {
        role: "user",
        content: `Current diagram:\n${diagram ?? "(none)"}`
      },
      ...messages
    ]
  })

  const raw = completion.choices[0].message?.content ?? ""
  return normalizeMermaid(raw)
}

function normalizeMermaid(code: string): string {
  const cleaned = (code ?? "").trim()
  if (!cleaned) return ""
  if (!/^flowchart\s+TD\b/.test(cleaned)) {
    return `flowchart TD\n${cleaned}`
  }
  return cleaned
}