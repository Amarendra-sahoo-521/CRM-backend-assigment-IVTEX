import { Types, PipelineStage } from "mongoose";
import { Lead, Customer, Deal, Activity, User } from "../models";
import {
  ROLES, LEAD_STATUS_VALUES, ACTIVE_DEAL_STAGES, DEAL_STAGES, DEAL_STAGE_VALUES,
  CUSTOMER_STATUS, ACTIVITY_STATUS,
} from "../constants";
import { ApiError } from "../utils/ApiError";
import { buildAccessScope, Actor } from "../utils/accessScope";
import { andFilters, dateRangeFilter, Filter } from "../utils/queryBuilder";
import { AnalyticsQuery, TeamPerformanceQuery } from "../validators/analytics.validator";

// aggregate() does NOT cast strings to ObjectIds, so ids from the query are converted explicitly
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const match = (f: Filter): PipelineStage => ({ $match: f as any });
const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (num: number, den: number) => (den ? round2((num / den) * 100) : 0);
const assigneeFilter = (id?: string): Filter => (id ? { assignedTo: new Types.ObjectId(id) } : {});

type CountRow = { _id: string; count: number };
type DealRow = { _id: string; count: number; value: number; expectedRevenue: number };
type ActivityRow = { _id: { status: string; overdue: boolean }; count: number };

const countOf = (rows: CountRow[], key: string) => rows.find((r) => r._id === key)?.count ?? 0;
const sum = (rows: { count: number }[]) => rows.reduce((a, r) => a + r.count, 0);


