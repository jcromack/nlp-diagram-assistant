import { ChatMessage } from "./provider"
import { streamGenAIExplanation, generateFinalDiagram } from "./openai-genai-sse"

export async function* respondGenAISSE(
  messages: ChatMessage[],
  currentDiagram?: string | null
) {
  for await (const token of streamGenAIExplanation(messages, currentDiagram ?? undefined)) {
    yield { token }
  }

  const finalDiagram = await generateFinalDiagram(messages, currentDiagram ?? undefined)

  yield { diagram: finalDiagram }
}