# Adviance — Full-Stack Hackathon MVP

This project combines the approved **React frontend** with a **Node.js + Express backend** and secure **Gemini API** integration.

It keeps the original Adviance palette and top navigation. The backend provides persistent Client Memory using a file-backed JSON store for the hackathon demo. On first run it creates `backend/data/database.json` from `backend/data/seed.json`.

## Three working features for the demo

1. **AI partner matching**
   - The advisor selects a client and a pre-approved need category.
   - Gemini receives only the saved client context and authorised partners in that selected category.
   - The response is validated before display, so the UI cannot show a partner outside the authorised directory.
   - Gemini also drafts an introduction message for the advisor to review.

2. **AI course recommendation**
   - Gemini reads Client Memory and the advisor's complete/incomplete CPD list.
   - It must recommend one item from the pre-approved course library only.
   - The backend validates the returned course ID before displaying it.

3. **Meeting notes + Client Memory**
   - Advisors add notes through the client detail screen.
   - Notes save persistently through the backend to the client timeline.
   - **Organise with Gemini** turns rough notes into a reviewable summary, client concerns, and action items.
   - The advisor decides whether to save the original note; the AI never silently changes Client Memory.

Extra AI endpoints are included for **pre-meeting briefs** and **Ask Adviance**.

---

## Before you run it

You need:

- Node.js 18 or newer
- A Gemini API key from Google AI Studio

Do **not** paste your real API key into GitHub, React files, screenshots, or chat messages.

---

## Run locally — easiest method

### 1. Open Terminal in the project folder

```bash
cd Adviance_Fullstack
```

### 2. Install all frontend and backend packages

```bash
npm install
```

### 3. Create your private backend environment file

On macOS/Linux:

```bash
cp backend/.env.example backend/.env
```

Then open `backend/.env` and replace only this value:

```env
GEMINI_API_KEY=replace_with_your_gemini_key
```

Keep the key private. You may leave `GEMINI_MODEL=gemini-2.5-flash` as it is. If Google AI Studio says that model is not available for your key, change it to a model available in your account.

### 4. Start frontend and backend together

```bash
npm run dev
```

You should see two local URLs:

- React frontend: `http://localhost:5173`
- Node.js backend: `http://localhost:4000`

Open `http://localhost:5173` in Chrome.

**Demo login**

```text
Email: ahmad@adviance.demo
Password: adviance2026
```

---

## What to click in the app

### AI course recommendation

`Learning Hub` → `Generate AI recommendation`

### Pre-meeting brief

`Learning Hub` → choose a client → `Generate preparation brief`

### AI partner matching

`Partner Finder` → choose client and category → `Find authorised match`

### Meeting note saving and AI organisation

`Dashboard` → click a client → write a note → `Organise with Gemini` → review → `Save note to Client Memory`

---

## Backend API routes

| Route | Purpose |
|---|---|
| `GET /api/health` | Confirms backend status and whether Gemini is configured |
| `GET /api/state` | Loads all demo Client Memory data |
| `PUT /api/state` | Saves frontend changes persistently |
| `POST /api/clients/:clientId/notes` | Saves a client note to Client Memory |
| `POST /api/ai/course-recommendation` | Returns one approved CPD recommendation |
| `POST /api/ai/partner-match` | Returns authorised partner matches + introduction draft |
| `POST /api/ai/pre-meeting-brief` | Returns a client-specific preparation brief |
| `POST /api/ai/organize-meeting-notes` | Organises rough meeting notes |
| `POST /api/ai/learning-question` | Answers a learning question using course context |

---

## Important architecture explanation for judges

> Adviance does not use Gemini as memory. Client records, notes, meetings, courses, partners, and referrals are stored by our backend. Gemini is the reasoning layer: it receives only the relevant saved context when an advisor requests a recommendation, match, brief, or note organisation.

---

## Current MVP data storage

The hackathon version uses `backend/data/database.json`, which is created locally and persists while the backend is running on your computer. This is intentionally simple so the whole team can run the project without creating a cloud database account.

For production, replace the file store in `backend/data/store.js` with MongoDB Atlas, Firebase, PostgreSQL, or another managed database, and add real authentication and role-based access control.

---

## GitHub safety

The root `.gitignore` already ignores:

```text
backend/.env
backend/data/database.json
node_modules/
```

Before pushing to GitHub, run:

```bash
git status
```

Make sure `backend/.env` is **not** listed.

---

## Build check

Use this before submission:

```bash
npm run check
```

It checks the backend JavaScript and builds the React frontend.


## Gemini blank-screen fix
This build fixes the `Organise with Gemini` blank-screen issue by using Gemini's current structured-output settings (`responseMimeType` and `responseJsonSchema`) and by validating/normalising the meeting-note result before React renders it. After replacing an older build, run `npm install` and restart with `npm run dev`.
