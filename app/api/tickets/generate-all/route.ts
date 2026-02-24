import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/client';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST() {
  try {
    // Find tenant
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain: 'doldadress' },
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }

    // Get all tickets without AI response
    const tickets = await prisma.ticket.findMany({
      where: {
        tenantId: tenant.id,
        aiResponse: null,
      },
    });

    const results = [];

    for (const ticket of tickets) {
      try {
        // Generate AI response with confidence
        const completion = await openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `Du är en professionell kundtjänstmedarbetare för ett hemlarmföretag. 
              
Ditt jobb är att:
1. Analysera kundens ärende
2. Ge ett hjälpsamt, professionellt och empatiskt svar
3. Inkludera relevant information om abonnemang, priser och teknisk support
4. Avsluta med en uppmaning att kontakta oss om kunden har fler frågor

Abonnemang:
- Hemlarm Bas: 199 kr/mån (grundskydd)
- Hemlarm Plus: 299 kr/mån (inkl. app-styrning)
- Hemlarm Premium: 499 kr/mån (inkl. kameraövervakning)

Uppsägningstid: 1 månad
Installation: 995 kr engångsavgift
Support: 24/7 via telefon och e-post`,
            },
            {
              role: 'user',
              content: `Ämne: ${ticket.subject}\n\nMeddelande: ${ticket.originalMessage}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        const aiResponse = completion.choices[0].message.content || '';
        
        // Calculate confidence based on finish_reason and response length
        let confidence = 0.85; // Base confidence
        
        if (completion.choices[0].finish_reason === 'stop') {
          confidence = 0.95; // High confidence if completed naturally
        } else if (completion.choices[0].finish_reason === 'length') {
          confidence = 0.75; // Lower confidence if cut off
        }
        
        // Adjust based on response quality indicators
        if (aiResponse.length < 100) {
          confidence -= 0.1; // Too short
        }
        if (aiResponse.includes('Hej') && aiResponse.includes('Vänliga hälsningar')) {
          confidence += 0.05; // Proper greeting and closing
        }

        // Update ticket with AI response and confidence
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: {
            aiResponse,
            aiConfidence: Math.min(Math.max(confidence, 0), 1), // Clamp between 0-1
          },
        });

        results.push({
          ticketId: ticket.id,
          subject: ticket.subject,
          confidence,
          success: true,
        });
      } catch (error) {
        console.error(`Error generating AI response for ticket ${ticket.id}:`, error);
        results.push({
          ticketId: ticket.id,
          subject: ticket.subject,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Generated AI responses for ${results.filter(r => r.success).length} out of ${tickets.length} tickets`,
      results,
    });
  } catch (error) {
    console.error('Error in batch AI generation:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI responses' },
      { status: 500 }
    );
  }
}
