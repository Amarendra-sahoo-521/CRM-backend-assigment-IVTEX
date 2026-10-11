import mongoose, { Types } from "mongoose";
import { connectDB } from "../config/db";
import { isProd } from "../config/env";
import { User, Lead } from "../models";
import { ROLES, LEAD_STATUS, DEAL_STAGES, LeadSource, Priority, Role } from "../constants";
import type { Actor } from "../utils/accessScope";
import * as leadService from "../services/lead.service";
import * as conversion from "../services/conversion.service";
import * as dealService from "../services/deal.service";
import * as activityService from "../services/activity.service";

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000);

const upsertUser = async (data: {
  name: string; email: string; password: string; role: Role; managerId?: Types.ObjectId;
}) => (await User.findOne({ email: data.email })) ?? User.create(data);

const newLead = (
  actor: Actor,
  name: string,
  company: string,
  opts: { priority?: Priority; source?: LeadSource } = {}
) =>
  leadService.createLead(
    {
      name,
      email: `${name.toLowerCase().replace(/\s+/g, ".")}@${company.toLowerCase().replace(/\s+/g, "")}.com`,
      phone: "+91 98765 43210",
      company,
      source: opts.source ?? "Website",
      priority: opts.priority ?? "Medium",
    },
    actor
  );

const qualifyAndConvert = async (actor: Actor, leadId: string, value: number, probability: number, days: number) => {
  await leadService.updateLeadStatus(leadId, LEAD_STATUS.QUALIFIED, actor);
  return conversion.convertLead(leadId, { value, probability, expectedCloseDate: inDays(days) }, actor);
};

const run = async () => {
  const reset = process.argv.includes("--reset");
  if (reset && isProd) throw new Error("Refusing to reset a production database");

  await connectDB();

  if (reset) {
    await Promise.all(Object.values(mongoose.connection.models).map((m) => m.deleteMany({})));
    console.log("All collections cleared");
  }

  // ---- users (idempotent) ----
  const pwd = "Password@123";
  const admin = await upsertUser({ name: "Super Admin", email: "admin@crm.com", password: "Admin@1234", role: ROLES.ADMIN });
  const maya = await upsertUser({ name: "Maya Manager", email: "maya@crm.com", password: pwd, role: ROLES.SALES_MANAGER });
  const neha = await upsertUser({ name: "Neha Manager", email: "neha@crm.com", password: pwd, role: ROLES.SALES_MANAGER });
  const eli = await upsertUser({ name: "Eli Executive", email: "eli@crm.com", password: pwd, role: ROLES.SALES_EXECUTIVE, managerId: maya._id });
  const ravi = await upsertUser({ name: "Ravi Executive", email: "ravi@crm.com", password: pwd, role: ROLES.SALES_EXECUTIVE, managerId: maya._id });
  const tara = await upsertUser({ name: "Tara Executive", email: "tara@crm.com", password: pwd, role: ROLES.SALES_EXECUTIVE, managerId: neha._id });

  if (await Lead.exists({})) {
    console.log("Sample data already exists, skipping (run `npm run seed:reset` to start fresh)");
    return;
  }

  // ---- Eli: open, won and in-progress work ----
  const acme = await newLead(eli, "Arjun Mehta", "Acme Corp", { priority: "High", source: "Referral" });
  const acmeDeal = (await qualifyAndConvert(eli, acme.id, 50000, 40, 45)).deal;
  await dealService.updateDealStage(acmeDeal.id, { stage: DEAL_STAGES.PROPOSAL, probability: 60 }, eli);

  const globex = await newLead(eli, "Priya Nair", "Globex", { priority: "High" });
  const globexDeal = (await qualifyAndConvert(eli, globex.id, 120000, 70, 20)).deal;
  await dealService.updateDealStage(globexDeal.id, { stage: DEAL_STAGES.WON }, eli);

  const initech = await newLead(eli, "Kiran Das", "Initech", { source: "Email" });
  await leadService.updateLeadStatus(initech.id, LEAD_STATUS.CONTACTED, eli);

  await activityService.createActivity(
    { type: "Follow-up", title: "Send revised quote", dueDate: inDays(-3), entityType: "Lead", entityId: initech.id },
    eli
  );
  await activityService.createActivity(
    { type: "Call", title: "Intro call", dueDate: inDays(2), entityType: "Lead", entityId: initech.id },
    eli
  );
  await activityService.createActivity(
    { type: "Note", title: "Prefers email over phone", entityType: "Lead", entityId: initech.id },
    eli
  );

  // ---- Ravi: a lost deal, a new lead, an unqualified lead ----
  const umbrella = await newLead(ravi, "Sanjay Rao", "Umbrella", { source: "Social Media" });
  const umbrellaDeal = (await qualifyAndConvert(ravi, umbrella.id, 30000, 30, 30)).deal;
  await dealService.updateDealStage(umbrellaDeal.id, { stage: DEAL_STAGES.LOST, lostReason: "Chose a competitor" }, ravi);

  const hooli = await newLead(ravi, "Meera Iyer", "Hooli");
  const stark = await newLead(ravi, "Vikram Sen", "Stark Industries", { priority: "Low" });
  await leadService.updateLeadStatus(stark.id, LEAD_STATUS.UNQUALIFIED, ravi);
  await activityService.createActivity(
    { type: "Meeting", title: "Discovery meeting", dueDate: inDays(-1), entityType: "Lead", entityId: hooli.id },
    ravi
  );

  // ---- Tara (Neha's team) ----
  const wayne = await newLead(tara, "Anita Roy", "Wayne Enterprises", { priority: "High" });
  const wayneDeal = (await qualifyAndConvert(tara, wayne.id, 85000, 55, 60)).deal;
  await dealService.updateDealStage(wayneDeal.id, { stage: DEAL_STAGES.NEGOTIATION, probability: 70 }, tara);

  const piper = await newLead(tara, "Rohit Jain", "Pied Piper");
  await activityService.createActivity(
    { type: "Demo", title: "Product demo", dueDate: inDays(5), entityType: "Lead", entityId: piper.id },
    tara
  );

  // ---- Admin / manager workflows: assign, reassign, unassigned ----
  const cyber = await newLead(admin, "Deepa Menon", "Cyberdyne");
  await leadService.assignLead(cyber.id, ravi.id, admin);
  await leadService.assignLead(cyber.id, eli.id, maya); // reassign by manager
  await newLead(admin, "Unassigned Prospect", "Soylent"); // stays unassigned

  await activityService.createActivity(
    { type: "Reminder", title: "Review Acme proposal", dueDate: inDays(1), assignedTo: eli.id, entityType: "Deal", entityId: acmeDeal.id },
    maya
  );

  console.log("\nSeed complete\n");
  console.table([
    { role: "Admin", email: "admin@crm.com", password: "Admin@1234" },
    { role: "Manager", email: "maya@crm.com / neha@crm.com", password: pwd },
    { role: "Executive", email: "eli@ / ravi@ (Maya), tara@ (Neha) @crm.com", password: pwd },
  ]);
};

run()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());