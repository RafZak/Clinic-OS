/**
 * EN replay scenarios for the bilingual demo.
 *
 * Mirror of scripts.ts (consultation) and scripts-phone.ts (phone),
 * adapted for an English-speaking audience. Uses British vocabulary
 * by default (with US-friendly market labels: tier 1 / tier 2 instead
 * of FR's classe 1 / classe 2). Pricing in GBP-equivalents kept in
 * EUR per product decision (currency stays € across locales).
 */
import {
  computeTimedLines,
  estimateDurationSeconds,
  type ReplayScenario,
  type ReplayTurn,
} from "./scripts";
import type { ReplayPhoneScenario } from "./scripts-phone";

// ============================================================
// Scenario A — Mrs. Davis — excellent consultation (target 88)
// ============================================================
//
// 68-year-old retired teacher. Bilateral hearing loss with worse
// right ear. Lifestyle: weekly restaurant outings, big family Sunday
// lunches, theatre. Practitioner Dr. Sarah Mitchell follows the
// 10-step framework cleanly: discovery, demo of tier 1 vs tier 2,
// recommendation justified by the patient's lifestyle, price
// objection handled by value, 30-day trial booked, follow-up scheduled.
// ============================================================

const DAVIS_TURNS: ReplayTurn[] = [
  { speaker: "practitioner", text: "Good morning Mrs. Davis, please come in. Have a seat. Did you find us alright?", pauseMsBefore: 300 },
  { speaker: "patient", text: "Yes, no trouble. Thank you." },
  { speaker: "practitioner", text: "We'll take about an hour together to look at things properly. I'm Sarah Mitchell, your audiologist. We'll start with a chat about what brings you in, then we'll go into the booth for the hearing assessment, and after that I'll walk you through the options. Does that sound alright?" },
  { speaker: "patient", text: "Yes, that's fine." },
  { speaker: "practitioner", text: "And you've got the referral from your ENT consultant?" },
  { speaker: "patient", text: "Yes, here it is." },
  { speaker: "practitioner", text: "Thank you. Dr. Whitfield, we know him well. He's noted bilateral loss with more difficulty on the right side. Before we look at it together, tell me a bit about your day-to-day. What's actually going on?", pauseMsBefore: 900 },
  { speaker: "patient", text: "Well, I'm not hearing as well as I used to. Especially when it gets noisy. Restaurants for instance, with my children, it's getting really difficult.", pauseMsBefore: 1000 },
  { speaker: "practitioner", text: "Right. How often do you eat out?" },
  { speaker: "patient", text: "We go once a week with my husband, and every Sunday at my daughter's, where there's usually eight or ten of us." },
  { speaker: "practitioner", text: "Okay. And at your daughter's, when everyone's talking at once, what bothers you most?" },
  { speaker: "patient", text: "I switch off. I pretend to follow but really I've lost the thread. My grandchildren especially, they speak fast and I keep asking them to repeat, it gets on their nerves.", pauseMsBefore: 1000 },
  { speaker: "practitioner", text: "And I imagine that gets on yours too." },
  { speaker: "patient", text: "Yes. It's exhausting. I come home shattered." },
  { speaker: "practitioner", text: "What you're describing is very common. We call it listening fatigue, the brain works twice as hard to compensate. And outside of meals?", pauseMsBefore: 900 },
  { speaker: "patient", text: "The television. My husband says I have it too loud. And the theatre — I go with a friend — I miss lines." },
  { speaker: "practitioner", text: "The theatre is an interesting context, there's often amplification but it's poorly placed. And on the phone?" },
  { speaker: "patient", text: "That's alright, except when my daughter-in-law speaks fast. But generally fine." },
  { speaker: "practitioner", text: "Music, concerts?" },
  { speaker: "patient", text: "No. We listen to a bit of classical in the evening, that's it." },
  { speaker: "practitioner", text: "One last question, the most important: if we meet again in three months and you tell me 'this has changed', what would that be?", pauseMsBefore: 1400 },
  { speaker: "patient", text: "Oh... being able to take part in the conversation at my daughter's. Not pretending anymore.", pauseMsBefore: 1800 },
  { speaker: "practitioner", text: "Noted. Let's go into the booth. I'll play you a range of sounds, you'll tell me when you hear them. Then we'll do a speech-in-noise test, which will show what's actually happening at your daughter's." },
  { speaker: "patient", text: "Very good." },
  { speaker: "practitioner", text: "Right. Breathe normally, press the button each time you hear a sound, however quiet.", pauseMsBefore: 3500 },
  { speaker: "practitioner", text: "Okay, here are your results. You have a moderate to severe loss on the high frequencies, which matches your ENT report. And crucially, on the speech-in-noise test, you lose 60% of intelligibility. That's significant, and it's exactly what makes you switch off at your daughter's.", pauseMsBefore: 2500 },
  { speaker: "patient", text: "60%? I didn't think it was that much.", pauseMsBefore: 1200 },
  { speaker: "practitioner", text: "It's normal — we compensate without realising it for years. Let me play you something. I'll simulate a family meal, first with a tier 1 entry-level hearing aid, then with a more advanced tier 2. You'll tell me what you hear.", pauseMsBefore: 2000 },
  { speaker: "patient", text: "Oh. Wow, the difference with the second one is striking.", pauseMsBefore: 1800 },
  { speaker: "practitioner", text: "Yes. The first one amplifies the sound globally. The second one has 20 channels, processes noise in real time and brings voices forward. In the context we just simulated, that's the gap between 'I'm in the room' and 'I'm in the conversation'." },
  { speaker: "practitioner", text: "Given what you've told me — meals with ten people, the theatre, the fatigue at the end of the day — I'd recommend the Phonak Lumity tier 2. It's a custom-fitted, rechargeable device that handles complex environments very well, which is exactly where you struggle.", pauseMsBefore: 1200 },
  { speaker: "patient", text: "Tier 2 is the second one I just heard?" },
  { speaker: "practitioner", text: "Exactly. The gap is significant in noisy contexts, and that's precisely where you're struggling." },
  { speaker: "patient", text: "And how much does it cost?", pauseMsBefore: 1000 },
  { speaker: "practitioner", text: "The Phonak Lumity is €1,790 per ear, so €3,580 for both. The NHS-equivalent national health cover takes €240 per ear. Which top-up insurance are you with?" },
  { speaker: "patient", text: "I'm with BUPA, gold plan I think." },
  { speaker: "practitioner", text: "BUPA gold on hearing care is very solid. They reimburse around €1,100 per ear on a tier 2. That leaves an out-of-pocket of €450 per ear, so €900 for both devices.", pauseMsBefore: 1000 },
  { speaker: "patient", text: "€900 — that's a real investment.", pauseMsBefore: 1500 },
  { speaker: "practitioner", text: "Yes, it's a real consideration. Let me give you a benchmark: the device is guaranteed for 4 years, renewable after that. Over 4 years that's €225 a year, just under €20 a month. To put it in perspective, that's what you probably spend on a coffee with your friend after the theatre.", pauseMsBefore: 1000 },
  { speaker: "patient", text: "That's true, when you put it like that." },
  { speaker: "practitioner", text: "And critically, it's not a recurring expense like a subscription. You forget about it after two months. What stays is Sunday lunch at your daughter's where you actually follow the conversation. I'm not saying that to push you, I'm saying it because it's what my patients tell me." },
  { speaker: "patient", text: "Alright.", pauseMsBefore: 1200 },
  { speaker: "practitioner", text: "If the out-of-pocket is a real concern, there's also an entry-level Phonak tier 2 at €1,100 per ear, so about €200 out-of-pocket for both. The difference in your context is noticeable but not deal-breaking. It's a real choice and I'll let you make it." },
  { speaker: "patient", text: "No, I'd rather have the first one. If we're doing this, let's do it properly.", pauseMsBefore: 1400 },
  { speaker: "practitioner", text: "Perfect. I think that's the right choice for your usage." },
  { speaker: "practitioner", text: "Here's how we'll do it: I take impressions today, you give me 10 days for fabrication, then we meet again for the fitting. I'll programme the devices for your usage — a restaurant programme, a TV programme, a general programme. And you walk away with them for a 30-day trial at home.", pauseMsBefore: 800 },
  { speaker: "patient", text: "30 days to try them?" },
  { speaker: "practitioner", text: "Yes. 30 days, you wear them in your daily life. If after 30 days you're not convinced, you bring them back, you owe nothing except the impressions. It's a no-strings trial." },
  { speaker: "patient", text: "Oh, that's reassuring." },
  { speaker: "practitioner", text: "And after the fitting I'll see you at day 15 and day 30 to fine-tune the settings in noise. There's a bit of a learning curve — your brain is relearning how to process sounds it had stopped hearing. I'll already pencil you in for Saturday 9 May at 10:30 if that works." },
  { speaker: "patient", text: "Perfect." },
  { speaker: "practitioner", text: "One last thing: once you decide to keep them after 30 days, I do the paperwork through the system, for the national health and your top-up insurance. Nothing more for you to advance — you just settle the out-of-pocket at that point." },
  { speaker: "patient", text: "Very good, thank you." },
  { speaker: "practitioner", text: "Before we take the impressions, do you have any questions?", pauseMsBefore: 900 },
  { speaker: "patient", text: "No, I think it's clear. I was a bit nervous coming in, I'll admit." },
  { speaker: "practitioner", text: "That's completely normal. You'll see, in two months we'll laugh about it. Shall we?" },
  { speaker: "patient", text: "Let's go." },
];

