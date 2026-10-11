import { Schema, model, Types } from "mongoose";
import {
  LEAD_SOURCE_VALUES, LEAD_STATUS_VALUES, PRIORITY_VALUES,
  LEAD_SOURCES, LEAD_STATUS, PRIORITY,
  LeadSource, LeadStatus, Priority,
} from "../constants";

export interface ILead {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  source: LeadSource;
  status: LeadStatus;
  priority: Priority;
  assignedTo?: Types.ObjectId | null;
  description?: string;
  convertedCustomerId?: Types.ObjectId | null;
  convertedDealId?: Types.ObjectId | null;
  convertedAt?: Date | null;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true, maxlength: 150 },
    source: { type: String, enum: LEAD_SOURCE_VALUES, default: LEAD_SOURCES.OTHER },
    status: { type: String, enum: LEAD_STATUS_VALUES, default: LEAD_STATUS.NEW },
    priority: { type: String, enum: PRIORITY_VALUES, default: PRIORITY.MEDIUM },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    description: { type: String, trim: true, maxlength: 2000 },
    convertedCustomerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    convertedDealId: { type: Schema.Types.ObjectId, ref: "Deal", default: null },
    convertedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

leadSchema.index({ email: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ source: 1 });
leadSchema.index({ priority: 1 });
leadSchema.index({ assignedTo: 1, status: 1, createdAt: -1 }); // scoped list + filter
leadSchema.index({ createdAt: -1 });
leadSchema.index({ name: "text", email: "text", company: "text", phone: "text" });

export const Lead = model<ILead>("Lead", leadSchema);