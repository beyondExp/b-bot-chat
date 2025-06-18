export interface ChatSession {
  id: string;
  threadId: string;
  agentId: string;
  title: string;
  lastMessage: string;
  timestamp: number;
  userId?: string;
}

export class ChatHistoryManager {
  private static STORAGE_KEY = 'embed-chat-history';
  private static CURRENT_THREAD_KEY = 'embed-current-thread';

  static saveChatSession(session: ChatSession): void {
    if (typeof window === 'undefined') return;
    
    try {
      const existingSessions = this.getChatSessions();
      const existingIndex = existingSessions.findIndex(s => s.id === session.id);
      
      if (existingIndex >= 0) {
        // Update existing session
        existingSessions[existingIndex] = session;
      } else {
        // Add new session
        existingSessions.unshift(session);
      }
      
      // Keep only the latest 50 conversations
      const limitedSessions = existingSessions.slice(0, 50);
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(limitedSessions));
    } catch (error) {
      console.error('Failed to save chat session:', error);
    }
  }

  static getChatSessions(): ChatSession[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get chat sessions:', error);
      return [];
    }
  }

  static deleteChatSession(sessionId: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const sessions = this.getChatSessions();
      const filteredSessions = sessions.filter(s => s.id !== sessionId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filteredSessions));
    } catch (error) {
      console.error('Failed to delete chat session:', error);
    }
  }

  static getCurrentThreadId(): string | null {
    if (typeof window === 'undefined') return null;
    
    try {
      return localStorage.getItem(this.CURRENT_THREAD_KEY);
    } catch (error) {
      console.error('Failed to get current thread ID:', error);
      return null;
    }
  }

  static setCurrentThreadId(threadId: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.CURRENT_THREAD_KEY, threadId);
    } catch (error) {
      console.error('Failed to set current thread ID:', error);
    }
  }

  static clearCurrentThreadId(): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(this.CURRENT_THREAD_KEY);
    } catch (error) {
      console.error('Failed to clear current thread ID:', error);
    }
  }

  static generateChatTitle(firstMessage: string): string {
    if (!firstMessage) return 'New Chat';
    
    // Take first 50 characters and add ellipsis if longer
    const truncated = firstMessage.length > 50 
      ? firstMessage.substring(0, 50) + '...' 
      : firstMessage;
    
    return truncated;
  }

  static formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else if (diffInDays < 7) {
      return date.toLocaleDateString([], { weekday: 'long' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  }
} 