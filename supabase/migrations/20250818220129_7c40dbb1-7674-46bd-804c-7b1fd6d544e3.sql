-- Create database views for admin analytics
CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT 
  p.user_id as agent_id,
  p.first_name || ' ' || p.last_name as agent_name,
  p.email,
  
  -- Contact metrics
  COUNT(DISTINCT c.id) as total_contacts,
  COUNT(DISTINCT CASE WHEN c.created_at >= date_trunc('month', CURRENT_DATE) THEN c.id END) as contacts_this_month,
  
  -- PO2 Task metrics
  COUNT(DISTINCT po2.id) as total_tasks,
  COUNT(DISTINCT CASE WHEN po2.completed = true THEN po2.id END) as completed_tasks,
  ROUND(
    CASE 
      WHEN COUNT(DISTINCT po2.id) > 0 
      THEN (COUNT(DISTINCT CASE WHEN po2.completed = true THEN po2.id END)::numeric / COUNT(DISTINCT po2.id)::numeric) * 100 
      ELSE 0 
    END, 1
  ) as completion_rate,
  
  -- Transaction metrics
  COUNT(DISTINCT tc.id) as total_transactions,
  COUNT(DISTINCT CASE WHEN tc.transaction_stage != 'closed' THEN tc.id END) as active_transactions,
  COALESCE(SUM(tc.gci), 0) as total_gci,
  
  -- Event metrics
  COUNT(DISTINCT e.id) as total_events,
  COUNT(DISTINCT CASE WHEN e.event_date >= CURRENT_DATE THEN e.id END) as upcoming_events,
  
  -- Coaching metrics
  COUNT(DISTINCT cs.id) as coaching_sessions,
  
  p.created_at as agent_since

FROM profiles p
LEFT JOIN contacts c ON c.agent_id = p.user_id
LEFT JOIN po2_tasks po2 ON po2.agent_id = p.user_id
LEFT JOIN transaction_coordination tc ON tc.responsible_agent = p.user_id
LEFT JOIN events e ON e.agent_id = p.user_id
LEFT JOIN coaching_sessions cs ON cs.agent_id = p.user_id
WHERE p.role = 'agent'
GROUP BY p.user_id, p.first_name, p.last_name, p.email, p.created_at;

-- Create monthly business metrics view
CREATE OR REPLACE VIEW monthly_business_metrics AS
SELECT 
  DATE_TRUNC('month', month_date) as period,
  
  -- Contact metrics
  (SELECT COUNT(*) FROM contacts WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', month_date)) as new_contacts,
  (SELECT COUNT(*) FROM contacts WHERE created_at <= month_date) as total_contacts_cumulative,
  
  -- Task metrics
  (SELECT COUNT(*) FROM po2_tasks WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', month_date)) as tasks_created,
  (SELECT COUNT(*) FROM po2_tasks WHERE DATE_TRUNC('month', completed_at) = DATE_TRUNC('month', month_date) AND completed = true) as tasks_completed,
  
  -- Transaction metrics
  (SELECT COUNT(*) FROM transaction_coordination WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', month_date)) as new_transactions,
  (SELECT COALESCE(SUM(gci), 0) FROM transaction_coordination WHERE DATE_TRUNC('month', created_at) = DATE_TRUNC('month', month_date)) as monthly_gci,
  
  -- Event metrics
  (SELECT COUNT(*) FROM events WHERE DATE_TRUNC('month', event_date) = DATE_TRUNC('month', month_date)) as events_held,
  (SELECT COALESCE(AVG(attendance_count), 0) FROM events WHERE DATE_TRUNC('month', event_date) = DATE_TRUNC('month', month_date)) as avg_attendance,
  
  -- Newsletter metrics
  (SELECT COUNT(*) FROM newsletter_campaigns WHERE DATE_TRUNC('month', send_date) = DATE_TRUNC('month', month_date)) as newsletters_sent,
  (SELECT COALESCE(AVG(open_rate), 0) FROM newsletter_campaigns WHERE DATE_TRUNC('month', send_date) = DATE_TRUNC('month', month_date)) as avg_open_rate

FROM (
  SELECT generate_series(
    date_trunc('month', CURRENT_DATE - interval '11 months'),
    date_trunc('month', CURRENT_DATE),
    interval '1 month'
  ) as month_date
) months;

-- Create function to get current user role (if not exists)
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid();
$$;