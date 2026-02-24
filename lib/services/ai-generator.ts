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

    const relevant = knowledgeBase
      .filter((kb) => {
        const titleLower = kb.title.toLowerCase();
        const contentLower = kb.content.toLowerCase().substring(0, 300);

        const titleMatch = words.some((w) => titleLower.includes(w)) ||
          messageLower.includes(titleLower);

        const contentMatch = words.some((w) => contentLower.includes(w));

        const tagMatch = kb.tags.some((tag) =>
          messageLower.includes(tag.toLowerCase()) ||
          words.some((w) => tag.toLowerCase().includes(w))
        );

        return titleMatch || contentMatch || tagMatch;
      })
      .slice(0, 5);

    if (relevant.length === 0) return '';

    let formatted = '\n\n=== Kunskapsbas (använd detta för att ge korrekta svar) ===\n';
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
        formatted += `  - Faktura #${inv.number || inv.id}: ${inv.amount ?? '?'} kr, förfaller ${inv.dueDate || 'okänt'}, status: ${inv.status || 'okänd'}\n`;
      });
    }

    if (paid.length > 0) {
      formatted += `\nBetalda fakturor (${paid.length}):\n`;
      paid.slice(0, 5).forEach((inv: any) => {
        formatted += `  - Faktura #${inv.number || inv.id}: ${inv.amount ?? '?'} kr, status: ${inv.status || 'betald'}\n`;
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
          
Ditt jobb är att:
1. Analysera kundens ärende
2. Ge ett hjälpsamt, professionellt och empatiskt svar
3. Använd kunskapsbasen nedan för att ge korrekta svar på vanliga frågor
4. Om det finns fakturahistorik från Billecta, använd den för att ge ett mer precist svar (t.ex. referera till specifika fakturanummer, belopp, förfallodatum eller betalningsstatus)
5. Om kunden har obetalda fakturor, nämn det vänligt och erbjud hjälp
6. Avsluta med en uppmaning att kontakta oss om kunden har fler frågor

Uppsägningstid: 1 månad
Support: via telefon och e-post`,
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
