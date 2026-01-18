import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import '../index.css';

const API_URL = 'http://localhost:3001';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
    status?: 'pending' | 'success' | 'error';
}

export function ChatInterface() {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Load saved chat history on mount
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const resp = await axios.get(`${API_URL}/chat/history`);
                if (Array.isArray(resp.data)) {
                    const mapped = resp.data.map((m: any) => ({
                        id: `db-${m.id || m.timestamp}`,
                        role: m.role,
                        content: m.content,
                        timestamp: m.timestamp
                    })) as ChatMessage[];
                    setMessages(mapped);
                }
            } catch (e) {
                // don't block UI on history load failure
                console.warn('Failed to load chat history', e);
            }
        };
        loadHistory();
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: input,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);
        // Persist user message to server
        axios.post(`${API_URL}/chat/history`, {
            role: userMessage.role,
            content: userMessage.content,
            timestamp: userMessage.timestamp
        }).catch(err => console.warn('Failed to persist user message', err));
        setInput('');
        setIsLoading(true);

        try {
            const response = await axios.post(`${API_URL}/chat`, {
                message: input
            });

            const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: response.data.message || 'No response',
                timestamp: Date.now(),
                status: 'success'
            };

            setMessages(prev => [...prev, assistantMessage]);
            // Persist assistant reply
            axios.post(`${API_URL}/chat/history`, {
                role: assistantMessage.role,
                content: assistantMessage.content,
                timestamp: assistantMessage.timestamp,
                actions: response.data.actions
            }).catch(err => console.warn('Failed to persist assistant message', err));

            // If server returned a balance update action, append a concise balance message
            const actions = response.data.actions || [];
            const balanceAction = actions.find((a: any) => a.type === 'balance_update');
            if (balanceAction) {
                const { native, tokens } = balanceAction.details || {};
                // Safely parse native balance
                const nativeNum = Number(native);
                const nativeDisplay = Number.isFinite(nativeNum) ? nativeNum.toFixed(6) : String(native || '0');
                let balanceText = `🔄 **Updated Balances**\n\nCRO: **${nativeDisplay}**`;

                // Render token balances, skipping CRO to avoid duplicate native entry
                const tokenLines = Object.keys(tokens || {})
                    .filter(k => k.toUpperCase() !== 'CRO')
                    .map(k => {
                        const raw = tokens[k];
                        const num = Number(raw);
                        const display = Number.isFinite(num) ? num.toFixed(6) : (typeof raw === 'string' ? raw : '—');
                        return `${k}: **${display}**`;
                    })
                    .join('\n');

                if (tokenLines) balanceText += `\n${tokenLines}`;

                const balanceMsg: ChatMessage = {
                    id: `assistant-balance-${Date.now()}`,
                    role: 'assistant',
                    content: balanceText,
                    timestamp: Date.now(),
                    status: 'success'
                };
                setMessages(prev => [...prev, balanceMsg]);
                // Persist balance message
                axios.post(`${API_URL}/chat/history`, {
                    role: balanceMsg.role,
                    content: balanceMsg.content,
                    timestamp: balanceMsg.timestamp
                }).catch(err => console.warn('Failed to persist balance message', err));
            }
        } catch (error: any) {
            const errorMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: `Error: ${error.message || 'Failed to get response'}`,
                timestamp: Date.now(),
                status: 'error'
            };
            setMessages(prev => [...prev, errorMessage]);
            // Save the error into history as well
            axios.post(`${API_URL}/chat/history`, {
                role: errorMessage.role,
                content: errorMessage.content,
                timestamp: errorMessage.timestamp
            }).catch(err => console.warn('Failed to persist error message', err));
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = async () => {
        try {
            await axios.delete(`${API_URL}/chat/history`);
        } catch (e) {
            console.warn('Failed to clear chat history on server', e);
        }
        setMessages([]);
    };

    return (
        <div className="glass-card chat-container">
            <button className="btn-clear" onClick={clearChat} style={{ position: 'absolute', top: '1rem', right: '1rem', zIndex: 10 }}>Clear</button>

            <div className="chat-messages">
                {messages.length === 0 && (
                    <div style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '0.75rem', 
                        padding: '2rem 1rem',
                        alignItems: 'center' 
                    }}>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Try asking:</p>
                        {[
                            "What's my balance?",
                            "Analyze WCRO market",
                            "Buy 10 CRO of USDC"
                        ].map((question, i) => (
                            <button
                                key={i}
                                onClick={() => setInput(question)}
                                style={{
                                    padding: '0.75rem 1.5rem',
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    borderRadius: '8px',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s',
                                    fontSize: '0.9rem',
                                    width: '100%',
                                    maxWidth: '400px'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                                }}
                            >
                                {question}
                            </button>
                        ))}
                    </div>
                )}
                
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`message-bubble ${msg.role} ${msg.status || ''}`}
                    >
                        <div className="message-role">
                            {msg.role === 'user' ? '👤 YOU' : '🤖 SENTINEL AI'}
                        </div>
                        <div className="message-content">
                            {msg.content.split('\n').map((line, i) => {
                                // Handle markdown-style bold
                                const parts = line.split(/\*\*(.*?)\*\*/g);
                                return (
                                    <p key={i}>
                                        {parts.map((part, j) => 
                                            j % 2 === 0 ? part : <strong key={j}>{part}</strong>
                                        )}
                                    </p>
                                );
                            })}
                        </div>
                        <div className="message-footer">
                            <span className="message-time">
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {msg.status === 'error' && (
                                <span className="message-error-tag">! Error</span>
                            )}
                        </div>
                    </div>
                ))}

                {isLoading && (
                    <div className="message-bubble assistant loading">
                        <div className="message-role">🤖 Assistant</div>
                        <div className="message-content">
                            <div className="typing-indicator">
                                <span></span><span></span><span></span>
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            <form className="chat-input-form" onSubmit={sendMessage}>
                <input
                    type="text"
                    className="chat-input"
                    placeholder="Ask me anything..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                />
                <button 
                    type="submit" 
                    className="btn-send"
                    disabled={isLoading || !input.trim()}
                >
                    {isLoading ? (
                        <div className="btn-spinner"></div>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                    )}
                </button>
            </form>
        </div>
    );
}