// ============================================================
// Scenario B — Mr. Wilson — failed inbound call (target 38)
// ============================================================
//
// 71-year-old prospect calling after seeing an ad. Sceptical about price.
// The front-desk agent (James Carter on a bad day, or a less-trained
// colleague) butchers the call: late pickup, no centre intro, skips
// identification + triage, throws a price range without any context,
// brushes off the objection ("check with your insurance"), proposes
// no appointment. Wilson hangs up politely. 100% lost lead — no name,
// no contact details, nothing in the CRM.
// ============================================================

const WILSON_TURNS: ReplayTurn[] = [
  { speaker: "practitioner", text: "Hello, yes?", pauseMsBefore: 1500 },
  { speaker: "patient", text: "Hello, I'm calling about hearing aids, I wanted to know how much they cost.", pauseMsBefore: 700 },
  { speaker: "practitioner", text: "Ah, hearing aids. Well that depends on lots of things sir, but you're looking at between £1,500 and £4,000 for a pair depending on the model.", pauseMsBefore: 600 },
  { speaker: "patient", text: "Right, that's not cheap. And is any of that covered or not?", pauseMsBefore: 700 },
  { speaker: "practitioner", text: "Yes, well it depends on your insurance. You'll need to check with your insurance sir, they'll be able to tell you how much they cover.", pauseMsBefore: 400 },
  { speaker: "patient", text: "Mhm. And don't you have anything cheaper? £1,500 minimum is a lot for a pair of ears.", pauseMsBefore: 800 },
  { speaker: "practitioner", text: "No, below that we don't recommend it sir, the quality isn't good enough. You really want to budget those prices to get proper kit.", pauseMsBefore: 500 },
  { speaker: "patient", text: "Right, well I don't think this is going to work for me then. I'll think about it and maybe call back later.", pauseMsBefore: 1000 },
  { speaker: "practitioner", text: "Alright sir, as you wish. Call us back whenever.", pauseMsBefore: 500 },
  { speaker: "patient", text: "That's right. Have a good day, goodbye.", pauseMsBefore: 400 },
  { speaker: "practitioner", text: "Goodbye sir.", pauseMsBefore: 200 },
];

