import { useEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Bot, BookOpen, ExternalLink, Library, LoaderCircle, MessageCircle, Send, Sparkles, Trash2, X } from 'lucide-react';

type BookResult = {
  id: string;
  title: string;
  author: string;
  category: string;
  availableCopies: number;
  totalCopies: number;
  ebookUrl: string | null;
};

type LoanResult = {
  id: string;
  bookTitle: string;
  issueDate: string;
  dueDate: string;
  status: string;
};

type ReservationResult = {
  id: string;
  bookTitle: string;
  reservedAt: string;
  expiresAt: string | null;
  queuePosition: number | null;
  status: string;
};

type FineResult = {
  id: string;
  bookTitle: string;
  amount: number;
  reason: string;
  status: string;
};

type ResourceResult = {
  id: string;
  title: string;
  description: string | null;
  resourceType: string;
  url: string;
};

type AssistantResponse = {
  reply: string;
  intent?: string;
  books?: BookResult[];
  loans?: LoanResult[];
  reservations?: ReservationResult[];
  fines?: FineResult[];
  resources?: ResourceResult[];
};

type ChatMessage = {
  id: string;
  role: 'assistant' | 'user';
  text: string;
  response?: AssistantResponse;
};

type Props = {
  supabaseClient: SupabaseClient;
  role: string;
  onNavigate: (page: string) => void;
};

const welcomeMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hello! I’m your Library AI Assistant. Ask me about books, your loans and due dates, fines, reservations, or library resources.',
};

