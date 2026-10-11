import { Schema, model, Types } from "mongoose";
import { CUSTOMER_STATUS, CUSTOMER_STATUS_VALUES, CustomerStatus } from "../constants";

export interface ICustomer {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  address?: { street?: string; city?: string; state?: string; country?: string; zipCode?: string };
  leadId?: Types.ObjectId | null;
  assignedTo: Types.ObjectId;
  status: CustomerStatus;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const customerSchema = new Schema<ICustomer>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    company: { type: String, trim: true, maxlength: 150 },
    address: {
      street: { type: String, trim: true },
      city: { type: String, trim: true },
      state: { type: String, trim: true },
      country: { type: String, trim: true },
      zipCode: { type: String, trim: true },
    },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: CUSTOMER_STATUS_VALUES, default: CUSTOMER_STATUS.ACTIVE },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

customerSchema.index({ email: 1 });
customerSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
customerSchema.index({ leadId: 1 });
customerSchema.index({ createdAt: -1 });
customerSchema.index({ name: "text", email: "text", company: "text" });

export const Customer = model<ICustomer>("Customer", customerSchema);