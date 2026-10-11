import { Schema, model, Types } from "mongoose";
import { TIMELINE_ACTION_VALUES, ENTITY_TYPE_VALUES, TimelineAction, EntityType } from "../constants";

export interface ITimeline {
  action: TimelineAction;
  entityType: EntityType;
  entityId: Types.ObjectId;
  performedBy: Types.ObjectId;
  previousValue?: unknown;
  newValue?: unknown;
  createdAt: Date;
}

const timelineSchema = new Schema<ITimeline>(
  {
    action: { type: String, enum: TIMELINE_ACTION_VALUES, required: true },
    entityType: { type: String, enum: ENTITY_TYPE_VALUES, required: true },
    entityId: { type: Schema.Types.ObjectId, required: true, refPath: "entityType" },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    previousValue: { type: Schema.Types.Mixed },
    newValue: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } } // audit entries are immutable
);

timelineSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
timelineSchema.index({ performedBy: 1, createdAt: -1 });

export const Timeline = model<ITimeline>("Timeline", timelineSchema);