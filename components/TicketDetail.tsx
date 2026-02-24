'use client';

import { useState, useEffect } from 'react';
import { Mail, ChevronDown } from 'lucide-react';
import type { Ticket } from '@/lib/types';

interface ReplyFromAccount {
  id: string;
  email: string;
  provider: string;
  isActive: boolean;
}

interface CustomerHistoryResponse {
  customer: {
    email: string;
    name: string | null;
    totalTickets: number;
    openTickets: number;
    lastTicketAt: string | null;
  };
  billecta?: {
    source: 'context' | 'history';
    invoices: number;
    unpaidInvoices: number | null;
    relatedTickets: number;
    creditorPublicId?: string | null;
    debtorPublicId?: string | null;
    invoicesPreview?: Array<{
      id?: string;
      number?: string;
      status?: string;
      amount?: number | string;
      dueDate?: string;
      isPaid?: boolean;
    }>;
  } | null;
  previousTickets: Array<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
  }>;
  similarIssues: Array<{
    id: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    similarityScore: number;
    snippet: string;
  }>;
}

interface TicketDetailProps {
  ticket: Ticket;
  onUpdate: (ticketId: string, updates: Partial<Ticket>) => void;
  onGenerateAI: (ticketId: string) => Promise<string | null>;
  onSend: (ticketId: string, response: string, fromAccountId?: string) => void;
}

