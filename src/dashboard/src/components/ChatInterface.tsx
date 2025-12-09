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
        } catch (error: any) {
            const errorMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: `Error: ${error.message || 'Failed to get response'}`,
                timestamp: Date.now(),
                status: 'error'
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        setMessages([]);
    };

    return (
        <div className="glass-card chat-container">
            <div className="chat-header">
                <h2>💬 Smart Wallet Chat</h2>
                <button className="btn-clear" onClick={clearChat}>Clear</button>
            </div>

            <div className="chat-messages">
                {messages.length === 0 && (
                    <div className="chat-empty">
                        <p>👋 Hi! I'm your AI trading assistant.</p>
                        <p>Try asking:</p>
                        <ul>
                            <li>"What's my balance?"</li>
                            <li>"Analyze WCRO market"</li>
                            <li>"Buy 10 CRO of USDC"</li>
                        </ul>
                    </div>
                )}
                
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={`message-bubble ${msg.role}`}
                    >
                        <div className="message-role">
                            {msg.role === 'user' ? '👤 You' : '🤖 Assistant'}
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
                        {msg.status === 'error' && (
                            <div className="message-error">⚠️ Error</div>
                        )}
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
                    {isLoading ? '⏳' : '📤'}
                </button>
            </form>
        </div>
    );
}
