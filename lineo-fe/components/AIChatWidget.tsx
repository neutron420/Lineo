"use client";

import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Bot, Sparkles, User } from 'lucide-react';
import api from '@/lib/api';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export const AIChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi there! I am your Lineo AI Assistant. How can I help you today? You can ask me about your queue wait time, booking an appointment, or our services! ✨' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionID, setSessionID] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Persistent Session & History Fetching
  useEffect(() => {
    const savedSession = localStorage.getItem('lineo_chat_session');
    if (savedSession) {
      setSessionID(savedSession);
      fetchHistory(savedSession);
    }
  }, []);

  const fetchHistory = async (id: string) => {
    try {
      const response = await api.get(`/chat/history?session_id=${id}`);
      if (response.data.history && response.data.history.length > 0) {
        const historyMessages = response.data.history.map((m: any) => ({
          role: m.Role,
          content: m.Content
        }));
        setMessages(historyMessages);
      }
    } catch (error) {
      console.error("Failed to load chat history", error);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Send to our new Go endpoint
      const response = await api.post('/chat', {
        message: userMessage,
        session_id: sessionID || "",
        org_id: "1" // Default org for testing
      });

      const newSessionID = response.data.session_id;
      setSessionID(newSessionID);
      localStorage.setItem('lineo_chat_session', newSessionID);
      
      setMessages(prev => [...prev, { role: 'assistant', content: response.data.response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Oops, I lost connection to the server! Please try again.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* The Chat Window */}
      {isOpen && (
        <div className="mb-4 flex h-[500px] w-[350px] flex-col overflow-hidden rounded-2xl border border-[#e5e8eb] bg-white shadow-2xl transition-all duration-300">
          
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-[#493ee5] to-[#635bff] p-4 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold leading-none">Lineo Assistant</h3>
                <span className="text-[10px] font-medium text-white/80">Powered by ChatGPT</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="rounded-full p-1 hover:bg-white/20 transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f8f9fc]">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex max-w-[85%] items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Avatar */}
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${msg.role === 'user' ? 'bg-slate-200 text-slate-500' : 'bg-[#493ee5]/10 text-[#493ee5]'}`}>
                    {msg.role === 'user' ? <User className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                  </div>

                  {/* Bubble */}
                  <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === 'user' 
                      ? 'bg-[#493ee5] text-white rounded-br-none shadow-md' 
                      : 'bg-white text-[#181c1e] rounded-bl-none border border-[#e5e8eb] shadow-sm'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-end gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#493ee5]/10 text-[#493ee5]">
                    <Bot className="h-3 w-3" />
                  </div>
                  <div className="flex items-center gap-1 rounded-2xl rounded-bl-none border border-[#e5e8eb] bg-white px-4 py-3 shadow-sm">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#493ee5]/60" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#493ee5]/60" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#493ee5]/60" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-[#e5e8eb] bg-white p-3">
            <div className="flex items-center gap-2 rounded-xl border border-[#e5e8eb] bg-[#f8f9fc] p-1 pr-2">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 bg-transparent px-3 py-2 text-sm text-[#181c1e] outline-none placeholder:text-slate-400"
                disabled={isLoading}
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#493ee5] text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
              >
                <Send className="h-4 w-4 ml-0.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="group flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-tr from-[#493ee5] to-[#635bff] text-white shadow-xl transition-all duration-300 hover:scale-110 hover:shadow-2xl hover:shadow-[#493ee5]/30 active:scale-95"
      >
        {isOpen ? <X className="h-6 w-6 transition-transform group-hover:rotate-90" /> : <MessageSquare className="h-6 w-6" />}
      </button>
    </div>
  );
};
