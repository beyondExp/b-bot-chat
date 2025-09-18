interface MessageMetadata {
  branch?: string;
  branchOptions?: string[];
  firstSeenState?: {
    parent_checkpoint?: string;
    values?: any;
  };
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool_call" | "tool_response";
  content: string;
  type?: "human" | "ai" | "tool";
  tool_calls?: Array<{
    id?: string;
    name: string;
    args: Record<string, any>;
  }>;
  tool_call_id?: string;
  name?: string;
}

interface MessageBranch {
  id: string;
  content: string;
  timestamp: number;
}

interface BranchPoint {
  messageIndex: number;
  branches: MessageBranch[];
  activeBranchIndex: number;
  linkedBranchIndex?: number; // Index of linked branch point (for question-answer pairs)
}

class MessageMetadataManager {
  private messageMetadata: Map<string, MessageMetadata> = new Map();
  private branchPoints: Map<number, BranchPoint> = new Map(); // messageIndex -> branch data
  private baseConversation: ChatMessage[] = [];

  constructor() {}

  // Set the base conversation
  setBaseConversation(messages: ChatMessage[]): void {
    this.baseConversation = [...messages];
  }

  // Create a branch at a specific message index
  createBranchAtIndex(messageIndex: number, originalContent: string, newContent: string, linkToPrevious: boolean = true): void {
    const existingBranchPoint = this.branchPoints.get(messageIndex);
    
    if (existingBranchPoint) {
      // Add new branch to existing branch point
      const newBranch: MessageBranch = {
        id: `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: newContent,
        timestamp: Date.now()
      };
      existingBranchPoint.branches.push(newBranch);
      existingBranchPoint.activeBranchIndex = existingBranchPoint.branches.length - 1;
    } else {
      // Create new branch point
      const originalBranch: MessageBranch = {
        id: 'original',
        content: originalContent,
        timestamp: 0
      };
      const newBranch: MessageBranch = {
        id: `branch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: newContent,
        timestamp: Date.now()
      };
      
      // Determine if this should be linked to another branch point
      let linkedBranchIndex: number | undefined;
      
      if (linkToPrevious && messageIndex < this.baseConversation.length) {
        const message = this.baseConversation[messageIndex];
        
        // If this is an AI message, link to the previous user message (if it has branches)
        if (message.role === "assistant" && messageIndex > 0) {
          const prevMessage = this.baseConversation[messageIndex - 1];
          if (prevMessage.role === "user" && this.branchPoints.has(messageIndex - 1)) {
            linkedBranchIndex = messageIndex - 1;
          }
        }
        // For user messages, don't auto-link - let the AI response creation handle the linking
      }
      
      this.branchPoints.set(messageIndex, {
        messageIndex,
        branches: [originalBranch, newBranch],
        activeBranchIndex: 1, // Start with the new branch active
        linkedBranchIndex
      });
      
      // If we have a linked branch, also set the reverse link
      if (linkedBranchIndex !== undefined) {
        const linkedBranchPoint = this.branchPoints.get(linkedBranchIndex);
        if (linkedBranchPoint) {
          linkedBranchPoint.linkedBranchIndex = messageIndex;
        }
      }
    }
  }

  // Link two branch points together (for question-answer pairs)
  linkBranchPoints(index1: number, index2: number): void {
    const branchPoint1 = this.branchPoints.get(index1);
    const branchPoint2 = this.branchPoints.get(index2);
    
    if (branchPoint1 && branchPoint2) {
      branchPoint1.linkedBranchIndex = index2;
      branchPoint2.linkedBranchIndex = index1;
      console.log(`Linked branch points at indices ${index1} and ${index2}`);
    }
  }

  // Switch to a different branch at a message index
  switchBranch(messageIndex: number, direction: 'prev' | 'next'): boolean {
    const branchPoint = this.branchPoints.get(messageIndex);
    if (!branchPoint) {
      console.log(`No branch point found at index ${messageIndex}`);
      return false;
    }

    const currentIndex = branchPoint.activeBranchIndex;
    let newIndex = currentIndex;

    if (direction === 'prev' && currentIndex > 0) {
      newIndex = currentIndex - 1;
    } else if (direction === 'next' && currentIndex < branchPoint.branches.length - 1) {
      newIndex = currentIndex + 1;
    } else {
      console.log(`Can't switch ${direction} from index ${currentIndex} (max: ${branchPoint.branches.length - 1})`);
      return false; // Can't switch further
    }

    console.log(`Switching branch at index ${messageIndex} from ${currentIndex} to ${newIndex}`);
    branchPoint.activeBranchIndex = newIndex;
    
    // If this branch point is linked to another, coordinate the switch
    if (branchPoint.linkedBranchIndex !== undefined) {
      const linkedBranchPoint = this.branchPoints.get(branchPoint.linkedBranchIndex);
      console.log(`Found linked branch at index ${branchPoint.linkedBranchIndex}:`, linkedBranchPoint);
      
      if (linkedBranchPoint) {
        // Switch the linked branch to the same relative position if possible
        if (newIndex < linkedBranchPoint.branches.length) {
          console.log(`Switching linked branch from ${linkedBranchPoint.activeBranchIndex} to ${newIndex}`);
          linkedBranchPoint.activeBranchIndex = newIndex;
        } else {
          console.log(`Cannot switch linked branch: newIndex ${newIndex} >= branches length ${linkedBranchPoint.branches.length}`);
        }
      } else {
        console.log(`Linked branch point not found at index ${branchPoint.linkedBranchIndex}`);
      }
    } else {
      console.log(`No linked branch for index ${messageIndex}`);
    }
    
    return true;
  }

