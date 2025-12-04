import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useEmailMetrics } from '@/hooks/useEmailTemplates'
import { Mail, Eye, MousePointer, MessageSquare, AlertTriangle } from 'lucide-react'

interface EmailMetricsDashboardProps {
  eventId: string
}

export const EmailMetricsDashboard: React.FC<EmailMetricsDashboardProps> = ({ eventId }) => {
  const { metrics, emails, loading } = useEmailMetrics(eventId)

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      sent: { variant: 'default' as const, label: 'Sent' },
      delivered: { variant: 'secondary' as const, label: 'Delivered' },
      opened: { variant: 'outline' as const, label: 'Opened' },
      clicked: { variant: 'outline' as const, label: 'Clicked' },
      replied: { variant: 'default' as const, label: 'Replied' },
      bounced: { variant: 'destructive' as const, label: 'Bounced' },
      failed: { variant: 'destructive' as const, label: 'Failed' },
      pending: { variant: 'secondary' as const, label: 'Pending' }
    }

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getEmailTypeLabel = (type: string) => {
    const labels = {
      confirmation: 'RSVP Confirmation',
      reminder_7day: '7-Day Reminder',
      reminder_1day: '1-Day Reminder',
      thank_you: 'Thank You',
      no_show: 'No-Show'
    }
    return labels[type as keyof typeof labels] || type
  }

  const calculateRate = (value: number, total: number) => {
    if (total === 0) return 0
    return Math.round((value / total) * 100)
  }

  const metricsCards = [
    {
      title: 'Total Sent',
      value: metrics.total_sent,
      icon: Mail,
      color: 'text-blue-600'
    },
    {
      title: 'Delivered',
      value: metrics.delivered,
      rate: calculateRate(metrics.delivered, metrics.total_sent),
      icon: Mail,
      color: 'text-green-600'
    },
    {
      title: 'Opened',
      value: metrics.opened,
      rate: calculateRate(metrics.opened, metrics.delivered),
      icon: Eye,
      color: 'text-purple-600'
    },
    {
      title: 'Clicked',
      value: metrics.clicked,
      rate: calculateRate(metrics.clicked, metrics.opened),
      icon: MousePointer,
      color: 'text-orange-600'
    },
    {
      title: 'Replied',
      value: metrics.replied,
      rate: calculateRate(metrics.replied, metrics.delivered),
      icon: MessageSquare,
      color: 'text-indigo-600'
    },
    {
      title: 'Bounced/Failed',
      value: metrics.bounced + metrics.failed,
      rate: calculateRate(metrics.bounced + metrics.failed, metrics.total_sent),
      icon: AlertTriangle,
      color: 'text-red-600'
    }
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Email Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {metricsCards.map((metric, index) => (
              <div key={index} className="text-center">
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 mb-2`}>
                  <metric.icon className={`h-6 w-6 ${metric.color}`} />
                </div>
                <div className="text-2xl font-bold">{metric.value}</div>
                <div className="text-sm text-gray-600">{metric.title}</div>
                {metric.rate !== undefined && (
                  <div className="text-xs text-gray-500">{metric.rate}%</div>
                )}
              </div>
            ))}
          </div>

          {/* Delivery Rate Progress */}
          {metrics.total_sent > 0 && (
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Delivery Rate</span>
                <span>{calculateRate(metrics.delivered, metrics.total_sent)}%</span>
              </div>
              <Progress value={calculateRate(metrics.delivered, metrics.total_sent)} className="h-2" />
            </div>
          )}

          {/* Open Rate Progress */}
          {metrics.delivered > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Open Rate</span>
                <span>{calculateRate(metrics.opened, metrics.delivered)}%</span>
              </div>
              <Progress value={calculateRate(metrics.opened, metrics.delivered)} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Email Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {emails.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No emails sent yet
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {emails.slice(0, 20).map((email) => (
                <div key={email.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm truncate">{email.recipient_email}</span>
                      {getStatusBadge(email.status)}
                    </div>
                    <div className="text-xs text-gray-600 truncate">
                      {getEmailTypeLabel(email.email_type)} • {email.subject}
                    </div>
                    {email.sent_at && (
                      <div className="text-xs text-gray-500">
                        {new Date(email.sent_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {email.opened_at && <div>Opened: {new Date(email.opened_at).toLocaleString()}</div>}
                    {email.replied_at && <div>Replied: {new Date(email.replied_at).toLocaleString()}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

