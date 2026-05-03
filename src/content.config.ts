import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

const metricStripSchema = z
  .object({
    primaryMetric: z.string().nullable().optional(),
    direction: z.string().nullable().optional(),
    validationMinDb: z.number().nullable().optional(),
    capTimeMs: z.number().nullable().optional(),
    capRssMb: z.number().nullable().optional(),
    measuredRuns: z.number().nullable().optional(),
    warmupRuns: z.number().nullable().optional(),
  })
  .nullable()
  .optional();

export const collections = {
  docs: defineCollection({
    loader: docsLoader(),
    schema: docsSchema({
      extend: z.object({
        metricStrip: metricStripSchema,
        challengeMonth: z.string().optional(),
        primaryMetric: z.string().optional(),
        direction: z.string().optional(),
      }),
    }),
  }),
};
