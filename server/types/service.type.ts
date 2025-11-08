export type ServiceType = {
  id: number;
  name: string;
  description: string;
  type: number; // 1: server, 2: vps, 3: shared hosting
  status: number; // 0: inactive, 1: active
  resStatusApiUrl: string;
  resStatusApiKey: string;
  createdAt: string;
  updatedAt: string;
};

export type ServiceLogType = {
  id: number;
  serviceId: number;
  data: Record<string, unknown> | SharedHostingHistoryData | VpsHistoryData; // JSON data from the log
  recordId: number;
  recordedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type SharedHostingHistoryData = {
  id: number;
  base_path: string;
  file_count: number;
  disk_usage_mb: number;
  available_inode: number;
  available_space_mb: number;
  checked_at: string;
};

export type SharedHostingHistoryMeta = {
  base_path: string;
  days: number;
  start_date: string;
  end_date: string;
  total_records: number;
};

export type SharedHostingHistoryResponse = {
  success: boolean;
  data: SharedHostingHistoryData[];
  meta: SharedHostingHistoryMeta;
};

export type VpsHistoryData = {
  id: number;
  cpu_usage: number;
  memory_used_mb: number;
  memory_total_mb: number;
  disk_used_mb: number;
  disk_total_mb: number;
  created_at: string;
};

export type VpsHistoryMeta = {
  days: number;
  start_date: string;
  end_date: string;
  total_records: number;
};

export type VpsHistoryResponse = {
  success: boolean;
  data: VpsHistoryData[];
  meta: VpsHistoryMeta;
};

export type ServiceTypeLabels = {
  [key: number]: string;
};

export enum SERVICE_TYPE {
  SERVER = 1,
  VPS = 2,
  SHARED_HOSTING = 3,
}

export enum SERVICE_STATUS {
  INACTIVE = 0,
  ACTIVE = 1,
}

export const SERVICE_TYPE_LABELS: ServiceTypeLabels = {
  [SERVICE_TYPE.SERVER]: 'Server',
  [SERVICE_TYPE.VPS]: 'VPS',
  [SERVICE_TYPE.SHARED_HOSTING]: 'Shared Hosting',
};

export const SERVICE_STATUS_LABELS: ServiceTypeLabels = {
  [SERVICE_STATUS.INACTIVE]: 'Inactive',
  [SERVICE_STATUS.ACTIVE]: 'Active',
};

export const SERVICE_TYPE_OPTIONS = [
  { value: SERVICE_TYPE.SERVER, label: 'Server' },
  { value: SERVICE_TYPE.VPS, label: 'VPS' },
  { value: SERVICE_TYPE.SHARED_HOSTING, label: 'Shared Hosting' },
];

export const SERVICE_STATUS_OPTIONS = [
  { value: SERVICE_STATUS.ACTIVE, label: 'Active' },
  { value: SERVICE_STATUS.INACTIVE, label: 'Inactive' },
];