export default function TicketDetail({ ticket, onUpdate, onGenerateAI, onSend }: TicketDetailProps) {
  const [response, setResponse] = useState(ticket.finalResponse || ticket.aiResponse || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(ticket.aiResponse || null);
  const [customerHistory, setCustomerHistory] = useState<CustomerHistoryResponse | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [emailAccounts, setEmailAccounts] = useState<ReplyFromAccount[]>([]);
  const [selectedFromAccount, setSelectedFromAccount] = useState<string>('');

  // Fetch connected email accounts for "reply from" selector
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const res = await fetch('/api/email-accounts');
        if (res.ok) {
          const data = await res.json();
          const accounts: ReplyFromAccount[] = (data.accounts || data || []).filter((a: ReplyFromAccount) => a.isActive);
          setEmailAccounts(accounts);
          if (accounts.length > 0 && !selectedFromAccount) {
            setSelectedFromAccount(accounts[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching email accounts:', error);
      }
    };
    fetchAccounts();
  }, []);

  // Reset state when ticket changes
  useEffect(() => {
    setResponse(ticket.finalResponse || ticket.aiResponse || '');
    setAiSuggestion(ticket.aiResponse || null);
  }, [ticket.id, ticket.aiResponse, ticket.finalResponse, ticket.aiConfidence]);

  useEffect(() => {
    let isCancelled = false;

    const fetchCustomerHistory = async () => {
      setIsHistoryLoading(true);
      try {
        const res = await fetch(`/api/tickets/${ticket.id}/customer-history`);
        if (!res.ok) {
          if (!isCancelled) {
            setCustomerHistory(null);
          }
          return;
        }

        const data = await res.json();
        if (!isCancelled) {
          setCustomerHistory(data);
        }
      } catch (error) {
        console.error('Error fetching customer history:', error);
        if (!isCancelled) {
          setCustomerHistory(null);
        }
      } finally {
        if (!isCancelled) {
          setIsHistoryLoading(false);
        }
      }
    };

    fetchCustomerHistory();

    return () => {
      isCancelled = true;
    };
  }, [ticket.id]);

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    const aiResponse = await onGenerateAI(ticket.id);
    if (aiResponse) {
      setAiSuggestion(aiResponse);
      setResponse(aiResponse);
    }
    setIsGenerating(false);
  };

  const handleSend = async () => {
    setIsSending(true);
    await onSend(ticket.id, response, selectedFromAccount || undefined);
    setIsSending(false);
  };

  const handleStatusChange = (status: string) => {
    onUpdate(ticket.id, { status: status as any });
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm h-full flex flex-col">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700">
        {/* AI Status Banner */}
        {ticket.aiResponse && ticket.aiConfidence && (
          <div className="mb-4 p-3 bg-gradient-to-r from-[#7C5CFF]/10 to-[#9F7BFF]/10 border border-[#7C5CFF]/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#9F7BFF] flex items-center justify-center">
                  <span className="text-white text-sm">✨</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#7C5CFF] dark:text-[#9F7BFF]">AI-svar genererat</p>
                  <p className="text-xs text-slate-600 dark:text-slate-400">Klart att granska och skicka</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600 dark:text-slate-400">Säkerhet:</span>
                <span className="px-3 py-1 bg-gradient-to-r from-[#7C5CFF] to-[#9F7BFF] text-white rounded-full text-sm font-bold">
                  {Math.round(ticket.aiConfidence * 100)}%
                </span>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{ticket.subject}</h2>
            <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
              <span>{ticket.customerEmail}</span>
              <span>•</span>
              <span>{new Date(ticket.createdAt).toLocaleString()}</span>
            </div>
          </div>
          <select
            value={ticket.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
          >
            <option value="new">New</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="sent">Sent</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Original Message</h3>
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 text-sm whitespace-pre-wrap text-slate-900 dark:text-slate-100">
            {ticket.originalMessage}
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">Kundhistorik (e-postbaserad)</h3>

          {isHistoryLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Laddar kundhistorik...</p>
          ) : !customerHistory ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Ingen kundhistorik hittades.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="bg-white dark:bg-slate-800 rounded-md p-3 border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500 dark:text-slate-400">Kund</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">
                    {customerHistory.customer.name || customerHistory.customer.email}
                  </p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-md p-3 border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500 dark:text-slate-400">Totalt antal ärenden</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{customerHistory.customer.totalTickets}</p>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-md p-3 border border-slate-200 dark:border-slate-700">
                  <p className="text-slate-500 dark:text-slate-400">Öppna ärenden</p>
                  <p className="font-medium text-slate-900 dark:text-slate-100">{customerHistory.customer.openTickets}</p>
                </div>
              </div>

              {customerHistory.billecta && (
                <div className="bg-white dark:bg-slate-800 rounded-md p-3 border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-green-800 dark:text-green-300">Billecta</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                      {customerHistory.billecta.source === 'context' ? 'Live context' : 'Från historik'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Fakturor</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{customerHistory.billecta.invoices}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Obetalda</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">
                        {customerHistory.billecta.unpaidInvoices === null
                          ? 'Okänt'
                          : customerHistory.billecta.unpaidInvoices}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Relaterade ärenden</p>
                      <p className="font-medium text-slate-900 dark:text-slate-100">{customerHistory.billecta.relatedTickets}</p>
                    </div>
                  </div>

                  {(customerHistory.billecta.creditorPublicId || customerHistory.billecta.debtorPublicId) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs mt-3 pt-3 border-t border-green-100 dark:border-green-900">
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Creditor ID</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100 break-all">
                          {customerHistory.billecta.creditorPublicId || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-500 dark:text-slate-400">Debtor ID</p>
                        <p className="font-medium text-slate-900 dark:text-slate-100 break-all">
                          {customerHistory.billecta.debtorPublicId || '-'}
                        </p>
                      </div>
                    </div>
                  )}

                  {customerHistory.billecta.invoicesPreview && customerHistory.billecta.invoicesPreview.length > 0 ? (
                    <div className="mt-3 pt-3 border-t border-green-100 dark:border-green-900">
                      <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Fakturadetaljer</p>
                      <div className="space-y-2">
                        {customerHistory.billecta.invoicesPreview.map((invoice, idx) => (
                          <div
                            key={`${invoice.id || invoice.number || 'invoice'}-${idx}`}
                            className="rounded-md border border-slate-200 dark:border-slate-700 p-2 text-xs"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                #{invoice.number || invoice.id || 'Okänd faktura'}
                              </p>
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                {invoice.status || 'okänd status'}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1 text-slate-600 dark:text-slate-300">
                              <p>Belopp: {invoice.amount ?? '-'}</p>
                              <p>Förfallo: {invoice.dueDate || '-'}</p>
                              <p>Betald: {invoice.isPaid === undefined ? 'okänt' : invoice.isPaid ? 'ja' : 'nej'}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                      Inga detaljerade fakturafält ännu. Klicka "Generate AI Response" för att försöka hämta live Billecta-context.
                    </p>
                  )}
                </div>
              )}

              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">Liknande tidigare ärenden</p>
                {customerHistory.similarIssues.length === 0 ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">Inga tydligt liknande tidigare ärenden för den här kunden.</p>
                ) : (
                  <div className="space-y-2">
                    {customerHistory.similarIssues.map((issue) => (
                      <div
                        key={issue.id}
                        className="bg-white dark:bg-slate-800 rounded-md p-3 border border-slate-200 dark:border-slate-700"
                      >
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{issue.subject}</p>
                          <span className="text-xs px-2 py-1 rounded-full bg-[#7C5CFF]/15 text-[#7C5CFF] dark:text-[#B8A6FF]">
                            {issue.similarityScore}% match
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                          {new Date(issue.createdAt).toLocaleDateString()} • {issue.status}
                        </p>
                        <p className="text-sm text-slate-600 dark:text-slate-300">{issue.snippet}...</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {ticket.contextData && (
          <div>
            <h3 className="text-sm font-semibold mb-3 text-slate-700 dark:text-slate-300">Customer Context</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ticket.contextData.stripe && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">S</span>
                    </div>
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">Stripe</p>
                  </div>
                  <div className="space-y-1 text-xs text-blue-800 dark:text-blue-200">
                    <p>💳 {ticket.contextData.stripe.subscriptions?.length || 0} subscriptions</p>
                    <p>📄 {ticket.contextData.stripe.invoices?.length || 0} invoices</p>
                    <p>💰 {ticket.contextData.stripe.charges?.length || 0} charges</p>
                  </div>
                </div>
              )}
              {ticket.contextData.billecta && (
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 rounded-lg p-4 border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">B</span>
                    </div>
                    <p className="text-sm font-semibold text-green-900 dark:text-green-100">Billecta</p>
                  </div>
                  <div className="space-y-1 text-xs text-green-800 dark:text-green-200">
                    <p>📋 {ticket.contextData.billecta.invoices?.length || 0} invoices</p>
                  </div>
                </div>
              )}
              {ticket.contextData.resend && (
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">R</span>
                    </div>
                    <p className="text-sm font-semibold text-purple-900 dark:text-purple-100">Resend</p>
                  </div>
                  <div className="space-y-1 text-xs text-purple-800 dark:text-purple-200">
                    <p>📧 {ticket.contextData.resend.emailsSent || 0} emails sent</p>
                    <p>📬 {ticket.contextData.resend.recentEmails?.length || 0} recent emails</p>
                  </div>
                </div>
              )}
              {ticket.contextData.retool && (
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center">
                      <span className="text-white text-xs font-bold">RT</span>
                    </div>
                    <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">Retool</p>
                  </div>
                  <div className="space-y-1 text-xs text-orange-800 dark:text-orange-200">
                    <p>🔧 Custom data available</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* AI Suggestion Section */}
        {aiSuggestion && (
          <div className="bg-gradient-to-r from-[#7C5CFF]/10 to-[#9F7BFF]/10 border border-[#7C5CFF]/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#7C5CFF] to-[#9F7BFF] flex items-center justify-center">
                <span className="text-white text-xs">✨</span>
              </div>
              <p className="text-sm font-semibold text-[#7C5CFF] dark:text-[#9F7BFF]">AI Suggested Response</p>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{aiSuggestion}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setResponse(aiSuggestion)}
                className="px-3 py-1 text-xs bg-[#7C5CFF] text-white rounded-md hover:bg-[#6B4FE0]"
              >
                Use this response
              </button>
              <button
                onClick={handleGenerateAI}
                disabled={isGenerating}
                className="px-3 py-1 text-xs border border-[#7C5CFF] text-[#7C5CFF] rounded-md hover:bg-[#7C5CFF]/10"
              >
                {isGenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Response</h3>
            {!aiSuggestion && (
              <button
                onClick={handleGenerateAI}
                disabled={isGenerating}
                className="px-3 py-1 text-sm bg-gradient-to-r from-[#7C5CFF] to-[#9F7BFF] text-white rounded-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(124,92,255,0.4)]"
              >
                {isGenerating ? 'Generating...' : '✨ Generate AI Response'}
              </button>
            )}
          </div>
          <textarea
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            className="w-full h-64 p-4 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
            placeholder="Type your response or generate one with AI..."
          />
        </div>
      </div>

      <div className="p-6 border-t border-slate-200 dark:border-slate-700">
        {/* Reply From Selector */}
        {emailAccounts.length > 0 && (
          <div className="mb-3 flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-500 dark:text-slate-400 flex-shrink-0" />
            <span className="text-sm text-slate-600 dark:text-slate-400 whitespace-nowrap">Svara från:</span>
            <div className="relative flex-1">
              <select
                value={selectedFromAccount}
                onChange={(e) => setSelectedFromAccount(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#7C5CFF]"
              >
                {emailAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.email}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleSend}
            disabled={!response || isSending}
            className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {isSending ? 'Sending...' : `Send Response${emailAccounts.length > 0 && selectedFromAccount ? ` (${emailAccounts.find(a => a.id === selectedFromAccount)?.email || ''})` : ''}`}
          </button>
          <button
            onClick={() => handleStatusChange('closed')}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-md hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100"
          >
            Close Ticket
          </button>
        </div>
      </div>
    </div>
  );
}