const suggestions = [
  'Find available Java books',
  'What books have I borrowed?',
  'Do I have pending fines?',
  'Show me learning resources',
];

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatAmount(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function LibraryAIAssistant({ supabaseClient, role, onNavigate }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      inputRef.current?.focus();
    }
  }, [isOpen, isSending, messages]);

  const sendMessage = async (value: string) => {
    const text = value.trim();
    if (!text || isSending || text.length > 500) return;

    setInput('');
    setIsSending(true);
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', text }]);

    try {
      const { data, error } = await supabaseClient.functions.invoke<AssistantResponse>('library-assistant', {
        body: { message: text },
      });
      if (error || !data || typeof data.reply !== 'string') {
        setMessages((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            text: 'I couldn’t reach the library assistant just now. Please try again in a moment.',
          },
        ]);
      } else {
        setMessages((current) => [
          ...current,
          { id: crypto.randomUUID(), role: 'assistant', text: data.reply, response: data },
        ]);
      }
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: 'I couldn’t reach the library assistant just now. Please try again in a moment.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage(input);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  };

  const clearChat = () => {
    if (isSending) return;
    setMessages([welcomeMessage]);
    setInput('');
  };

  return (
    <div className="library-ai">
      {isOpen && (
        <section className="library-ai-panel" aria-label="Library AI Assistant chat">
          <header className="library-ai-header">
            <div className="library-ai-brand">
              <span className="library-ai-brand-icon"><Sparkles size={18} /></span>
              <div>
                <strong>Library AI Assistant</strong>
                <small><span className="library-ai-online" /> Here to help · {role}</small>
              </div>
            </div>
            <div className="library-ai-header-actions">
              <button type="button" aria-label="Clear chat" title="Clear chat" onClick={clearChat} disabled={isSending}>
                <Trash2 size={17} />
              </button>
              <button type="button" aria-label="Close assistant" title="Close assistant" onClick={() => setIsOpen(false)}>
                <X size={19} />
              </button>
            </div>
          </header>

          <div className="library-ai-messages" aria-live="polite">
            {messages.map((message) => (
              <div className={`library-ai-message ${message.role}`} key={message.id}>
                {message.role === 'assistant' && <span className="library-ai-message-icon"><Bot size={16} /></span>}
                <div className="library-ai-bubble">
                  <p>{message.text}</p>
                  {message.response?.books?.map((book) => (
                    <article className="library-ai-result" key={book.id}>
                      <strong>{book.title}</strong>
                      <span>{book.author || 'Author not listed'} · {book.category || 'General'}</span>
                      <span className={book.availableCopies > 0 ? 'available' : 'unavailable'}>
                        {book.availableCopies > 0
                          ? `${book.availableCopies} of ${book.totalCopies} copies available`
                          : 'Currently unavailable'}
                      </span>
                      <div className="library-ai-result-actions">
                        <button type="button" onClick={() => { onNavigate('search'); setIsOpen(false); }}>
                          Browse catalogue
                        </button>
                        {book.ebookUrl && safeExternalUrl(book.ebookUrl) && (
                          <a href={safeExternalUrl(book.ebookUrl) || undefined} target="_blank" rel="noreferrer">
                            E-book <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                  {message.response?.loans?.map((loan) => (
                    <article className="library-ai-result" key={loan.id}>
                      <strong>{loan.bookTitle}</strong>
                      <span>Issued {formatDate(loan.issueDate)}</span>
                      <span>Due {formatDate(loan.dueDate)} · {loan.status}</span>
                      <button type="button" onClick={() => { onNavigate('mybooks'); setIsOpen(false); }}>
                        Open My Books
                      </button>
                    </article>
                  ))}
                  {message.response?.reservations?.map((reservation) => (
                    <article className="library-ai-result" key={reservation.id}>
                      <strong>{reservation.bookTitle}</strong>
                      <span>Reserved {formatDate(reservation.reservedAt)} · {reservation.status}</span>
                      {reservation.queuePosition !== null && <span>Queue position {reservation.queuePosition}</span>}
                      {reservation.expiresAt && <span>Pickup by {formatDate(reservation.expiresAt)}</span>}
                      <button type="button" onClick={() => { onNavigate('reservations'); setIsOpen(false); }}>
                        Open Reservations
                      </button>
                    </article>
                  ))}
                  {message.response?.fines?.map((fine) => (
                    <article className="library-ai-result" key={fine.id}>
                      <strong>{formatAmount(fine.amount)} · {fine.status}</strong>
                      <span>{fine.reason}{fine.bookTitle ? ` · ${fine.bookTitle}` : ''}</span>
                      <button type="button" onClick={() => { onNavigate('fines'); setIsOpen(false); }}>
                        Open Fines
                      </button>
                    </article>
                  ))}
                  {message.response?.resources?.map((resource) => {
                    const url = safeExternalUrl(resource.url);
                    return (
                      <article className="library-ai-result" key={resource.id}>
                        <strong>{resource.title}</strong>
                        {resource.description && <span>{resource.description}</span>}
                        <span>{resource.resourceType}</span>
                        {url && <a href={url} target="_blank" rel="noreferrer">Open resource <ExternalLink size={12} /></a>}
                      </article>
                    );
                  })}
                  {message.role === 'assistant' && message.id === 'welcome' && (
                    <div className="library-ai-suggestions">
                      <span>Try asking</span>
                      {suggestions.map((suggestion) => (
                        <button type="button" key={suggestion} onClick={() => void sendMessage(suggestion)}>
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                  {message.response?.intent === 'book_search' && (
                    <button className="library-ai-link" type="button" onClick={() => { onNavigate('search'); setIsOpen(false); }}>
                      <BookOpen size={13} /> Open book search
                    </button>
                  )}
                  {message.response?.intent === 'resources' && (
                    <button className="library-ai-link" type="button" onClick={() => { onNavigate('resources'); setIsOpen(false); }}>
                      <Library size={13} /> Open library resources
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isSending && (
              <div className="library-ai-message assistant" role="status" aria-label="Assistant is thinking">
                <span className="library-ai-message-icon"><Bot size={16} /></span>
                <div className="library-ai-typing"><LoaderCircle size={16} className="library-ai-spinner" /> Searching the library…</div>
              </div>
            )}
            <div ref={messageEndRef} />
          </div>

          <form className="library-ai-compose" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a library question..."
              maxLength={500}
              aria-label="Message the Library AI Assistant"
              disabled={isSending}
            />
            <button type="submit" aria-label="Send message" disabled={isSending || !input.trim()}>
              <Send size={17} />
            </button>
          </form>
          <div className="library-ai-footnote">Answers use library catalogue and account records.</div>
        </section>
      )}
      <button
        className={`library-ai-launcher${isOpen ? ' open' : ''}`}
        type="button"
        aria-label={isOpen ? 'Close Library AI Assistant' : 'Open Library AI Assistant'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
        {!isOpen && <span>Library AI</span>}
      </button>
    </div>
  );
}
