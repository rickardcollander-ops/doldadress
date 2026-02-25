import OpenAI from 'openai';
import { prisma } from '@/lib/db/client';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function findRelevantKnowledge(tenantId: string, message: string): Promise<string> {
  try {
    const knowledgeBase = await prisma.knowledgeBase.findMany({
      where: { tenantId, isActive: true },
    });

    if (knowledgeBase.length === 0) return '';

    const messageLower = message.toLowerCase();
    const words = messageLower.split(/\s+/).filter((w) => w.length > 3);

    // Enhanced keyword matching for common topics
    const cancellationKeywords = ['säger upp', 'uppsägning', 'avsluta', 'säga upp', 'säger upp', 'avslutar'];
    const isCancellationQuery = cancellationKeywords.some(kw => messageLower.includes(kw));

    const relevant = knowledgeBase
      .map((kb) => {
        const titleLower = kb.title.toLowerCase();
        const contentLower = kb.content.toLowerCase();

        let score = 0;

        // Title matching (highest priority)
        if (messageLower.includes(titleLower)) score += 10;
        if (words.some((w) => titleLower.includes(w))) score += 5;

        // Content matching
        if (words.some((w) => contentLower.includes(w))) score += 2;

        // Tag matching
        if (kb.tags.some((tag) =>
          messageLower.includes(tag.toLowerCase()) ||
          words.some((w) => tag.toLowerCase().includes(w))
        )) score += 3;

        // Boost cancellation-related articles if query is about cancellation
        if (isCancellationQuery && (
          titleLower.includes('uppsägning') ||
          titleLower.includes('abonnemang') ||
          contentLower.includes('säger upp')
        )) score += 15;

        return { kb, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ kb }) => kb);

    if (relevant.length === 0) return '';

    let formatted = '\n\n=== KUNSKAPSBAS (VIKTIGT: Använd denna information för att ge korrekta svar) ===\n';
    relevant.forEach((kb) => {
      formatted += `\n--- ${kb.title} ${kb.category ? `(${kb.category})` : ''} ---\n`;
      formatted += `${kb.content}\n`;
    });

    return formatted;
  } catch (error) {
    console.error('Error fetching knowledge base:', error);
    return '';
  }
}

function formatContextForPrompt(contextData: any): string {
  if (!contextData) return '';

  let formatted = '\n\n=== Kundhistorik från Billecta ===\n';

  const billecta = contextData.billecta;
  if (billecta) {
    if (billecta.debtorName) formatted += `Kundnamn: ${billecta.debtorName}\n`;
    if (billecta.debtorOrgNo) formatted += `Org/personnr: ${billecta.debtorOrgNo}\n`;

    const invoices = billecta.invoices || [];
    formatted += `Totalt antal fakturor: ${invoices.length}\n`;

    const unpaid = invoices.filter((inv: any) => !inv.isPaid);
    const paid = invoices.filter((inv: any) => inv.isPaid);

    if (unpaid.length > 0) {
      formatted += `\nObetalda fakturor (${unpaid.length}):\n`;
      unpaid.forEach((inv: any) => {
        formatted += `  - Faktura #${inv.number || inv.id}: ${inv.amount ?? '?'} kr, förfaller ${inv.dueDate || 'okänt'}, status: ${inv.status || 'okänd'}${inv.deliveryMethod ? `, leverans: ${inv.deliveryMethod}` : ''}\n`;
      });
    }

    if (paid.length > 0) {
      formatted += `\nBetalda fakturor (${paid.length}):\n`;
      paid.slice(0, 5).forEach((inv: any) => {
        formatted += `  - Faktura #${inv.number || inv.id}: ${inv.amount ?? '?'} kr, status: ${inv.status || 'betald'}${inv.deliveryMethod ? `, leverans: ${inv.deliveryMethod}` : ''}\n`;
      });
      if (paid.length > 5) formatted += `  ... och ${paid.length - 5} till\n`;
    }
  }

  if (!billecta) {
    formatted += 'Ingen fakturainformation hittades för denna kund.\n';
  }

  return formatted;
}

export async function generateAIResponse(
  subject: string,
  originalMessage: string,
  contextData?: any,
  tenantId?: string
): Promise<{ response: string; confidence: number }> {
  try {
    const contextPrompt = formatContextForPrompt(contextData);

    const knowledgePrompt = tenantId
      ? await findRelevantKnowledge(tenantId, `${subject} ${originalMessage}`)
      : '';

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `Du är en professionell kundtjänstmedarbetare för Doldadress. 

VIKTIGA REGLER:
1. **ANVÄND ALLTID KUNSKAPSBASEN FÖRST** - Om det finns en kunskapsbasartikel som matchar kundens fråga, använd informationen därifrån. Detta är HÖGSTA PRIORITET.
2. Analysera kundens ärende noggrant - förstå vad de verkligen frågar om
3. Ge ett hjälpsamt, professionellt och empatiskt svar baserat på kunskapsbasen
4. Om kunden frågar om uppsägning/avsluta/säga upp - använd informationen från kunskapsbasen om "Uppsägning av Abonnemang"
5. Om det finns fakturahistorik från Billecta, använd den för att komplettera svaret (t.ex. referera till specifika fakturanummer, belopp, förfallodatum)
6. Om kunden har obetalda fakturor OCH frågar om betalning, nämn det vänligt
7. Avsluta alltid med att erbjuda ytterligare hjälp

VIKTIGT: Läs kunskapsbasen noggrant och följ instruktionerna där. Gissa INTE om du har korrekt information i kunskapsbasen.

Allmän info:
- Uppsägningstid: 1 månad
- Support: via telefon och e-post`,
        },
        {
          role: 'user',
          content: `Ämne: ${subject}\n\nMeddelande: ${originalMessage}${contextPrompt}${knowledgePrompt}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = completion.choices[0].message.content || '';
    
    // Calculate confidence based on finish_reason and response quality
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

    return {
      response: aiResponse,
      confidence: Math.min(Math.max(confidence, 0), 1), // Clamp between 0-1
    };
  } catch (error) {
    console.error('Error generating AI response:', error);
    throw error;
  }
}
