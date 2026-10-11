import { Schema, model, Types } from "mongoose";
import { DEAL_STAGE_VALUES, DEAL_STAGES, DealStage } from "../constants";

export interface IDeal {
  name: string;
  leadId?: Types.ObjectId | null;
  customerId: Types.ObjectId;
  assignedTo: Types.ObjectId;
  value: number;
  probability: number;
  expectedRevenue: number;
  expectedCloseDate: Date;
  stage: DealStage;
  lostReason?: string;
  closedAt?: Date | null;
  description?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const dealSchema = new Schema<IDeal>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", default: null },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", required: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    value: {
      type: Number,
      required: true,
      validate: { validator: (v: number) => v > 0, message: "Deal value must be greater than zero" },
    },
    probability: { type: Number, required: true, min: [0, "Probability must be 0-100"], max: [100, "Probability must be 0-100"] },
    expectedRevenue: { type: Number, default: 0 }, // always computed server-side
    expectedCloseDate: { type: Date, required: true },
    stage: { type: String, enum: DEAL_STAGE_VALUES, default: DEAL_STAGES.QUALIFICATION },
    lostReason: { type: String, trim: true, maxlength: 500 },
    closedAt: { type: Date, default: null },
    description: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Enforce business rules at the model level (runs on create + doc.save()).
dealSchema.pre("validate", function () {
  this.expectedRevenue = Number(((this.value * this.probability) / 100).toFixed(2));

  if (this.stage === DEAL_STAGES.LOST && !this.lostReason?.trim()) {
    this.invalidate("lostReason", "A lost reason is required when a deal is Lost");
  }
  if (this.stage === DEAL_STAGES.WON) this.probability = 100;
  if (this.stage === DEAL_STAGES.LOST) this.probability = 0;
});

dealSchema.index({ stage: 1 });
dealSchema.index({ assignedTo: 1, stage: 1, createdAt: -1 });
dealSchema.index({ customerId: 1 });
dealSchema.index({ leadId: 1 });
dealSchema.index({ expectedCloseDate: 1 });
dealSchema.index({ createdAt: -1 });
dealSchema.index({ name: "text", description: "text" });

export const Deal = model<IDeal>("Deal", dealSchema);