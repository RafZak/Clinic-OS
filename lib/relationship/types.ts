export type CommunicationStyleKey =
  | "reassurance-led"
  | "evidence-led"
  | "story-led"
  | "visual-led"
  | "peer-led";

export type SetbackKey =
  | "cost-concern"
  | "fear-of-stigma"
  | "doubts-it-helps"
  | "past-bad-experience"
  | "not-ready-to-accept"
  | "comfort-worries"
  | "waiting-for-family"
  | "overwhelmed-by-options";

export type PriorityKey =
  | "sound-quality"
  | "social-life"
  | "discretion"
  | "budget-value"
  | "comfort"
  | "ease-of-use"
  | "phone-calls"
  | "tv-connectivity"
  | "battery-life"
  | "active-sport"
  | "tinnitus-relief"
  | "follow-up-service";

export type CommunicationStyle = {
  lead: CommunicationStyleKey | null;
  relevant: CommunicationStyleKey[];
};
export type Setbacks = { present: SetbackKey[] };
export type Priorities = { lead: PriorityKey | null; relevant: PriorityKey[] };

export type RelationshipSynthesis = {
  abstractMd: string;
  communicationStyle: CommunicationStyle;
  setbacks: Setbacks;
  priorities: Priorities;
  sessionsCount: number;
  updatedAt: Date;
};
