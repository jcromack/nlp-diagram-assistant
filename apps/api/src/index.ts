import express from "express"
import cors from "cors"
import { PrismaClient } from "@prisma/client"
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
import { respondCommand } from "./ai/provider"
import { respondGenAISSE } from "./ai/provider-genai-sse"
import { generateChatTitle } from "./ai/aiTitles"

//using Express API Server
const app = express()
//using Prisma SQLlite3 file storage
const adapter = new PrismaBetterSqlite3({
  url: "file:./dev.db"
})

export const prisma = new PrismaClient({
  adapter
})

app.use(cors())
app.use(express.json())

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`)
  next()
})

//Creates new chat with selected mode and empty diagram
app.post("/chats", async (req, res) => {
  const { mode } = req.body

  const chat = await prisma.chat.create({
    data: {
      title: "New Chat",
      mode,
      diagram: null
    }
  })

  res.json(chat)
})

//Returns all chats ordered by most recently updated
app.get("/chats", async (_req, res) => {
  const chats = await prisma.chat.findMany({
    orderBy: { updatedAt: "desc" }
  })

  res.json(chats)
})

//Returns a single chat with its message history
app.get("/chats/:id", async (req, res) => {
  const chat = await prisma.chat.findUnique({
    where: { id: req.params.id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" }
      }
    }
  })

  if (!chat) return res.status(404).json({ error: "Not found" })

  res.json(chat)
})

//Handles user message sending and parsing to commands to change diagram string
app.post("/chats/:id/messages", async (req, res) => {
  const { content } = req.body
  const chatId = req.params.id

  const chat = await prisma.chat.findUnique({
    where: { id: chatId },
    select: {
      id: true,
      title: true,
      mode: true,
      diagram: true,
      history: true,
      messages: true
    }
  })

  if (!chat) return res.status(404).json({ error: "Chat not found" })

  await prisma.message.create({
    data: {
      chatId,
      role: "user",
      content
    }
  })

  const updatedMessages = [
    ...chat.messages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content
    })),
    { role: "user" as const, content }
  ]

  if (chat.mode === "command") {

    const text = content.toLowerCase().trim()
  
    //Added history to the file DB to allow undo functionality
    if (text === "undo") {
      const history = (chat.history ?? []) as (string | null)[]
  
      if (history.length === 0) {
        return res.json({
          message: "Nothing to undo.",
          diagram: chat.diagram
        })
      }
  
      const previous = history[history.length - 1]
  
      await prisma.chat.update({
        where: { id: chatId },
        data: {
          diagram: previous,
          history: history.slice(0, -1)
        }
      })
  
      return res.json({
        message: "Undid the last change.",
        diagram: previous
      })
    }
  

    const aiResult = await respondCommand(updatedMessages, chat.diagram)
  
    await prisma.message.create({
      data: { chatId, role: "assistant", content: aiResult.message }
    })
  
    const history = (chat.history ?? []) as (string | null)[]
    const diagramChanged = aiResult.diagram !== chat.diagram
  
    await prisma.chat.update({
      where: { id: chatId },
      data: {
        diagram: aiResult.diagram,
        updatedAt: new Date(),
        history: diagramChanged
          ? [...history, chat.diagram ?? null]
          : history
      }
    })
  
    //AI title generation of based of first AI/assistant response
    if (chat.title === "New Chat") {
      const newTitle = await generateChatTitle(content, aiResult.message)
  
      await prisma.chat.update({
        where: { id: chatId },
        data: { title: newTitle }
      })
    }
  
    return res.json(aiResult)
  }

  //Streaming capability for GenAI, 2 requests to openAI; one for message and one for diagram
  if (chat.mode === "genai_sse") {
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")

    const stream = respondGenAISSE(updatedMessages, chat.diagram)

    let fullMessage = ""
    let finalDiagram = chat.diagram ?? ""

    for await (const chunk of stream) {
      if (chunk.token) {
        fullMessage += chunk.token
        res.write(`data: ${JSON.stringify({ token: chunk.token })}\n\n`)
      }

      if (chunk.diagram) {
        finalDiagram = chunk.diagram
        res.write(`data: ${JSON.stringify({ diagram: finalDiagram })}\n\n`)
      }
    }

    await prisma.message.create({
      data: { chatId, role: "assistant", content: fullMessage }
    })

    await prisma.chat.update({
      where: { id: chatId },
      data: { diagram: finalDiagram, updatedAt: new Date() }
    })

    if (chat.title === "New Chat") {
      const newTitle = await generateChatTitle(content, fullMessage)

      await prisma.chat.update({
        where: { id: chatId },
        data: { title: newTitle }
      })
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`)
    res.end()
    return
  }

  res.status(400).json({ error: "Invalid mode" })
})


app.delete("/chats/:id", async (req, res) => {
  const { id } = req.params

  await prisma.chat.delete({
    where: { id }
  })

  res.json({ ok: true })
})

app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

const port = process.env.PORT ? Number(process.env.PORT) : 3001
app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`)
})