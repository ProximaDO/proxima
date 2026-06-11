import { z } from "zod";

export const createMarketSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().max(2000).optional(),
  category: z.string().max(50).optional(),
  opens_at: z.string().optional(),
  closes_at: z.string().optional(),
  liquidity_b: z.coerce.number().positive().default(100),
  fee_bps: z.coerce.number().int().min(0).max(10000).default(0),
  options: z
    .array(z.string().min(1).max(100))
    .min(2, "Se requieren al menos 2 opciones")
    .max(10, "Maximo 10 opciones"),
});

export const updateMarketSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  description: z.string().max(2000).optional(),
  category: z.string().max(50).optional(),
  opens_at: z.string().optional(),
  closes_at: z.string().optional(),
  liquidity_b: z.coerce.number().positive().optional(),
  fee_bps: z.coerce.number().int().min(0).max(10000).optional(),
  status: z.enum(["draft", "open", "closed", "archived"]).optional(),
});

export type CreateMarketInput = z.infer<typeof createMarketSchema>;
export type UpdateMarketInput = z.infer<typeof updateMarketSchema>;