export const getDashboard = async (q: AnalyticsQuery, actor: Actor) => {
  const now = new Date();
  const common = andFilters(
    dateRangeFilter("createdAt", q.dateFrom, q.dateTo),
    assigneeFilter(q.assignedTo)
  );
  const scope = await buildAccessScope(actor);
  const leadScope = await buildAccessScope(actor, { creatorField: "createdBy" });

  const [leadRows, dealRows, customerRows, activityRows] = await Promise.all([
    Lead.aggregate<CountRow>([
      match(andFilters(leadScope, common)),
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Deal.aggregate<DealRow>([
      match(andFilters(scope, common)),
      {
        $group: {
          _id: "$stage",
          count: { $sum: 1 },
          value: { $sum: "$value" },
          expectedRevenue: { $sum: "$expectedRevenue" },
        },
      },
    ]),
    Customer.aggregate<CountRow>([
      match(andFilters(scope, common)),
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Activity.aggregate<ActivityRow>([
      match(andFilters(scope, common)),
      { $group: { _id: { status: "$status", overdue: { $lt: ["$dueDate", now] } }, count: { $sum: 1 } } },
    ]),
  ]);

  // leads
  const leadTotal = sum(leadRows);
  const leads = {
    total: leadTotal,
    ...Object.fromEntries(LEAD_STATUS_VALUES.map((s) => [s.toLowerCase(), countOf(leadRows, s)])),
  } as Record<string, number>;

  // deals
  const dealOf = (stage: string) => dealRows.find((r) => r._id === stage);
  const openRows = dealRows.filter((r) => ACTIVE_DEAL_STAGES.includes(r._id as never));
  const won = dealOf(DEAL_STAGES.WON);

  // activities: Pending + past due date = Overdue (derived, never stored)
  const activityCount = (pred: (r: ActivityRow) => boolean) => sum(activityRows.filter(pred));
  const pendingNotDue = activityCount((r) => r._id.status === ACTIVITY_STATUS.PENDING && !r._id.overdue);
  const overdue = activityCount((r) => r._id.status === ACTIVITY_STATUS.PENDING && r._id.overdue);
  const completed = activityCount((r) => r._id.status === ACTIVITY_STATUS.COMPLETED);

  return {
    leads,
    customers: {
      total: sum(customerRows),
      active: countOf(customerRows, CUSTOMER_STATUS.ACTIVE),
      inactive: countOf(customerRows, CUSTOMER_STATUS.INACTIVE),
    },
    deals: {
      total: sum(dealRows),
      open: sum(openRows),
      won: won?.count ?? 0,
      lost: dealOf(DEAL_STAGES.LOST)?.count ?? 0,
    },
    revenue: {
      totalRevenue: round2(won?.value ?? 0), // sum of Won deal values
      expectedRevenue: round2(openRows.reduce((a, r) => a + r.expectedRevenue, 0)), // weighted open pipeline
      openPipelineValue: round2(openRows.reduce((a, r) => a + r.value, 0)),
    },
    conversionRate: pct(leads.converted, leadTotal), // converted leads / total leads, in %
    activities: {
      pending: pendingNotDue,
      overdue,
      completed,
      total: pendingNotDue + overdue + completed,
    },
  };
};



export const getPipeline = async (q: AnalyticsQuery, actor: Actor) => {
  const filter = andFilters(
    await buildAccessScope(actor),
    dateRangeFilter("createdAt", q.dateFrom, q.dateTo),
    assigneeFilter(q.assignedTo)
  );

  const rows = await Deal.aggregate<DealRow>([
    match(filter),
    {
      $group: {
        _id: "$stage",
        count: { $sum: 1 },
        value: { $sum: "$value" },
        expectedRevenue: { $sum: "$expectedRevenue" },
      },
    },
  ]);

  // every stage is always present, in pipeline order, even with zero deals
  const stages = DEAL_STAGE_VALUES.map((stage) => {
    const r = rows.find((x) => x._id === stage);
    return {
      stage,
      deals: r?.count ?? 0,
      totalValue: round2(r?.value ?? 0),
      expectedRevenue: round2(r?.expectedRevenue ?? 0),
    };
  });

  const open = stages.filter((s) => ACTIVE_DEAL_STAGES.includes(s.stage));
  return {
    stages,
    summary: {
      totalDeals: stages.reduce((a, s) => a + s.deals, 0),
      totalValue: round2(stages.reduce((a, s) => a + s.totalValue, 0)),
      openDeals: open.reduce((a, s) => a + s.deals, 0),
      openValue: round2(open.reduce((a, s) => a + s.totalValue, 0)),
    },
  };
};

/* ------------------------------------------------------------ team performance */

const cond = (expr: unknown, then: unknown = 1) => ({ $sum: { $cond: [expr, then, 0] } });

export const getTeamPerformance = async (q: TeamPerformanceQuery, actor: Actor) => {
  const memberFilter: Filter = { role: ROLES.SALES_EXECUTIVE };
  if (actor.role === ROLES.SALES_MANAGER) {
    if (q.managerId && q.managerId !== actor.id) throw ApiError.forbidden("You can only view your own team");
    memberFilter.managerId = actor._id;
  } else if (q.managerId) {
    memberFilter.managerId = new Types.ObjectId(q.managerId);
  }

  const members = await User.find(memberFilter).select("name email isActive managerId").sort({ name: 1 });
  const ids = members.map((m) => m._id);
  const now = new Date();

  const base = andFilters({ assignedTo: { $in: ids } }, dateRangeFilter("createdAt", q.dateFrom, q.dateTo));
  const isOpen = { $in: ["$stage", ACTIVE_DEAL_STAGES] };
  const isWon = { $eq: ["$stage", DEAL_STAGES.WON] };
  const isPending = { $eq: ["$status", ACTIVITY_STATUS.PENDING] };

  const [leadRows, dealRows, activityRows] = ids.length
    ? await Promise.all([
        Lead.aggregate([
          match(base),
          {
            $group: {
              _id: "$assignedTo",
              assigned: { $sum: 1 },
              qualified: cond({ $eq: ["$status", "Qualified"] }),
              converted: cond({ $eq: ["$status", "Converted"] }),
            },
          },
        ]),
        Deal.aggregate([
          match(base),
          {
            $group: {
              _id: "$assignedTo",
              total: { $sum: 1 },
              open: cond(isOpen),
              won: cond(isWon),
              lost: cond({ $eq: ["$stage", DEAL_STAGES.LOST] }),
              wonRevenue: cond(isWon, "$value"),
              expectedRevenue: cond(isOpen, "$expectedRevenue"),
            },
          },
        ]),
        Activity.aggregate([
          match(base),
          {
            $group: {
              _id: "$assignedTo",
              pending: cond({ $and: [isPending, { $gte: ["$dueDate", now] }] }),
              overdue: cond({ $and: [isPending, { $lt: ["$dueDate", now] }] }),
              completed: cond({ $eq: ["$status", ACTIVITY_STATUS.COMPLETED] }),
            },
          },
        ]),
      ])
    : [[], [], []];

  const byId = (rows: { _id: Types.ObjectId }[]) => new Map(rows.map((r) => [r._id.toString(), r]));
  const leadMap = byId(leadRows);
  const dealMap = byId(dealRows);
  const actMap = byId(activityRows);

  const team = members.map((m) => {
    const l = (leadMap.get(m.id) ?? {}) as Record<string, number>;
    const d = (dealMap.get(m.id) ?? {}) as Record<string, number>;
    const a = (actMap.get(m.id) ?? {}) as Record<string, number>;
    return {
      userId: m.id,
      name: m.name,
      email: m.email,
      isActive: m.isActive,
      managerId: m.managerId ?? null,
      leads: {
        assigned: l.assigned ?? 0,
        qualified: l.qualified ?? 0,
        converted: l.converted ?? 0,
        conversionRate: pct(l.converted ?? 0, l.assigned ?? 0),
      },
      deals: {
        total: d.total ?? 0,
        open: d.open ?? 0,
        won: d.won ?? 0,
        lost: d.lost ?? 0,
        winRate: pct(d.won ?? 0, (d.won ?? 0) + (d.lost ?? 0)),
      },
      revenue: { won: round2(d.wonRevenue ?? 0), expected: round2(d.expectedRevenue ?? 0) },
      activities: { pending: a.pending ?? 0, overdue: a.overdue ?? 0, completed: a.completed ?? 0 },
    };
  });

  const tot = (pick: (t: (typeof team)[number]) => number) => team.reduce((acc, t) => acc + pick(t), 0);
  const leadsAssigned = tot((t) => t.leads.assigned);
  const leadsConverted = tot((t) => t.leads.converted);
  const won = tot((t) => t.deals.won);

  return {
    totals: {
      members: team.length,
      leads: { assigned: leadsAssigned, converted: leadsConverted, conversionRate: pct(leadsConverted, leadsAssigned) },
      deals: {
        total: tot((t) => t.deals.total),
        open: tot((t) => t.deals.open),
        won,
        lost: tot((t) => t.deals.lost),
      },
      revenue: { won: round2(tot((t) => t.revenue.won)), expected: round2(tot((t) => t.revenue.expected)) },
      activities: { pending: tot((t) => t.activities.pending), overdue: tot((t) => t.activities.overdue) },
    },
    members: team,
  };
};