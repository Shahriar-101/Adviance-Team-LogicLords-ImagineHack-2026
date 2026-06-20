import express from 'express';
import { getState } from '../data/store.js';
import { asyncRoute, AppError } from '../lib/errors.js';
import { askLearningSchema, clientIdSchema, noteOrganiseSchema, parseOrThrow, partnerMatchSchema } from '../lib/validation.js';
import { answerLearningQuestion, generatePreMeetingBrief, matchPartner, organiseMeetingNotes, recommendCourse } from '../services/gemini.js';

const router = express.Router();

function getClientOrThrow(state, clientId) {
  const client = state.clients.find((item) => item.id === clientId);
  if (!client) throw new AppError(404, 'CLIENT_NOT_FOUND', 'The selected client could not be found.');
  return client;
}

router.post('/course-recommendation', asyncRoute(async (_req, res) => {
  const state = await getState();
  if (!state.courses.some((course) => !course.completed)) {
    throw new AppError(409, 'NO_UNFINISHED_COURSES', 'All approved CPD modules are already completed.');
  }
  const output = await recommendCourse(state);
  const course = state.courses.find((item) => item.id === output.recommendedCourseId && !item.completed);
  if (!course) throw new AppError(502, 'AI_INVALID_OUTPUT', 'Gemini selected a course outside the pre-approved unfinished course library. Please try again.');

  const validClientIds = new Set(state.clients.map((client) => client.id));
  const relevantClientIds = (output.relevantClientIds || []).filter((id) => validClientIds.has(id)).slice(0, 5);
  res.json({
    recommendation: {
      course,
      urgency: output.urgency,
      relevantClientIds,
      reason: output.reason,
      nextStep: output.nextStep,
      disclaimer: output.disclaimer,
    },
  });
}));

router.post('/partner-match', asyncRoute(async (req, res) => {
  const { clientId, category } = parseOrThrow(partnerMatchSchema, req.body);
  const state = await getState();
  const client = getClientOrThrow(state, clientId);
  const authorisedPartners = state.partners.filter((partner) => partner.category === category);
  if (!authorisedPartners.length) throw new AppError(404, 'NO_AUTHORISED_PARTNER', 'No authorised partners are available in this category.');

  const referrals = state.referrals.filter((referral) => authorisedPartners.some((partner) => partner.id === referral.partnerId));
  const output = await matchPartner({ client, category, partners: authorisedPartners, referrals });
  const authorisedMap = new Map(authorisedPartners.map((partner) => [partner.id, partner]));
  const matches = (output.matches || [])
    .filter((match) => authorisedMap.has(match.partnerId))
    .slice(0, 2)
    .map((match) => ({
      partner: authorisedMap.get(match.partnerId),
      matchScore: Math.max(0, Math.min(100, Number(match.matchScore) || 0)),
      reason: String(match.reason || '').trim(),
    }));

  if (!matches.length) throw new AppError(502, 'AI_INVALID_OUTPUT', 'Gemini did not return a valid authorised partner match. Please try again.');
  res.json({ matches, introductionDraft: output.introductionDraft, disclaimer: output.disclaimer });
}));

router.post('/pre-meeting-brief', asyncRoute(async (req, res) => {
  const { clientId } = parseOrThrow(clientIdSchema, req.body);
  const state = await getState();
  const client = getClientOrThrow(state, clientId);
  const meetings = state.meetings.filter((meeting) => meeting.clientId === clientId).sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`));
  const followups = state.followups.filter((followup) => followup.clientId === clientId && !followup.done);
  const brief = await generatePreMeetingBrief({ client, meetings, followups });
  res.json({ brief });
}));

router.post('/organize-meeting-notes', asyncRoute(async (req, res) => {
  const { clientId, rawNotes } = parseOrThrow(noteOrganiseSchema, req.body);
  const state = await getState();
  const client = getClientOrThrow(state, clientId);
  const rawAnalysis = await organiseMeetingNotes({ client, rawNotes });
  // Defensive normalisation: even if a model response is incomplete, the UI receives
  // stable, reviewable fields instead of crashing. The original note is never altered.
  const analysis = {
    summary: String(rawAnalysis?.summary || 'No summary was returned. Please review the original note.'),
    clientConcerns: Array.isArray(rawAnalysis?.clientConcerns) ? rawAnalysis.clientConcerns.map(String).slice(0, 6) : [],
    actionItems: Array.isArray(rawAnalysis?.actionItems) ? rawAnalysis.actionItems.map(String).slice(0, 6) : [],
    suggestedFollowUp: String(rawAnalysis?.suggestedFollowUp || ''),
    disclaimer: String(rawAnalysis?.disclaimer || 'AI-assisted organisation only. Review before saving to Client Memory.'),
  };
  res.json({ analysis });
}));

router.post('/learning-question', asyncRoute(async (req, res) => {
  const { question } = parseOrThrow(askLearningSchema, req.body);
  const state = await getState();
  const answer = await answerLearningQuestion({ question, courses: state.courses });
  const course = answer.recommendedCourseId ? state.courses.find((item) => item.id === answer.recommendedCourseId) : null;
  res.json({ answer: answer.answer, course, disclaimer: answer.disclaimer });
}));

export default router;
