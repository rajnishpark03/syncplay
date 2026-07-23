import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email();

export const requestOtpSchema = z.object({
  email: emailSchema,
});

export const verifyOtpSchema = z.object({
  email: emailSchema,
  code: z.string().length(6),
  device: z.object({
    deviceId: z.string().min(1),
    name: z.string().min(1).max(80),
    platform: z.enum(['ios', 'android', 'web', 'desktop']),
    appVersion: z.string().optional(),
  }),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10),
});

export const trackSchema = z.object({
  id: z.string(),
  mediaType: z.enum(['music', 'video', 'movie']),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  artworkUrl: z.string().url().optional(),
  sourceUrl: z.string().min(1),
  durationMs: z.number().int().nonnegative(),
  provider: z.enum(['direct', 'youtube']).optional(),
});

export type RequestOtpInput = z.infer<typeof requestOtpSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;
export type TrackInput = z.infer<typeof trackSchema>;
