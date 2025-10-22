// API Response Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
  status?: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

// Authentication Types
export interface AuthUser {
  id: string;
  email: string;
  role?: 'admin' | 'agent';
  profile?: UserProfile;
}

export interface UserProfile {
  first_name?: string;
  last_name?: string;
  team_name?: string;
  brokerage?: string;
  phone_number?: string;
  office_address?: string;
  office_number?: string;
  website?: string;
  state_licenses?: string[];
}

// Contact Types
export interface Contact {
  id: string;
  agent_id: string;
  first_name: string | null;
  last_name: string;
  phone: string | null;
  email: string | null;
  address_1: string | null;
  address_2: string | null;
  zip_code: string | null;
  state: string | null;
  city: string | null;
  tags: string[] | null;
  dnc: boolean;
  dnc_last_checked: string | null;
  notes: string | null;
  category: string;
  last_activity_date: string | null;
  activity_count: number;
  created_at: string;
  updated_at: string;
}

export interface ContactInput {
  first_name?: string | null;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  zip_code?: string | null;
  state?: string | null;
  city?: string | null;
  tags?: string[] | null;
  dnc?: boolean;
  notes?: string | null;
}

// Dashboard Types
export interface KPIData {
  value: number;
  deltaPct?: number;
  label?: string;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
  change?: string;
}

export interface AgentDashboardData {
  kpis: {
    totalContacts: KPIData;
    sphereSyncCompletionRate: KPIData;
    upcomingEvents: KPIData;
    newsletterOpenRate: KPIData;
    activeTransactions: KPIData;
    coachingSessions: KPIData;
  };
  charts: {
    leadsTrend: Array<{ month: string; value: number }>;
    tasksTrend: Array<{ month: string; value: number }>;
    transactionsTrend: Array<{ month: string; value: number }>;
  };
}

export interface AdminDashboardData {
  kpis: {
    totalCompanyContacts: KPIData;
    overallTaskCompletion: KPIData;
    totalActiveTransactions: KPIData;
    totalMonthlyRevenue: KPIData;
    companyEventAttendance: KPIData;
    avgNewsletterPerformance: KPIData;
  };
  agentPerformance: Array<{
    agent_id: string;
    agent_name: string;
    email: string;
    totalContacts: number;
    completionRate: number;
    activeTransactions: number;
    lastActivity: string;
  }>;
}

// Metricool Types
export interface MetricoolLink {
  id: string;
  user_id: string;
  iframe_url: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Newsletter Types
export interface NewsletterCampaign {
  id: string;
  created_by: string;
  subject: string;
  content: string;
  status: 'draft' | 'sent' | 'scheduled';
  scheduled_for?: string;
  sent_at?: string;
  open_rate?: number;
  click_rate?: number;
  recipient_count: number;
  created_at: string;
  updated_at: string;
}

export interface NewsletterSettings {
  agent_id: string;
  enabled: boolean;
  schedule_day: number;
  schedule_hour: number;
  template?: string;
}

// Event Types
export interface Event {
  id: string;
  agent_id: string;
  title: string;
  description?: string;
  event_date: string;
  start_time?: string;
  end_time?: string;
  location?: string;
  event_type: string;
  max_attendees?: number;
  current_attendees: number;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  created_at: string;
  updated_at: string;
}

// Task Types
export interface SphereSyncTask {
  id: string;
  agent_id: string;
  contact_id: string;
  contact_name: string;
  task_type: 'call' | 'text';
  category: string;
  week_number: number;
  year: number;
  completed: boolean;
  completed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Transaction Types
export interface Transaction {
  id: string;
  responsible_agent: string;
  client_name: string;
  property_address: string;
  transaction_type: 'sale' | 'purchase' | 'rental';
  status: 'active' | 'pending' | 'closed' | 'cancelled';
  price?: number;
  commission?: number;
  created_at: string;
  updated_at: string;
}

// DNC Types
export interface DNCCheckResult {
  isDNC: boolean;
  checkedAt: string;
  error?: string;
}

export interface DNCStats {
  totalContacts: number;
  dncContacts: number;
  nonDncContacts: number;
  neverChecked: number;
  lastCheckDate?: string;
}

// Social Media Types
export interface SocialPost {
  id: string;
  agent_id: string;
  content: string;
  platforms: string[];
  media_url?: string;
  scheduled_time?: string;
  posted_time?: string;
  status: 'draft' | 'scheduled' | 'posted' | 'failed';
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
  };
  created_at: string;
  updated_at: string;
}

// Form Types
export interface FormField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'select' | 'textarea' | 'checkbox' | 'date';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    custom?: (value: any) => string | null;
  };
}

export interface FormData {
  [key: string]: any;
}

export interface FormErrors {
  [key: string]: string;
}

// Component Props Types
export interface BaseComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export interface TableColumn<T = any> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  render?: (value: any, item: T) => React.ReactNode;
  width?: string;
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Error Types
export interface AppError {
  code: string;
  message: string;
  details?: any;
  timestamp: string;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

// API Hook Types
export interface UseQueryOptions<T = any> {
  enabled?: boolean;
  refetchOnWindowFocus?: boolean;
  refetchOnMount?: boolean;
  staleTime?: number;
  cacheTime?: number;
  retry?: boolean | number;
  retryDelay?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export interface UseMutationOptions<TData = any, TVariables = any> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
}
