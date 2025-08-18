-- Fix the agent_performance_summary view to handle NULL names
CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT 
  p.user_id as agent_id,
  COALESCE(
    NULLIF(TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
    p.email,
    'Unknown Agent'
  ) as agent_name,
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