  // Get the current conversation with active branches
  getCurrentConversation(): ChatMessage[] {
    if (this.branchPoints.size === 0) {
      return this.baseConversation;
    }

    const result: ChatMessage[] = [];
    
    // Build conversation by applying active branches
    for (let i = 0; i < this.baseConversation.length; i++) {
      const branchPoint = this.branchPoints.get(i);
      
      if (branchPoint) {
        // Use the active branch content for this message
        const activeBranch = branchPoint.branches[branchPoint.activeBranchIndex];
        console.log(`Applying branch for message ${i}: activeBranchIndex=${branchPoint.activeBranchIndex}/${branchPoint.branches.length-1}, content="${activeBranch.content.substring(0, 50)}..."`);
        console.log(`All branches for message ${i}:`, branchPoint.branches.map((b, idx) => `${idx}: "${b.content.substring(0, 30)}..."`));
        result.push({
          ...this.baseConversation[i],
          content: activeBranch.content
        });
      } else {
        // No branch, use original message
        console.log(`No branch for message ${i}, using original: "${this.baseConversation[i].content.substring(0, 50)}..."`);
        result.push(this.baseConversation[i]);
      }
    }

    // Now find the earliest branch point and truncate after its corresponding response
    const branchIndices = Array.from(this.branchPoints.keys()).sort((a, b) => a - b);
    
    if (branchIndices.length > 0) {
      const earliestBranchIndex = branchIndices[0];
      const branchedMessage = this.baseConversation[earliestBranchIndex];
      
      // If the branched message is a user message, include up to the next AI response (if it exists)
      if (branchedMessage.role === "user") {
        const correspondingAIIndex = earliestBranchIndex + 1;
        if (correspondingAIIndex < result.length && 
            result[correspondingAIIndex].role === "assistant") {
          // Truncate after the AI response
          return result.slice(0, correspondingAIIndex + 1);
        } else {
          // No AI response yet, truncate after the user message
          return result.slice(0, earliestBranchIndex + 1);
        }
      } else {
        // If the branched message is an AI response, truncate after it
        return result.slice(0, earliestBranchIndex + 1);
      }
    }

    return result;
  }

  // Get metadata for a message at a specific index
  getMessageMetadata(message: ChatMessage): MessageMetadata | undefined {
    // Find the message index in base conversation
    const messageIndex = this.baseConversation.findIndex(m => m.id === message.id);
    if (messageIndex === -1) return undefined;

    const branchPoint = this.branchPoints.get(messageIndex);
    if (!branchPoint) return undefined;

    const branches = branchPoint.branches.map(b => b.id);
    const currentBranch = branchPoint.branches[branchPoint.activeBranchIndex].id;

    return {
      branch: currentBranch,
      branchOptions: branches,
      firstSeenState: {
        parent_checkpoint: `checkpoint_${messageIndex}`
      }
    };
  }

  // Handle branch selection for a specific message
  handleBranchSelect(messageId: string, direction: 'prev' | 'next'): boolean {
    const messageIndex = this.baseConversation.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return false;

    return this.switchBranch(messageIndex, direction);
  }

  // Get next branch index after current index
  private getNextBranchIndex(currentIndex: number): number {
    const indices = Array.from(this.branchPoints.keys()).sort((a, b) => a - b);
    const nextIndex = indices.find(index => index > currentIndex);
    return nextIndex !== undefined ? nextIndex : -1;
  }

  // Check if a message has branches
  hasMultipleBranches(messageId: string): boolean {
    const messageIndex = this.baseConversation.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return false;
    
    const branchPoint = this.branchPoints.get(messageIndex);
    return branchPoint ? branchPoint.branches.length > 1 : false;
  }

  // Get branch info for a message
  getBranchInfo(messageId: string): { current: number; total: number } | null {
    const messageIndex = this.baseConversation.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return null;
    
    const branchPoint = this.branchPoints.get(messageIndex);
    if (!branchPoint) return null;

    return {
      current: branchPoint.activeBranchIndex + 1,
      total: branchPoint.branches.length
    };
  }

  // Generate a simple checkpoint ID (in real LangGraph this would be more sophisticated)
  generateCheckpoint(messageId: string): string {
    return `checkpoint_${messageId}_${Date.now()}`;
  }

  // Set parent checkpoint for a message (used for time travel)
  setParentCheckpoint(messageId: string, parentCheckpoint: string): void {
    const currentMetadata = this.messageMetadata.get(messageId) || {};
    this.setMessageMetadata(messageId, {
      ...currentMetadata,
      firstSeenState: {
        ...currentMetadata.firstSeenState,
        parent_checkpoint: parentCheckpoint
      }
    });
  }

  // Set metadata for a message
  setMessageMetadata(messageId: string, metadata: MessageMetadata): void {
    this.messageMetadata.set(messageId, metadata);
  }

  // Clear all metadata (for new conversations)
  clear(): void {
    this.messageMetadata.clear();
    this.branchPoints.clear();
    this.baseConversation = [];
  }

  // Debug helper to log current state
  debugState(): void {
    console.log('=== Branch Manager Debug ===');
    console.log('Base conversation:', this.baseConversation);
    console.log('Branch points:', Array.from(this.branchPoints.entries()));
    console.log('Current conversation:', this.getCurrentConversation());
    console.log('===========================');
  }
}

// Singleton instance
export const messageMetadataManager = new MessageMetadataManager();

export type { MessageMetadata, ChatMessage }; 