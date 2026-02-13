import { applyCommand } from "./diagram"
import { parseCommand, Command } from "./commands"

export type ChatMessage = {
    role: "user" | "assistant"
    content: string
  }
  
  export type ChatResponse = {
    message: string
    diagram?: string
  }

function messageFor(command: Command): string {
  switch (command.type) {
    case "create":
      return "Created a new diagram."
    case "add":
      return `Added "${command.label}" to the diagram.`
    case "add_multiple":
      return `Added ${command.labels.length} steps to the diagram.`
    case "remove":
      return `Removed "${command.target}".`
    case "remove_all":
      return "Cleared the diagram."
    case "undo":
      return "Undid the last change."
    default:
      return "I didn’t understand that request."
  }
}


export async function respondCommand(
  messages: ChatMessage[],
  currentDiagram?: string | null
): Promise<ChatResponse> {

  const input = [...messages]
    .reverse()
    .find(m => m.role === "user")
    ?.content

  if (!input) {
    return { message: "No input received.", diagram: currentDiagram ?? undefined }
  }

  const command = parseCommand(input)

  if (command.type === "unknown") {
    return {
      message: "I didn’t understand that request.",
      diagram: currentDiagram ?? undefined
    }
  }

  if (command.type === "remove_all") {
    return {
      message: "Cleared the diagram.",
      diagram: undefined
    }
  }

  const before = currentDiagram ?? undefined
  const after = applyCommand(before, command)

  if (command.type === "remove" && !after) {
    return {
      message: `Step "${command.target}" not found.`,
      diagram: before
    }
  }

  if (after === before) {
    if (command.type === "remove") {
      return {
        message: `I dont understand the request please tell me what you would like to remove`,
        diagram: before
      }
    }

    if (command.type === "add") {
      return {
        message: `Could not add "${command.label}".`,
        diagram: before
      }
    }
  }

  return {
    message: messageFor(command),
    diagram: after ?? before
  }
}