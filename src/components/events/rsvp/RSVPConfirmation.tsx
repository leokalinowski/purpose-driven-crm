import { CheckCircle2, Calendar, MapPin, Users, Mail } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface RSVPConfirmationProps {
  eventTitle: string;
  eventDate: string;
  location?: string;
  guestCount: number;
  email: string;
  status: 'confirmed' | 'waitlist';
  onClose?: () => void;
}

export const RSVPConfirmation = ({
  eventTitle,
  eventDate,
  location,
  guestCount,
  email,
  status,
  onClose,
}: RSVPConfirmationProps) => {
  const isWaitlist = status === 'waitlist';

  return (
    <Card className="border-green-200 bg-green-50">
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-green-900">
              {isWaitlist ? 'Added to Waitlist!' : 'RSVP Confirmed!'}
            </h3>
            <p className="text-sm text-green-700 mt-1">
              {isWaitlist
                ? "We'll notify you if a spot becomes available."
                : "We're excited to see you there!"}
            </p>
          </div>

          <div className="bg-white rounded-lg p-4 space-y-3 text-left">
            <div>
              <h4 className="font-semibold text-gray-900">{eventTitle}</h4>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>{format(new Date(eventDate), 'EEEE, MMMM d, yyyy')}</span>
            </div>

            {location && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4" />
                <span>{location}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="h-4 w-4" />
              <span>{guestCount} {guestCount === 1 ? 'guest' : 'guests'}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="h-4 w-4" />
              <span>{email}</span>
            </div>
          </div>

          {!isWaitlist && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-900">
              A confirmation email has been sent to {email} with event details and reminders.
            </p>
          </div>
          )}

          {onClose && (
            <Button onClick={onClose} variant="outline" className="mt-4">
              Close
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

