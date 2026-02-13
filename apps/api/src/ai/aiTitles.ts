import OpenAI from "openai"

function getClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  })
}

export async function generateChatTitle(
  firstUserMessage: string,
  firstAssistantMessage: string
) {

  const openai = getClient()

  if (!openai) {
    return "New Chat"
  }
  
  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    max_completion_tokens: 20,
    messages: [
      {
        role: "system",
        content:
          "Generate a concise 3-5 word chat title summarizing this diagram request. No punctuation."
      },
      {
        role: "user",
        content: `
User:
${firstUserMessage}

Assistant:
${firstAssistantMessage}
        `.trim()
      }
    ]
  })

  return completion.choices[0].message?.content?.trim() || "Untitled Chat"
}