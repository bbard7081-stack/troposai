
export enum ColumnType {
  TEXT = 'TEXT',
  NUMBER = 'NUMBER',
  DATE = 'DATE',
  CURRENCY = 'CURRENCY',
  DROPDOWN = 'DROPDOWN',
  MULTI_SELECT = 'MULTI_SELECT',
  CHECKBOX = 'CHECKBOX',
  PROGRESS = 'PROGRESS'
}

export interface Column {
  id: string;
  title: string;
  type: ColumnType;
  options?: string[]; // For dropdowns and multi-select
  width?: number;
}

export interface ClientData {
  id: string;
  assignedTo: string; // Email of the user
  missedCall?: boolean;
  declinedCall?: boolean;
  cellHistory?: Record<string, any[]>;
  interactionLogs?: string;
  lastCallAt?: string;
  [key: string]: any;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
  ringCentralEmail?: string;
  extensionNumber?: string;
  lastSynced?: string;
  lastInvited?: string;
  role: 'ADMIN' | 'USER';
  team?: string;
  status: 'ACTIVE' | 'INVITED' | 'Enabled';
  password?: string;
}

export interface FilterRule {
  columnId: string;
  operator: 'equals' | 'contains' | 'greater' | 'less';
  value: any;
  logic: 'AND' | 'OR';
}

export interface SavedReport {
  id: string;
  name: string;
  filters: FilterRule[];
  columnOrder: string[];
  createdBy: string;
  sharedWith: string[]; // List of user emails or 'ALL'
}

export interface ChatMessage {
  id: string;
  senderEmail: string;
  receiverEmail: string;
  content: string;
  timestamp: string;
  taggedRowId?: string;
}

export interface Automation {
  id: string;
  name: string;
  trigger: {
    type: 'CELL_CHANGE' | 'NEW_ROW';
    columnId?: string;
    value?: any;
  };
  action: {
    type: 'UPDATE_CELL' | 'ASSIGN_USER' | 'SEND_NOTIFICATION';
    columnId?: string;
    value?: any;
    userEmail?: string;
  };
  enabled: boolean;
  createdAt: string;
}

export interface SystemHistoryPoint {
  timestamp: string;
  cpu: number;
  memory: number;
}

export interface SystemHistoryResponse {
  history: SystemHistoryPoint[];
}

export interface AppCallLog {
  id: string;
  contact_id?: string;
  user_id: string;
  direction: 'Inbound' | 'Outbound';
  duration: number;
  status: string;
  disposition?: string;
  recording_url?: string;
  notes?: string;
  created_at: string;
}

export interface Unit {
  id: string;
  contactId: string;
  type: string;
  status: 'ACTIVE' | 'VOIDED';
  date: string;
  data: any;
  createdBy: string;
  createdAt: string;
  correctionOfId?: string;
}

export interface SMSLog {
  id: string;
  contactId?: string;
  userId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  body: string;
  status: 'sent' | 'delivered' | 'failed';
  fromNumber: string;
  toNumber: string;
  createdAt: string;
}

export interface VoicemailLog {
  id: string;
  contactId?: string;
  userId: string;
  duration: number;
  audioUrl?: string;
  transcript?: string;
  fromNumber: string;
  createdAt: string;
}

export interface CommunicationEvent {
  id: string;
  type: 'call' | 'sms' | 'voicemail';
  contactId?: string;
  userId: string;
  timestamp: string;
  data: AppCallLog | SMSLog | VoicemailLog;
}

