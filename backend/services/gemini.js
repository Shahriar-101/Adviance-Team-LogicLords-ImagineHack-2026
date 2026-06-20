import { GoogleGenAI } from '@google/genai';
import { AppError } from '../lib/errors.js';

const DEFAULT_MODEL = 'gemini-2.5-flash';

function stripCodeFence(value) {
  return value.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
}

function getClient() {
  if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'replace_with_your_gemini_key') {
    throw new AppError(503, 'AI_NOT_CONFIGURED', 'Gemini is not configured yet. Add GEMINI_API_KEY to backend/.env and restart the backend.');
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export async function generateStructuredJson({ task, context, schema }) {
  const ai = getClient();
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const prompt = `
You are Adviance AI, an internal decision-support assistant for financial advisors.

Operating rules:
- Use ONLY the data supplied below. Never invent clients, partners, courses, qualifications, outcomes, laws, financial figures, or referral history.
- This tool supports an advisor's preparation and workflow. It is NOT financial, legal, tax, or insurance advice.
- Be concise, factual, respectful, and explainable.
- Return only valid JSON that matches the requested schema. Do not use markdown.

TASK:
${task}

CONTEXT:
${JSON.stringify(context, null, 2)}
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.2,
        // Gemini structured output: request JSON that follows the supplied schema.
        // This is intentionally kept on the backend so the browser never sees the API key.
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
      },
    });

    const text = response?.text?.trim();
    if (!text) throw new Error('Gemini returned an empty response.');
    return JSON.parse(stripCodeFence(text));
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error?.message || 'Unknown Gemini error.';
    const lower = message.toLowerCase();
    if (lower.includes('api key') || lower.includes('authentication') || lower.includes('permission denied')) {
      throw new AppError(502, 'AI_AUTH_ERROR', 'Gemini rejected the API key. Check backend/.env and restart the backend.');
    }
    if (lower.includes('not found') || lower.includes('model')) {
      throw new AppError(502, 'AI_MODEL_ERROR', `Gemini could not use the configured model. Update GEMINI_MODEL in backend/.env. Original message: ${message}`);
    }
    throw new AppError(502, 'AI_REQUEST_FAILED', `Gemini could not complete this request. ${message}`);
  }
}

const courseSchema = {
  type: 'object',
  properties: {
    recommendedCourseId: { type: 'string' },
    urgency: { type: 'string', enum: ['High', 'Medium', 'Low'] },
    relevantClientIds: { type: 'array', items: { type: 'string' } },
    reason: { type: 'string' },
    nextStep: { type: 'string' },
    disclaimer: { type: 'string' },
  },
  required: ['recommendedCourseId', 'urgency', 'relevantClientIds', 'reason', 'nextStep', 'disclaimer'],
};

const partnerSchema = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          partnerId: { type: 'string' },
          matchScore: { type: 'integer' },
          reason: { type: 'string' },
        },
        required: ['partnerId', 'matchScore', 'reason'],
      },
    },
    introductionDraft: { type: 'string' },
    disclaimer: { type: 'string' },
  },
  required: ['matches', 'introductionDraft', 'disclaimer'],
};

const preMeetingSchema = {
  type: 'object',
  properties: {
    clientSummary: { type: 'string' },
    keyConcerns: { type: 'array', items: { type: 'string' } },
    openItems: { type: 'array', items: { type: 'string' } },
    talkingPoints: { type: 'array', items: { type: 'string' } },
    suggestedQuestions: { type: 'array', items: { type: 'string' } },
    disclaimer: { type: 'string' },
  },
  required: ['clientSummary', 'keyConcerns', 'openItems', 'talkingPoints', 'suggestedQuestions', 'disclaimer'],
};

const meetingNotesSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    clientConcerns: { type: 'array', items: { type: 'string' } },
    actionItems: { type: 'array', items: { type: 'string' } },
    suggestedFollowUp: { type: 'string' },
    disclaimer: { type: 'string' },
  },
  required: ['summary', 'clientConcerns', 'actionItems', 'suggestedFollowUp', 'disclaimer'],
};

const learningAnswerSchema = {
  type: 'object',
  properties: {
    answer: { type: 'string' },
    recommendedCourseId: { type: ['string', 'null'] },
    disclaimer: { type: 'string' },
  },
  required: ['answer', 'recommendedCourseId', 'disclaimer'],
};

export function recommendCourse(state) {
  const incompleteCourses = state.courses.filter((course) => !course.completed);
  return generateStructuredJson({
    task: `Recommend exactly one course from PRE_APPROVED_COURSES. Choose a course only from that list. Base the recommendation on repeated client needs and the advisor's uncompleted courses. Use client IDs exactly as supplied.`,
    context: {
      advisor: state.user,
      clients: state.clients.map(({ id, name, lifeEvent, lastContact, notes }) => ({ id, name, lifeEvent, lastContact, notes })),
      completedCourseIds: state.courses.filter((course) => course.completed).map((course) => course.id),
      PRE_APPROVED_COURSES: incompleteCourses.map(({ id, title, category, hours, description }) => ({ id, title, category, hours, description })),
    },
    schema: courseSchema,
  });
}

export function matchPartner({ client, category, partners, referrals }) {
  return generateStructuredJson({
    task: `Return one or two best partners from AUTHORISED_PARTNERS only. Every returned partnerId must come from AUTHORISED_PARTNERS and must have category exactly equal to SELECTED_CATEGORY. Match the saved client context, not external facts. The introduction draft must use the supplied real client and partner names, stay professional, and ask the advisor to review before sending.`,
    context: {
      SELECTED_CATEGORY: category,
      client: {
        id: client.id,
        name: client.name,
        lifeEvent: client.lifeEvent,
        portfolioChange: client.portfolioChange,
        notes: client.notes,
      },
      AUTHORISED_PARTNERS: partners,
      referralHistory: referrals,
    },
    schema: partnerSchema,
  });
}

export function generatePreMeetingBrief({ client, meetings, followups }) {
  return generateStructuredJson({
    task: `Create a short preparation brief for the advisor. Use only the saved client memory, scheduled meetings, and follow-ups below. Do not give financial advice or make recommendations about specific investments. Focus on context, questions, and documented next actions.`,
    context: { client, meetings, followups },
    schema: preMeetingSchema,
  });
}

export function organiseMeetingNotes({ client, rawNotes }) {
  return generateStructuredJson({
    task: `Organise these advisor-written meeting notes into a concise reviewable summary. Do not add facts or advice. Action items must be clearly supported by the raw notes.`,
    context: { client: { id: client.id, name: client.name, lifeEvent: client.lifeEvent }, rawNotes },
    schema: meetingNotesSchema,
  });
}

export function answerLearningQuestion({ question, courses }) {
  return generateStructuredJson({
    task: `Answer the advisor's learning question concisely for preparation only. Use the PRE_APPROVED_COURSES list as the only curriculum source. Do not make legal, tax, insurance, or investment advice. If a course is relevant, return its exact ID; otherwise return null.`,
    context: {
      question,
      PRE_APPROVED_COURSES: courses.map(({ id, title, category, description }) => ({ id, title, category, description })),
    },
    schema: learningAnswerSchema,
  });
}
