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

  // Get instance-specific storage keys
  private static getStorageKey(embedId?: string): string {
    return embedId ? `${this.STORAGE_KEY}-${embedId}` : this.STORAGE_KEY;
  }

  private static getCurrentThreadKey(embedId?: string): string {
    return embedId ? `${this.CURRENT_THREAD_KEY}-${embedId}` : this.CURRENT_THREAD_KEY;
  }

  static saveChatSession(session: ChatSession, embedId?: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const existingSessions = this.getChatSessions(embedId);
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
      
      localStorage.setItem(this.getStorageKey(embedId), JSON.stringify(limitedSessions));
    } catch (error) {
      console.error('Failed to save chat session:', error);
    }
  }

  static getChatSessions(embedId?: string): ChatSession[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const data = localStorage.getItem(this.getStorageKey(embedId));
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Failed to get chat sessions:', error);
      return [];
    }
  }

  static getAllSessions(): ChatSession[] {
    if (typeof window === 'undefined') return [];
    
    try {
      const allSessions: ChatSession[] = [];
      
      // Get sessions from default storage (no embedId)
      const defaultSessions = this.getChatSessions();
      allSessions.push(...defaultSessions);
      
      // Scan localStorage for all embed-specific sessions
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.STORAGE_KEY) && key !== this.STORAGE_KEY) {
          try {
            const data = localStorage.getItem(key);
            if (data) {
              const sessions = JSON.parse(data) as ChatSession[];
              allSessions.push(...sessions);
            }
          } catch (error) {
            console.error(`Failed to parse sessions from ${key}:`, error);
          }
        }
      }
      
      // Remove duplicates based on session ID and sort by timestamp
      const uniqueSessions = Array.from(
        new Map(allSessions.map(session => [session.id, session])).values()
      ).sort((a, b) => b.timestamp - a.timestamp);
      
      return uniqueSessions;
    } catch (error) {
      console.error('Failed to get all sessions:', error);
      return [];
    }
  }

  static deleteChatSession(sessionId: string, embedId?: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      const sessions = this.getChatSessions(embedId);
      const updatedSessions = sessions.filter(session => session.id !== sessionId);
      localStorage.setItem(this.getStorageKey(embedId), JSON.stringify(updatedSessions));
    } catch (error) {
      console.error('Failed to delete chat session:', error);
    }
  }

  static getCurrentThreadId(embedId?: string): string | null {
    if (typeof window === 'undefined') return null;
    
    try {
      return localStorage.getItem(this.getCurrentThreadKey(embedId));
    } catch (error) {
      console.error('Failed to get current thread ID:', error);
      return null;
    }
  }

  static setCurrentThreadId(threadId: string, embedId?: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.setItem(this.getCurrentThreadKey(embedId), threadId);
    } catch (error) {
      console.error('Failed to set current thread ID:', error);
    }
  }

  static clearCurrentThreadId(embedId?: string): void {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem(this.getCurrentThreadKey(embedId));
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