import { Types } from "mongoose";
import { Customer, Deal, Activity, Timeline } from "../models";
import { ROLES, ENTITY_TYPES, TIMELINE_ACTIONS } from "../constants";
import { ApiError } from "../utils/ApiError";
import { buildAccessScope, Actor } from "../utils/accessScope";
import { paginate, buildSort, searchFilter, dateRangeFilter, andFilters } from "../utils/queryBuilder";
import { assertAssignable } from "./assignment.service";
import { logTimeline, listTimeline } from "./timeline.service";
import {
  CreateCustomerInput, UpdateCustomerInput, ListCustomersQuery,
} from "../validators/customer.validator";
import type { TimelineQuery } from "../validators/lead.validator";

const SORTABLE = ["name", "email", "company", "status", "createdAt", "updatedAt"];
const POPULATE = [
  { path: "assignedTo", select: "name email role" },
  { path: "leadId", select: "name status company" },
];

const findScopedCustomer = async (id: string, actor: Actor) => {
  const customer = await Customer.findOne(andFilters({ _id: id }, await buildAccessScope(actor)));
  if (!customer) throw ApiError.notFound("Customer not found");
  return customer;
};

export const createCustomer = async (input: CreateCustomerInput, actor: Actor) => {
  let assignedTo: Types.ObjectId;

  if (actor.role === ROLES.SALES_EXECUTIVE) {
    if (input.assignedTo && input.assignedTo !== actor.id) {
      throw ApiError.forbidden("Sales Executives cannot assign customers to others");
    }
    assignedTo = actor._id;
  } else {
    if (!input.assignedTo) throw ApiError.badRequest("assignedTo is required");
    assignedTo = (await assertAssignable(actor, input.assignedTo))._id;
  }

  // leadId is only ever set by lead conversion, never by the client
  const customer = await Customer.create({ ...input, assignedTo, leadId: null, createdBy: actor._id });

  await logTimeline({
    action: TIMELINE_ACTIONS.CUSTOMER_CREATED,
    entityType: ENTITY_TYPES.CUSTOMER,
    entityId: customer._id,
    performedBy: actor._id,
    newValue: { name: customer.name, source: "Manual" },
  });
  return customer.populate(POPULATE);
};

export const listCustomers = async (q: ListCustomersQuery, actor: Actor) => {
  const filter = andFilters(
    await buildAccessScope(actor),
    searchFilter(q.search, ["name", "email", "company", "phone"]),
    dateRangeFilter("createdAt", q.dateFrom, q.dateTo),
    q.status ? { status: q.status } : {},
    q.assignedTo ? { assignedTo: q.assignedTo } : {}
  );

  return paginate(Customer, filter, {
    page: q.page,
    limit: q.limit,
    sort: buildSort(q.sortBy, q.order, SORTABLE),
    populate: POPULATE,
  });
};

export const getCustomerById = async (id: string, actor: Actor) => {
  const customer = await findScopedCustomer(id, actor);
  await customer.populate(POPULATE);

  // deals are filtered by the actor's own scope too
  const deals = await Deal.find(andFilters({ customerId: customer._id }, await buildAccessScope(actor)))
    .select("name stage value probability expectedRevenue expectedCloseDate assignedTo")
    .sort({ createdAt: -1 });

  return { ...customer.toJSON(), deals };
};

export const updateCustomer = async (id: string, input: UpdateCustomerInput, actor: Actor) => {
  const customer = await findScopedCustomer(id, actor);
  const { assignedTo, ...rest } = input;

  if (assignedTo !== undefined) {
    customer.assignedTo = (await assertAssignable(actor, assignedTo))._id; 
  }
  customer.set(rest); 
  await customer.save();
  return customer.populate(POPULATE);
};

export const deleteCustomer = async (id: string, actor: Actor) => {
  const customer = await findScopedCustomer(id, actor);
  if (customer.leadId) {
    throw ApiError.conflict("Customers created from a lead cannot be deleted. Set the status to Inactive instead");
  }
  if (await Deal.exists({ customerId: customer._id })) {
    throw ApiError.conflict("Customer has deals and cannot be deleted");
  }
  await Promise.all([
    Activity.deleteMany({ entityType: ENTITY_TYPES.CUSTOMER, entityId: customer._id }),
    Timeline.deleteMany({ entityType: ENTITY_TYPES.CUSTOMER, entityId: customer._id }),
  ]);
  await customer.deleteOne();
};

export const getCustomerTimeline = async (id: string, q: TimelineQuery, actor: Actor) => {
  await findScopedCustomer(id, actor);
  return listTimeline(ENTITY_TYPES.CUSTOMER, id, q);
};