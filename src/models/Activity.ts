import { Schema, model, Types } from "mongoose";
import {
  ACTIVITY_TYPE_VALUES, ACTIVITY_STATUS_VALUES, ACTIVITY_ENTITY_VALUES, ACTIVITY_STATUS,
  ActivityType, ActivityStatus, EntityType,
} from "../constants";

export interface IActivity {
  type: ActivityType;
  title: string;
  description?: string;
  assignedTo: Types.ObjectId;
  dueDate: Date;
  status: ActivityStatus;
  entityType?: EntityType;
  entityId?: Types.ObjectId;
  createdBy: Types.ObjectId;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const activitySchema = new Schema<IActivity>(
  {
    type: { type: String, enum: ACTIVITY_TYPE_VALUES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: ACTIVITY_STATUS_VALUES, default: ACTIVITY_STATUS.PENDING },
    entityType: { type: String, enum: ACTIVITY_ENTITY_VALUES },
    entityId: { type: Schema.Types.ObjectId, refPath: "entityType" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// Overdue is derived, never trusted from storage.
activitySchema.virtual("isOverdue").get(function () {
  return this.status === ACTIVITY_STATUS.PENDING && this.dueDate.getTime() < Date.now();
});
activitySchema.virtual("effectiveStatus").get(function () {
  return this.status === ACTIVITY_STATUS.PENDING && this.dueDate.getTime() < Date.now()
    ? ACTIVITY_STATUS.OVERDUE
    : this.status;
});

activitySchema.index({ assignedTo: 1, status: 1, dueDate: 1 });
activitySchema.index({ dueDate: 1 });
activitySchema.index({ entityType: 1, entityId: 1 });
activitySchema.index({ createdAt: -1 });

export const Activity = model<IActivity>("Activity", activitySchema);