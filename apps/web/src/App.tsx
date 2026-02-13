import { useEffect, useState } from "react"
import axios from "axios"
import { Diagram } from "./Diagram"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}


type Chat = {
  id: string
  title: string
  mode: "command" | "genai_sse"
  diagram?: string | null
  messages: ChatMessage[]
}

function ModeButton({
  active,
  disabled,
  onClick,
  children
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md px-3 py-2 text-sm font-medium transition ${
        disabled
          ? active
            ? "border border-slate-300 bg-white text-slate-900 shadow-sm"
            : "border border-transparent bg-slate-100 text-slate-400"
          : active
          ? "border border-slate-300 bg-white text-slate-900 shadow-sm"
          : "border border-transparent bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  )
}

export default function App() {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [diagram, setDiagram] = useState("")
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [diagramLoading, setDiagramLoading] = useState(false)

  const [mode, setMode] = useState<"command" | "genai_sse">("command")
  const [modeLocked, setModeLocked] = useState(false)

  useEffect(() => {
    fetchChats()
  }, [])

  async function fetchChats() {
    const { data } = await axios.get<Chat[]>("/chats")
    setChats(data)
  }

  async function loadChat(id: string) {
    const { data } = await axios.get<Chat>(`/chats/${id}`)
    setActiveChatId(id)
    setMessages(data.messages || [])
    setDiagram(data.diagram ?? "")
    setMode(data.mode)
    setModeLocked(true)
  }

  async function deleteChat(id: string) {
    await axios.delete(`/chats/${id}`)

    if (activeChatId === id) {
      setActiveChatId(null)
      setMessages([])
      setDiagram("")
      setModeLocked(false)
    }

    setChats(prev => prev.filter(c => c.id !== id))
  }

  async function sendMessage() {
    if (!input.trim() || sending) return

    const content = input
    setInput("")
    setSending(true)

    let chatId = activeChatId

    try {
      if (!chatId) {
        const { data } = await axios.post<Chat>("/chats", { mode })
        chatId = data.id
        setActiveChatId(chatId)
        await fetchChats()
      }

      if (!chatId) return

      const userMessage: ChatMessage = { role: "user", content }
      setMessages(prev => [...prev, userMessage])

      if (!modeLocked) setModeLocked(true)

      if (mode === "command") {
        const { data } = await axios.post(`/chats/${chatId}/messages`, {
          content
        })
      
        await fetchChats()
      
        setMessages(prev => [
          ...prev,
          { role: "assistant", content: data.message }
        ])
      
        setDiagram(data.diagram ?? "")
        return
      }

      if (mode === "genai_sse") {
        setDiagramLoading(true)

        const response = await fetch(`/chats/${chatId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content })
        })

        const reader = response.body?.getReader()
        const decoder = new TextDecoder("utf-8")

        if (!reader) return

        let assistantMessage = ""

        setMessages(prev => [
          ...prev,
          { role: "assistant", content: "" }
        ])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split("\n\n").filter(Boolean)

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue

            const json = JSON.parse(line.replace("data: ", ""))

            if (json.token) {
              assistantMessage += json.token

              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantMessage
                }
                return updated
              })
            }

            if (json.diagram) {
              setDiagram(json.diagram)
              setDiagramLoading(false)
            }

            if (json.done) {
              await fetchChats()
            }
          }
        }
      }
    } finally {
      setSending(false)
    }
  }

  function newChat() {
    setActiveChatId(null)
    setMessages([])
    setDiagram("")
    setModeLocked(false)
  }

  return (
    <div className="min-h-screen bg-slate-100 p-8">
      <div className="grid min-h-[90vh] grid-cols-12 gap-4">

        <aside className="col-span-3 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <h2 className="text-sm font-semibold">Chats</h2>
            <button
              onClick={newChat}
              className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              New Chat
            </button>
          </div>

          <div className="flex-1 overflow-auto p-2 space-y-1">
            {chats.map(chat => (
              <div
                key={chat.id}
                onClick={() => loadChat(chat.id)}
                className={`group flex cursor-pointer items-center justify-between rounded-md px-2 py-2 text-sm transition ${
                  activeChatId === chat.id
                    ? "bg-slate-200"
                    : "hover:bg-slate-100"
                }`}
              >
                <span className="flex-1 truncate">
                  {chat.title || "Untitled Chat"}
                </span>

                <div className="flex items-center gap-1">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${
                    chat.mode === "command"
                      ? "bg-purple-100 text-purple-700"
                      : chat.mode === "genai_sse"
                      ? "bg-red-100 text-red-600"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {chat.mode.toUpperCase()}
                </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteChat(chat.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 transition text-slate-400 hover:text-red-600 p-0.5 flex items-center justify-center"
                  >
                    <DeleteOutlineIcon sx={{ fontSize: 20 }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="col-span-5 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <header className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">
            Chat
          </header>

          <div className="flex-1 space-y-3 overflow-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-auto bg-blue-100"
                    : "bg-slate-100"
                }`}
              >
                {m.content}
              </div>
            ))}
          </div>

          <footer className="flex items-center gap-2 border-t border-slate-200 p-3">
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
              <ModeButton active={mode === "command"} disabled={modeLocked} onClick={() => setMode("command")}>
                Command
              </ModeButton>
              <ModeButton
                active={mode === "genai_sse"}
                disabled={modeLocked}
                onClick={() => setMode("genai_sse")}
              >
                <div className="flex flex-col items-center leading-tight">
                  <span>GenAI SSE</span>
                  <span className="text-[10.5px] text-red-400 font-medium">(openAI)</span>
                </div>
              </ModeButton>
            </div>

            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
              placeholder="Type a message..."
            />

            <button
              onClick={sendMessage}
              disabled={sending}
              className="rounded-md border border-slate-300 bg-slate-50 px-4 py-2 text-sm hover:bg-slate-100 disabled:opacity-50"
            >
              Send
            </button>
          </footer>
        </section>

        <section className="col-span-4 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <header className="border-b border-slate-200 px-4 py-3 text-sm font-semibold">
            Diagram
          </header>

          <div className="flex-1 overflow-auto p-4">
            {diagramLoading ? (
              <div className="flex h-full items-center justify-center text-slate-400 text-sm">
                Generating diagram
              </div>
            ) : diagram ? (
              <Diagram code={diagram} />
            ) : (
              <p className="text-slate-400 text-sm">
                Diagram will render here.
              </p>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}