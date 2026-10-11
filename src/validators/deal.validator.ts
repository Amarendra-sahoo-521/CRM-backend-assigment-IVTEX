import { z } from "zod";
import { DEAL_STAGE_VALUES, DEAL_STAGES } from "../constants";
import { objectId, zEnum, listQuerySchema, dateString } from "./common";


const startOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
};


export const dealValue = z.number().positive("Deal value must be greater than zero").max(1_000_000_000_000);
export const dealProbability = z.number().min(0, "Probability must be 0-100").max(100, "Probability must be 0-100");
export const futureDate = z.coerce
    .date()
    .refine((d) => d.getTime() >= startOfToday(), "Expected close date cannot be in the past");

export const createDealSchema = z.object({
    name: z.string().trim().min(2).max(150),
    customerId: objectId,
    value: dealValue,
    probability: dealProbability,
    expectedCloseDate: futureDate,
    description: z.string().trim().max(2000).optional(),
    assignedTo: objectId.optional(),
});

export const updateDealSchema = z
    .object({
        name: z.string().trim().min(2).max(150),
        value: dealValue,
        probability: dealProbability,
        expectedCloseDate: futureDate,
        description: z.string().trim().max(2000),
    })
    .partial()
    .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

export const dealStageSchema = z
    .object({
        stage: zEnum(DEAL_STAGE_VALUES),
        probability: dealProbability.optional(),
        lostReason: z.string().trim().min(5, "Lost reason must be at least 5 characters").max(500).optional(),
    })
    .refine((v) => v.stage !== DEAL_STAGES.LOST || !!v.lostReason, {
        message: "A lost reason is required when a deal is Lost",
        path: ["lostReason"],
    });

export const assignDealSchema = z.object({ assignedTo: objectId });

export const listDealsQuerySchema = listQuerySchema.extend({
    stage: zEnum(DEAL_STAGE_VALUES).optional(),
    status: z.enum(["open", "won", "lost"]).optional(),
    assignedTo: objectId.optional(),
    customerId: objectId.optional(),
    minAmount: z.coerce.number().min(0).optional(),
    maxAmount: z.coerce.number().min(0).optional(),
    closeDateFrom: dateString.optional(),
    closeDateTo: dateString.optional(),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type DealStageInput = z.infer<typeof dealStageSchema>;
export type ListDealsQuery = z.infer<typeof listDealsQuerySchema>;