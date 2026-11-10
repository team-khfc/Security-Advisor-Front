import { z } from 'zod';
export const connectionSchema = z.object({
  id: z.string().min(1).max(100),
  sourceSystem: z.string().min(1).max(200),
  sourceAddress: z.string().min(1).max(4000),
  sourceZone: z
    .string()
    .refine(
      (v) => ['외부', 'DMZ', '내부망', '클라우드', '기타'].includes(v),
      '망 구간을 선택해 주세요.',
    ),
  destinationSystem: z.string().min(1).max(200),
  destinationAddress: z.string().min(1).max(4000),
  destinationZone: z
    .string()
    .refine(
      (v) => ['외부', 'DMZ', '내부망', '클라우드', '기타'].includes(v),
      '망 구간을 선택해 주세요.',
    ),
  protocol: z.string().min(1).max(20),
  port: z.string().min(1).max(500),
  purpose: z.string().min(1).max(1000),
  direction: z
    .string()
    .refine((v) => ['인바운드', '아웃바운드', '양방향'].includes(v), '방향을 선택해 주세요.'),
  startDate: z.string(),
  endDate: z.string(),
});
export const infrastructurePlanSchema = z.object({
  revision: z.number(),
  connections: z.array(connectionSchema).max(50),
  notes: z.string(),
  updatedBy: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type InfrastructurePlan = z.infer<typeof infrastructurePlanSchema>;
export type InfraConnection = z.infer<typeof connectionSchema>;
export const INFRA_PRIMARY_KEYS = [
  'system.target_server',
  'network.source',
  'network.destination',
  'network.source_system',
  'network.destination_system',
  'firewall.protocol',
  'firewall.port',
  'firewall.period',
  'firewall.purpose',
  'firewall.direction',
];
