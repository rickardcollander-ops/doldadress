import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const range = searchParams.get('range') || '30d';
    
    // Get tenant from subdomain
    const hostname = request.nextUrl.hostname;
    const subdomain =
      hostname === 'localhost' || hostname === '127.0.0.1'
        ? 'doldadress'
        : hostname.split('.')[0];
    
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain },
    });

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Calculate date range
    const now = new Date();
    const daysAgo = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    // Get all tickets in range
    const tickets = await prisma.ticket.findMany({
      where: {
        tenantId: tenant.id,
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Calculate metrics
    const totalTickets = tickets.length;

    // Tickets by status
    const ticketsByStatus = tickets.reduce((acc, ticket) => {
      acc[ticket.status] = (acc[ticket.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Tickets by priority
    const ticketsByPriority = tickets.reduce((acc, ticket) => {
      acc[ticket.priority] = (acc[ticket.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Resolved today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const resolvedToday = tickets.filter(
      (t) => (t.status === 'sent' || t.status === 'closed') && 
      new Date(t.updatedAt) >= todayStart
    ).length;

    // Pending tickets (new or in_progress)
    const pendingTickets = tickets.filter(
      (t) => t.status === 'new' || t.status === 'in_progress'
    ).length;

    // Average response time (in hours)
    const respondedTickets = tickets.filter((t) => t.aiResponse || t.finalResponse);
    const avgResponseTime = respondedTickets.length > 0
      ? respondedTickets.reduce((sum, ticket) => {
          const created = new Date(ticket.createdAt).getTime();
          const updated = new Date(ticket.updatedAt).getTime();
          return sum + (updated - created) / (1000 * 60 * 60); // Convert to hours
        }, 0) / respondedTickets.length
      : 0;

    // Recent activity (tickets per day)
    const recentActivity = [];
    for (let i = daysAgo - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

      const count = tickets.filter(
        (t) => new Date(t.createdAt) >= dayStart && new Date(t.createdAt) < dayEnd
      ).length;

      recentActivity.push({
        date: dayStart.toISOString().split('T')[0],
        count,
      });
    }

    return NextResponse.json({
      totalTickets,
      ticketsByStatus,
      ticketsByPriority,
      avgResponseTime: Math.round(avgResponseTime * 10) / 10, // Round to 1 decimal
      resolvedToday,
      pendingTickets,
      recentActivity,
    });
  } catch (error) {
    console.error('Error fetching report data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch report data' },
      { status: 500 }
    );
  }
}
