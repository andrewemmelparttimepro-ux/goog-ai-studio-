import { Timestamp } from 'firebase/firestore';

// ===== User & Auth =====
export type UserRole = 'ADMIN' | 'EXECUTIVE' | 'MANAGER' | 'CONTRIBUTOR';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  groupId?: string;
  managerId?: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== Groups =====
export interface Group {
  id: string;
  name: string;
  description?: string;
  createdAt: Timestamp;
}

// ===== Objectives =====
export type Priority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type ObjectiveStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'WAITING_ON_INPUT' | 'AT_RISK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';

export interface Metric {
  label: string;
  baseline: number;
  target: number;
  current: number;
  unit: string;
  integrationId?: string;
  externalSource?: 'KPH_EHS' | 'SAP' | 'MANUAL';
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Objective {
  id: string;
  objectiveNumber?: number;
  title: string;
  description: string;
  groupId: string;
  assignedToId: string;
  initiatedById: string;
  priority: Priority;
  status: ObjectiveStatus;
  startDate: Timestamp | string;
  dueDate: Timestamp | string;
  completionDate?: Timestamp | string;
  percentComplete: number;
  parentId?: string;
  baselineMetric?: number;
  targetMetric?: number;
  metricUnit?: string;
  nextCheckInDate?: Timestamp | string;
  acknowledged: boolean;
  blockerNote?: string;
  nextAction?: string;
  metrics?: Metric[];
  subtasks?: Subtask[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ===== Objective Updates =====
export interface ObjectiveUpdate {
  id: string;
  objectiveId?: string;
  userId?: string;
  authorId?: string;
  authorName: string;
  text: string;
  note?: string;
  percentComplete?: number;
  statusAtTime?: string;
  createdAt: Timestamp;
}

// ===== Status History =====
export interface StatusHistoryEntry {
  id: string;
  objectiveId?: string;
  oldStatus: string;
  previousStatus?: string;
  newStatus: string;
  previousOwner?: string;
  newOwner?: string;
  changedBy: string;
  changedByName: string;
  changedAt?: Timestamp;
  timestamp: Timestamp;
  comment?: string;
}

// ===== Notifications =====
export type NotificationType = 'OVERDUE' | 'STATUS_CHANGE' | 'ASSIGNMENT' | 'SYSTEM';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: Timestamp;
  link?: string;
}

// ===== Sources / Knowledge Base =====
export type SourceType = 'TEXT' | 'FILE';

export interface Source {
  id: string;
  name: string;
  type: SourceType;
  content: string;
  url?: string;
  fileType?: string;
  authorId: string;
  createdAt: Timestamp;
}

// ===== Roadmap =====
export interface TaskNote {
  id: string;
  text: string;
  timestamp: string;
  authorId?: string;
  authorName?: string;
  embedding?: number[];
}

export interface TaskFile {
  id: string;
  name: string;
  type: string;
  size: string;
  url: string;
}

export interface RoadmapTask {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING';
  priority?: Priority;
  description?: string;
  percentComplete?: number;
  notes?: TaskNote[];
  files?: TaskFile[];
}

export interface PersonRoadmap {
  id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  isActive: boolean;
  tasks: RoadmapTask[];
  notes?: TaskNote[];
  files?: TaskFile[];
}

// ===== Chat =====
export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  sender?: string;
  timestamp: Timestamp | string;
}

// ===== AI Service Types =====
export interface RiskAnalysis {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  summary: string;
  recommendations: string[];
  confidence: number;
}

export interface DailyBriefing {
  headline: string;
  summary: string;
  priorityFocus: string;
  newsInsight: string;
  imageSeed: string;
}
