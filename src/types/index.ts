import { Timestamp } from 'firebase/firestore';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ObjectiveStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ON_TRACK' | 'WAITING_ON_INPUT' | 'AT_RISK' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
export type NotificationType = 'OVERDUE' | 'STATUS_CHANGE' | 'ASSIGNMENT' | 'SYSTEM';
export type UserRole = 'ADMIN' | 'EXECUTIVE' | 'MANAGER' | 'CONTRIBUTOR';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  groupId?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface Metric {
  label: string;
  baseline: number;
  target: number;
  current: number;
  unit: string;
  externalSource?: 'MANUAL' | 'SAP' | 'KPH_EHS';
  integrationId?: string;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Objective {
  id: string;
  title: string;
  description: string;
  status: ObjectiveStatus;
  priority: Priority;
  assignedToId: string;
  assignedToName: string;
  groupId: string;
  groupName: string;
  startDate: string | Timestamp;
  dueDate: string | Timestamp;
  metrics: Metric[];
  subtasks: Subtask[];
  percentComplete: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completionDate?: Timestamp;
  tags?: string[];
}

export interface ObjectiveUpdate {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
  statusAtTime: ObjectiveStatus;
}

export interface StatusHistoryEntry {
  id: string;
  oldStatus: ObjectiveStatus;
  newStatus: ObjectiveStatus;
  changedBy: string;
  changedByName: string;
  timestamp: Timestamp;
  comment?: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: Timestamp;
  link?: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: Timestamp;
}

export interface Source {
  id: string;
  name: string;
  title?: string;
  content: string;
  type: 'TEXT' | 'FILE';
  fileType?: string;
  url?: string;
  createdAt: Timestamp;
  authorId: string;
  createdBy?: string;
  embedding?: number[];
}

export interface Note {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp;
  timestamp?: string;
  embedding?: number[];
}

export interface TaskFile {
  id: string;
  name: string;
  type: string;
  size: string;
  url: string;
}

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
