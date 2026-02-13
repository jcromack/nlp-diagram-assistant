import OpenAI from "openai"
import { Command } from "./commands"
import { ChatMessage } from "./provider"

const openai = new OpenAI({
   apiKey: process.env.OPENAI_API_KEY
})



function extractLabels(diagram?: string): string[] {
    if (!diagram) return []
    return [...diagram.matchAll(/\[(.+?)\]/g)].map(m => m[1])
  }


export type AIResult = {
    command: Command
    message: string
  }
  
  export async function aiInterpret(
    messages: ChatMessage[],
    diagram?: string
  ): Promise<AIResult> {
    const labels = extractLabels(diagram)
    console.log("🧠 AI INPUT")
    console.log("Labels:", labels)
    console.log(
      "Messages:",
      messages.map(m => `${m.role}: ${m.content}`)
    )
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `
          You are a chat assistant for a diagram editor.
          
          Current diagram node labels:
          ${labels.length ? labels.join(", ") : "none"}
          
          Interpretation rules (in priority order):
          1) If the user says "remove all" / "clear everything" / "reset diagram":
             command = { "type": "remove_all" }
          
          2) If the user's latest message contains add intent (e.g. "add", "another", "and one called", "one called", "append"):
             command = { "type": "add", "label": <new label>, "after": <optional closest existing label if mentioned> }
          
          3) Only emit "create" when BOTH are true:
             - The immediately previous assistant message explicitly asked the user to provide 3 labels to create a new diagram, AND
             - The user provides a list of 3 or more labels (comma/and separated).
             Then: command = { "type": "create", "labels": [...] }
          
          4) If the user refers to an existing step/node, map it to the closest label (case-insensitive).
             Do NOT ask for clarification if a reasonable match exists.
          
          Remove rules (when not remove_all):
          - command = { "type": "remove", "target": <closest matching label> }
          
          Output rules:
          - Do NOT generate Mermaid.
          - Return ONLY valid JSON in this exact shape (no extra keys):
                {
                "message": string,
                "command": {
                    "type": "create" | "add" | "remove" | "remove_all" | "undo" | "unknown",
                    "label"?: string,
                    "after"?: string,
                    "target"?: string,
                    "labels"?: string[]
                }
                }

                Message rules:
                - "message" MUST be non-empty.
                - Keep it under 12 words.
                - It must describe the action, e.g.:
                - create: "Created a diagram: start → middle → end."
                - add: "Added \"final\" after \"end\"."
                - remove: "Removed \"middle\"."
                - remove_all: "Cleared the diagram."
                - undo: "Undid the last change."
                - unknown: "I didn’t understand that request."
          }
          `.trim()
        },
        ...messages.map(m => ({
          role: m.role,
          content: m.content
        }))
      ]
    })
  
    try {
        const raw = completion.choices[0].message?.content
    console.log("AI OUTPUT:", raw)
      return JSON.parse(
        completion.choices[0].message?.content ?? "{}"
      ) as AIResult
    } catch {
      return {
        message: "I didn’t understand that request.",
        command: { type: "unknown" }
      }
    }
  }