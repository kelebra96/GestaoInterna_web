import { NextRequest, NextResponse } from 'next/server';
import { predictionService } from '@/lib/services/prediction.service';
import { getAuthFromRequest } from '@/lib/helpers/auth';
import { CalendarEventType } from '@/lib/types/prediction';

// GET /api/ml/seasonality/events - Próximos eventos
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    const events = await predictionService.getUpcomingEvents(auth.orgId, days);

    return NextResponse.json({
      success: true,
      events,
    });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}

// POST /api/ml/seasonality/events - Criar evento
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthFromRequest(request);

    if (!auth || !auth.orgId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { eventName, eventType, eventDate, recurrence, impactFactor, affectsCategories, notes } = body;

    if (!eventName || !eventType) {
      return NextResponse.json(
        { error: 'Event name and type are required' },
        { status: 400 }
      );
    }

    if (!['holiday', 'promotion', 'season', 'custom'].includes(eventType)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      );
    }

    const event = await predictionService.createCalendarEvent(auth.orgId, {
      eventName,
      eventType: eventType as CalendarEventType,
      eventDate: eventDate ? new Date(eventDate) : undefined,
      recurrence: recurrence || 'none',
      impactFactor: impactFactor || 1.0,
      affectsCategories: affectsCategories || [],
      notes,
    });

    return NextResponse.json({
      success: true,
      event,
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar event' },
      { status: 500 }
    );
  }
}
