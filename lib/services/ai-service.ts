import OpenAI from 'openai';
import type { KnowledgeBase, TicketContext } from '../types/tenant';

export class AIService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async generateResponse(
    customerMessage: string,
    context: TicketContext,
    contextFormatted: string,
    knowledgeBase: KnowledgeBase[]
  ): Promise<string> {
    const relevantKnowledge = this.findRelevantKnowledge(customerMessage, knowledgeBase);

    const systemPrompt = `You are a helpful customer support agent. Your goal is to provide accurate, professional, and empathetic responses to customer inquiries.

Available Knowledge Base:
${relevantKnowledge.map(kb => `
Title: ${kb.title}
Category: ${kb.category || 'General'}
Content: ${kb.content}
`).join('\n---\n')}

${contextFormatted}

Guidelines:
- Be professional but friendly
- Use the knowledge base to provide accurate information
- Reference specific customer data when relevant (subscriptions, invoices, etc.)
- If you don't have enough information, ask clarifying questions
- Keep responses concise but complete
- Always maintain customer privacy and security`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: customerMessage },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      return completion.choices[0]?.message?.content || 'I apologize, but I was unable to generate a response. Please try again.';
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw error;
    }
  }

  private findRelevantKnowledge(message: string, knowledgeBase: KnowledgeBase[]): KnowledgeBase[] {
    const messageLower = message.toLowerCase();
    
    return knowledgeBase
      .filter(kb => kb.isActive)
      .filter(kb => {
        const titleMatch = kb.title.toLowerCase().includes(messageLower) || 
                          messageLower.includes(kb.title.toLowerCase());
        const contentMatch = kb.content.toLowerCase().includes(messageLower) ||
                            messageLower.includes(kb.content.toLowerCase().substring(0, 100));
        const tagMatch = kb.tags.some(tag => 
          messageLower.includes(tag.toLowerCase()) || 
          tag.toLowerCase().includes(messageLower)
        );
        
        return titleMatch || contentMatch || tagMatch;
      })
      .slice(0, 5);
  }

  async embedText(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error('Error creating embedding:', error);
      throw error;
    }
  }
}
