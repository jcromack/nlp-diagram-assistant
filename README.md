# NLP Diagram Assistant

A natural language powered diagram editor that converts user prompts into dynamic Mermaid Diagrams, with chat persistence using file-based storage (SQLite), a command-based LLM-style stub, as well as real LLM integration with streaming support.

---

# Installation

## 1. Install and Run Backend (API)

Navigate to the API folder:

```
cd apps/api
npm install
```

Generate Prisma client:

```
npx prisma generate
```

Run database migrations:

```
npx prisma migrate dev
```

Start the backend server:

```
npm run dev
```

The API will run on:

```
http://localhost:3001
```

---

## 2. Install and Run Frontend (Web)

Open a new terminal and navigate to:

```
cd apps/web
npm install
npm run dev
```

The frontend will run on:

```
http://localhost:5173
```

---

## 3. Optional – Enable GenAI Mode

To enable OpenAI streaming mode:

Create a `.env` file inside:

```
apps/api/
```

Add:

```
OPENAI_API_KEY=your_api_key_here
```

If no API key is provided, Command Mode will still function normally.


# Command Mode

Uses deterministic parsing logic to convert user string input into structured commands.  
Those commands then create or edit Mermaid diagram strings and return suitable stub responses to the frontend.

---

# Supported Commands

## Creating Basic / General Diagram

```
create me a diagram
create diagram
create digram
```

Generates a default 3-step flow diagram:

```
Start → Process → End
```

---

## Creating Diagrams With Multiple Custom Steps / Labels

```
create me a diagram with steps first, second and third
create me a diagram with steps start middle end final
create me a diagram with start middle end final
create diagram with labels: one two three
```

Supported patterns:

- `with steps`
- `with labels`
- `with points`
- Supports:
  - `and`
  - `&`
  - comma-separated values
  - space-separated values

---

## Adding Single Step / Node

```
add review
add step called review
add stage approval
add step test between x and y
add test between x and y

```

Behavior:

- If no position is specified, the step is appended to the terminal node.
- If `after` is specified, the step is inserted after the matched node.
- If `between x and y` is used, the step is inserted between the two nodes.

---

## Adding Multiple Steps

```
add steps final1, final2 and final3
add steps final1 final2 and final3
add steps next and done
```

Supported separators:

- space  
- comma  
- `and`  
- `&`

Each step is inserted sequentially using the same logic as single-step addition.

---

## Removing a Step

```
remove review
remove step final
remove stage approval
```

- Removes the specified node.
- Reconnects surrounding nodes.
- Returns a suitable message if the step does not exist.

---


## Undo

```
undo
```

Reverts to the previous diagram state using stored chat history in SQLlite3 history.

---


# GenAI SSE Mode

Includes real LLM integration with streaming (SSE):

- Token streaming to frontend
- AI Generated Mermaid Diagram strings based on user inputs
- AI-generated responses to the user


---

# AI Title Generation

Each new chat starts with the default title:

```
New Chat
```

After the first assistant response, a better title is automatically generated based on the conversation.
