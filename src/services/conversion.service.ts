import mongoose from "mongoose";
import { Lead, Customer, Deal } from "../models";
import {
  LEAD_STATUS, CUSTOMER_STATUS, DEAL_STAGES, ENTITY_TYPES, TIMELINE_ACTIONS,
} from "../constants";
import { ApiError } from "../utils/ApiError";
import { buildAccessScope, Actor } from "../utils/accessScope";
import { andFilters } from "../utils/queryBuilder";
import { logTimeline } from "./timeline.service";
import { ConvertLeadInput } from "../validators/lead.validator";

export const convertLead = async (id: string, input: ConvertLeadInput, actor: Actor) => {
  const scope = await buildAccessScope(actor, { creatorField: "createdBy" });

  // transaction() commits on success, aborts on any throw, retries transient conflicts
  const { customer, deal } = await mongoose.connection.transaction(async (session) => {
    const lead = await Lead.findOne(andFilters({ _id: id }, scope)).session(session);
    if (!lead) throw ApiError.notFound("Lead not found");

    if (lead.status === LEAD_STATUS.CONVERTED || lead.convertedCustomerId) {
      throw ApiError.conflict("Lead has already been converted");
    }
    if (lead.status !== LEAD_STATUS.QUALIFIED) {
      throw ApiError.badRequest("Only Qualified leads can be converted");
    }
    if (!lead.assignedTo) {
      throw ApiError.badRequest("Assign the lead to a sales executive before converting");
    }

    const [customer] = await Customer.create(
      [{
        name: lead.name,
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
        address: input.address,
        leadId: lead._id,
        assignedTo: lead.assignedTo,
        status: CUSTOMER_STATUS.ACTIVE,
        createdBy: actor._id,
      }],
      { session }
    );

    const [deal] = await Deal.create(
      [{
        name: input.dealName ?? `${lead.company || lead.name} - Deal`,
        leadId: lead._id,
        customerId: customer._id,
        assignedTo: lead.assignedTo,
        value: input.value,
        probability: input.probability,
        expectedCloseDate: input.expectedCloseDate,
        stage: DEAL_STAGES.QUALIFICATION,
        description: input.description,
        createdBy: actor._id,
      }],
      { session }
    );

    // atomic claim: only succeeds if nobody converted the lead in the meantime
    const claimed = await Lead.updateOne(
      { _id: lead._id, status: LEAD_STATUS.QUALIFIED, convertedCustomerId: null },
      {
        status: LEAD_STATUS.CONVERTED,
        convertedCustomerId: customer._id,
        convertedDealId: deal._id,
        convertedAt: new Date(),
      },
      { session }
    );
    if (claimed.modifiedCount !== 1) throw ApiError.conflict("Lead has already been converted");

    await logTimeline(
      {
        action: TIMELINE_ACTIONS.LEAD_CONVERTED,
        entityType: ENTITY_TYPES.LEAD,
        entityId: lead._id,
        performedBy: actor._id,
        previousValue: LEAD_STATUS.QUALIFIED,
        newValue: { status: LEAD_STATUS.CONVERTED, customerId: customer.id, dealId: deal.id },
      },
      session
    );
    await logTimeline(
      {
        action: TIMELINE_ACTIONS.CUSTOMER_CREATED,
        entityType: ENTITY_TYPES.CUSTOMER,
        entityId: customer._id,
        performedBy: actor._id,
        newValue: { leadId: lead.id, source: "Lead conversion" },
      },
      session
    );
    await logTimeline(
      {
        action: TIMELINE_ACTIONS.DEAL_CREATED,
        entityType: ENTITY_TYPES.DEAL,
        entityId: deal._id,
        performedBy: actor._id,
        newValue: { value: deal.value, probability: deal.probability, stage: deal.stage, customerId: customer.id },
      },
      session
    );

    return { customer, deal };
  });

  const lead = await Lead.findById(id).populate([
    { path: "assignedTo", select: "name email role" },
    { path: "convertedCustomerId", select: "name email" },
    { path: "convertedDealId", select: "name stage value" },
  ]);
  return { lead, customer, deal };
};