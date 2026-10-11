const values = <T extends Record<string, string>>(o: T) => Object.values(o) as T[keyof T][];

export const ROLES = {
  ADMIN: "Admin",
  SALES_MANAGER: "Sales Manager",
  SALES_EXECUTIVE: "Sales Executive",
} as const;
export type Role = (typeof ROLES)[keyof typeof ROLES];
export const ROLE_VALUES = values(ROLES);

export const LEAD_SOURCES = {
  WEBSITE: "Website",
  REFERRAL: "Referral",
  SOCIAL_MEDIA: "Social Media",
  EMAIL: "Email",
  PHONE: "Phone",
  OTHER: "Other",
} as const;
export type LeadSource = (typeof LEAD_SOURCES)[keyof typeof LEAD_SOURCES];
export const LEAD_SOURCE_VALUES = values(LEAD_SOURCES);

export const LEAD_STATUS = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  UNQUALIFIED: "Unqualified",
  CONVERTED: "Converted",
  LOST: "Lost",
} as const;
export type LeadStatus = (typeof LEAD_STATUS)[keyof typeof LEAD_STATUS];
export const LEAD_STATUS_VALUES = values(LEAD_STATUS);

export const PRIORITY = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" } as const;
export type Priority = (typeof PRIORITY)[keyof typeof PRIORITY];
export const PRIORITY_VALUES = values(PRIORITY);

export const CUSTOMER_STATUS = { ACTIVE: "Active", INACTIVE: "Inactive" } as const;
export type CustomerStatus = (typeof CUSTOMER_STATUS)[keyof typeof CUSTOMER_STATUS];
export const CUSTOMER_STATUS_VALUES = values(CUSTOMER_STATUS);

export const DEAL_STAGES = {
  QUALIFICATION: "Qualification",
  DISCOVERY: "Discovery",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
} as const;
export type DealStage = (typeof DEAL_STAGES)[keyof typeof DEAL_STAGES];
export const DEAL_STAGE_VALUES = values(DEAL_STAGES);
export const ACTIVE_DEAL_STAGES: DealStage[] = ["Qualification", "Discovery", "Proposal", "Negotiation"];
export const CLOSED_DEAL_STAGES: DealStage[] = ["Won", "Lost"];

export const ACTIVITY_TYPES = {
  CALL: "Call",
  EMAIL: "Email",
  MEETING: "Meeting",
  DEMO: "Demo",
  FOLLOW_UP: "Follow-up",
  REMINDER: "Reminder",
  NOTE: "Note",
} as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[keyof typeof ACTIVITY_TYPES];
export const ACTIVITY_TYPE_VALUES = values(ACTIVITY_TYPES);

export const ACTIVITY_STATUS = { PENDING: "Pending", COMPLETED: "Completed", OVERDUE: "Overdue" } as const;
export type ActivityStatus = (typeof ACTIVITY_STATUS)[keyof typeof ACTIVITY_STATUS];
export const ACTIVITY_STATUS_VALUES = values(ACTIVITY_STATUS);

export const ENTITY_TYPES = {
  LEAD: "Lead",
  CUSTOMER: "Customer",
  DEAL: "Deal",
  USER: "User",
  ACTIVITY: "Activity",
} as const;
export type EntityType = (typeof ENTITY_TYPES)[keyof typeof ENTITY_TYPES];
export const ENTITY_TYPE_VALUES = values(ENTITY_TYPES);
// activities can only attach to these
export const ACTIVITY_ENTITY_VALUES: EntityType[] = ["Lead", "Customer", "Deal", "User"];

export const TIMELINE_ACTIONS = {
  LEAD_CREATED: "Lead created",
  LEAD_ASSIGNED: "Lead assigned",
  LEAD_REASSIGNED: "Lead reassigned",
  LEAD_STATUS_CHANGED: "Lead status changed",
  LEAD_PRIORITY_CHANGED: "Lead priority changed",
  NOTE_ADDED: "Note added",
  FOLLOWUP_CREATED: "Follow-up created",
  FOLLOWUP_COMPLETED: "Follow-up completed",
  CUSTOMER_CREATED: "Customer created",
  LEAD_CONVERTED: "Lead converted",
  DEAL_CREATED: "Deal created",
  DEAL_STAGE_CHANGED: "Deal stage changed",
  DEAL_ASSIGNED: "Deal assigned",
  DEAL_WON: "Deal won",
  DEAL_LOST: "Deal lost",
} as const;
export type TimelineAction = (typeof TIMELINE_ACTIONS)[keyof typeof TIMELINE_ACTIONS];
export const TIMELINE_ACTION_VALUES = values(TIMELINE_ACTIONS);