// ============================================================
// Exported scenarios
// ============================================================

export const REPLAY_SCENARIOS_EN: ReplayScenario[] = [
  {
    slug: "davis-excellent-en",
    label: "Mrs. Davis — excellent case",
    practitionerName: "Sarah Mitchell",
    patientLabel: "Mrs. Eleanor Davis",
    patientAge: 68,
    patientStatus: "prospect",
    targetScore: 88,
    targetDurationSeconds: estimateDurationSeconds(DAVIS_TURNS),
    summary:
      "Successful journey: real lifestyle discovery, comparative tier 1 / tier 2 demo, Phonak Lumity tier 2 recommendation justified by usage, price objection handled with value framing, 30-day trial booked, follow-up appointment scheduled.",
    turns: DAVIS_TURNS,
  },
];

export const REPLAY_PHONE_SCENARIOS_EN: ReplayPhoneScenario[] = [
  {
    slug: "wilson-lost-en",
    label: "Mr. Wilson — lost call (price objection brushed off)",
    callerLabel: "Mr. Robert Wilson",
    callerAge: 71,
    callerStatus: "lost",
    targetScore: 38,
    expectedCallType: "info_request",
    expectedOutcome: "rdv_perdu",
    targetDurationSeconds: estimateDurationSeconds(WILSON_TURNS),
    summary:
      "No centre intro, skips identification and triage, fires off a price range with no context, brushes off the objection, proposes no appointment. 100% lost lead — no contact details captured.",
    turns: WILSON_TURNS,
  },
];

export function getEnScenarioBySlug(slug: string): ReplayScenario | null {
  return REPLAY_SCENARIOS_EN.find((s) => s.slug === slug) ?? null;
}

export function getEnPhoneScenarioBySlug(
  slug: string
): ReplayPhoneScenario | undefined {
  return REPLAY_PHONE_SCENARIOS_EN.find((s) => s.slug === slug);
}

export { computeTimedLines };
