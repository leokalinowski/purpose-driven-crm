import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/integrations/supabase/client'
import { Mail, Phone, MessageSquare, CheckCircle2, XCircle, Clock, TrendingUp, Users } from 'lucide-react'
// Format date helper function
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  } catch {
    return dateString
  }
}
import { Skeleton } from '@/components/ui/skeleton'

interface EmailLog {
  id: string
  agent_id: string
  week_number: number
  year: number
  sent_at: string
  task_count: number
  agent_name?: string
  agent_email?: string
}

interface TaskStats {
  agent_id: string
  agent_name: string
  week_number: number
  year: number
  total_tasks: number
  completed_tasks: number
  call_tasks: number
  text_tasks: number
  completion_rate: number
}

interface WeeklySummary {
  week_number: number
  year: number
  emails_sent: number
  total_agents: number
  total_tasks: number
  total_completed: number
  completion_rate: number
}

export const SphereSyncAccountability: React.FC = () => {
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([])
  const [taskStats, setTaskStats] = useState<TaskStats[]>([])
  const [weeklySummaries, setWeeklySummaries] = useState<WeeklySummary[]>([])
  const [selectedWeek, setSelectedWeek] = useState<string>('current')
  const [loading, setLoading] = useState(true)
  const [currentWeek, setCurrentWeek] = useState(0)
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

  // Calculate current week number
  useEffect(() => {
    const getCurrentWeekNumber = (date: Date = new Date()): number => {
      const start = new Date(date.getFullYear(), 0, 1)
      const startDay = start.getDay()
      const daysSinceStart = Math.floor((date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      const adjustedDays = daysSinceStart + (startDay === 0 ? 6 : startDay - 1)
      const weekNumber = Math.ceil((adjustedDays + 1) / 7)
      return Math.min(Math.max(weekNumber, 1), 52)
    }
    
    const week = getCurrentWeekNumber()
    const year = new Date().getFullYear()
    setCurrentWeek(week)
    setCurrentYear(year)
  }, [])

  useEffect(() => {
    fetchData()
  }, [selectedWeek, currentWeek, currentYear])

  const fetchData = async () => {
    setLoading(true)
    try {
      const weekToFetch = selectedWeek === 'current' ? currentWeek : parseInt(selectedWeek)
      const yearToFetch = currentYear

      // Fetch email logs
      const { data: logs, error: logsError } = await supabase
        .from('spheresync_email_logs')
        .select('*')
        .eq('year', yearToFetch)
        .order('sent_at', { ascending: false })

      if (logsError) throw logsError

      // Fetch agent profiles separately to avoid relationship query issues
      const agentIds = [...new Set((logs || []).map(log => log.agent_id))]
      let profilesMap: Record<string, { first_name?: string; last_name?: string; email?: string }> = {}

      if (agentIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', agentIds)

        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = p
            return acc
          }, {} as Record<string, { first_name?: string; last_name?: string; email?: string }>)
        }
      }

      const formattedLogs: EmailLog[] = (logs || []).map(log => {
        const profile = profilesMap[log.agent_id]
        return {
          id: log.id,
          agent_id: log.agent_id,
          week_number: log.week_number,
          year: log.year,
          sent_at: log.sent_at,
          task_count: log.task_count,
          agent_name: profile
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
            : 'Unknown',
          agent_email: profile?.email || ''
        }
      })

      setEmailLogs(formattedLogs)

      // Fetch task statistics for all agents
      const { data: tasks, error: tasksError } = await supabase
        .from('spheresync_tasks')
        .select('agent_id, task_type, completed, week_number, year')
        .eq('year', yearToFetch)

      if (tasksError) throw tasksError

      // Get unique agent IDs from tasks
      const taskAgentIds = [...new Set((tasks || []).map(task => task.agent_id))]
      let taskProfilesMap: Record<string, { first_name?: string; last_name?: string }> = {}

      if (taskAgentIds.length > 0) {
        const { data: taskProfiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name')
          .in('user_id', taskAgentIds)

        if (taskProfiles) {
          taskProfilesMap = taskProfiles.reduce((acc, p) => {
            acc[p.user_id] = p
            return acc
          }, {} as Record<string, { first_name?: string; last_name?: string }>)
        }
      }

      // Calculate stats per agent per week
      const statsMap = new Map<string, TaskStats>()
      
      tasks?.forEach(task => {
        const key = `${task.agent_id}_${task.week_number}`
        if (!statsMap.has(key)) {
          const profile = taskProfilesMap[task.agent_id]
          const agentName = profile
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Unknown'
            : 'Unknown'
          statsMap.set(key, {
            agent_id: task.agent_id,
            agent_name: agentName,
            week_number: task.week_number,
            year: task.year,
            total_tasks: 0,
            completed_tasks: 0,
            call_tasks: 0,
            text_tasks: 0,
            completion_rate: 0
          })
        }

        const stat = statsMap.get(key)!
        stat.total_tasks++
        if (task.completed) stat.completed_tasks++
        if (task.task_type === 'call') stat.call_tasks++
        if (task.task_type === 'text') stat.text_tasks++
      })

      // Calculate completion rates
      const stats: TaskStats[] = Array.from(statsMap.values()).map(stat => ({
        ...stat,
        completion_rate: stat.total_tasks > 0 
          ? Math.round((stat.completed_tasks / stat.total_tasks) * 100) 
          : 0
      }))

      setTaskStats(stats)

      // Calculate weekly summaries
      const summaryMap = new Map<string, WeeklySummary>()
      
      formattedLogs.forEach(log => {
        const key = `${log.week_number}_${log.year}`
        if (!summaryMap.has(key)) {
          summaryMap.set(key, {
            week_number: log.week_number,
            year: log.year,
            emails_sent: 0,
            total_agents: 0,
            total_tasks: 0,
            total_completed: 0,
            completion_rate: 0
          })
        }
        const summary = summaryMap.get(key)!
        summary.emails_sent++
        summary.total_agents++
      })

      // Add task data to summaries
      stats.forEach(stat => {
        const key = `${stat.week_number}_${stat.year}`
        if (summaryMap.has(key)) {
          const summary = summaryMap.get(key)!
          summary.total_tasks += stat.total_tasks
          summary.total_completed += stat.completed_tasks
        }
      })

      // Calculate completion rates
      const summaries: WeeklySummary[] = Array.from(summaryMap.values())
        .map(summary => ({
          ...summary,
          completion_rate: summary.total_tasks > 0
            ? Math.round((summary.total_completed / summary.total_tasks) * 100)
            : 0
        }))
        .sort((a, b) => {
          if (a.year !== b.year) return b.year - a.year
          return b.week_number - a.week_number
        })

      setWeeklySummaries(summaries)

    } catch (error) {
      console.error('Error fetching SphereSync accountability data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredEmailLogs = selectedWeek === 'current' 
    ? emailLogs.filter(log => log.week_number === currentWeek && log.year === currentYear)
    : emailLogs.filter(log => log.week_number === parseInt(selectedWeek) && log.year === currentYear)

  const filteredTaskStats = selectedWeek === 'current'
    ? taskStats.filter(stat => stat.week_number === currentWeek && stat.year === currentYear)
    : taskStats.filter(stat => stat.week_number === parseInt(selectedWeek) && stat.year === currentYear)

  const currentWeekSummary = weeklySummaries.find(
    s => s.week_number === currentWeek && s.year === currentYear
  )

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Week Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">SphereSync Accountability</h2>
          <p className="text-muted-foreground">
            Track email sends, task assignments, and completion rates
          </p>
        </div>
        <Select value={selectedWeek} onValueChange={setSelectedWeek}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select week" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Current Week ({currentWeek})</SelectItem>
            {weeklySummaries.map(summary => (
              <SelectItem 
                key={`${summary.week_number}_${summary.year}`} 
                value={summary.week_number.toString()}
              >
                Week {summary.week_number}, {summary.year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emails Sent</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredEmailLogs.length}</div>
            <p className="text-xs text-muted-foreground">
              {currentWeekSummary ? `${currentWeekSummary.emails_sent} this week` : 'No data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Agents with Tasks</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredTaskStats.length}</div>
            <p className="text-xs text-muted-foreground">
              Active agents this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tasks</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredTaskStats.reduce((sum, stat) => sum + stat.total_tasks, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {filteredTaskStats.reduce((sum, stat) => sum + stat.completed_tasks, 0)} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {filteredTaskStats.length > 0
                ? Math.round(
                    filteredTaskStats.reduce((sum, stat) => sum + stat.completion_rate, 0) /
                    filteredTaskStats.length
                  )
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Average across all agents
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Email Send History */}
      <Card>
        <CardHeader>
          <CardTitle>Email Send History</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredEmailLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No emails sent for this week yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Week</TableHead>
                  <TableHead>Tasks Assigned</TableHead>
                  <TableHead>Sent At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEmailLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.agent_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.agent_email || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        Week {log.week_number}, {log.year}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.task_count} tasks</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(log.sent_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Agent Task Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Task Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTaskStats.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tasks assigned for this week yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead>Total Tasks</TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      Calls
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" />
                      Texts
                    </div>
                  </TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Completion Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTaskStats
                  .sort((a, b) => b.completion_rate - a.completion_rate)
                  .map(stat => (
                    <TableRow key={`${stat.agent_id}_${stat.week_number}`}>
                      <TableCell className="font-medium">{stat.agent_name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{stat.total_tasks}</Badge>
                      </TableCell>
                      <TableCell>{stat.call_tasks}</TableCell>
                      <TableCell>{stat.text_tasks}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {stat.completed_tasks > 0 ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-gray-400" />
                          )}
                          <span>{stat.completed_tasks}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                stat.completion_rate >= 80
                                  ? 'bg-green-600'
                                  : stat.completion_rate >= 50
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${stat.completion_rate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{stat.completion_rate}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Weekly Summaries */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Summaries</CardTitle>
        </CardHeader>
        <CardContent>
          {weeklySummaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No weekly summaries available yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Emails Sent</TableHead>
                  <TableHead>Agents</TableHead>
                  <TableHead>Total Tasks</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Completion Rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {weeklySummaries.map(summary => (
                  <TableRow key={`${summary.week_number}_${summary.year}`}>
                    <TableCell className="font-medium">Week {summary.week_number}</TableCell>
                    <TableCell>{summary.year}</TableCell>
                    <TableCell>{summary.emails_sent}</TableCell>
                    <TableCell>{summary.total_agents}</TableCell>
                    <TableCell>{summary.total_tasks}</TableCell>
                    <TableCell>{summary.total_completed}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          summary.completion_rate >= 80
                            ? 'default'
                            : summary.completion_rate >= 50
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {summary.completion_rate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

