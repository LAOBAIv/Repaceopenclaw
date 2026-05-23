// WebSocket service for real-time group chat messaging
import { GroupChatMessage } from './groupChatApi';

interface WebSocketMessage {
  type: 'join' | 'message' | 'history';
  roomId?: string;
  content?: string;
  messages?: GroupChatMessage[];
  data?: GroupChatMessage;
}

class GroupChatWebSocketService {
  private ws: WebSocket | null = null;
  private url = 'ws://localhost:3001';
  private callbacks: Array<(message: GroupChatMessage) => void> = [];

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.debug('WebSocket connected');
        resolve();
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data.toString());
          
          switch (data.type) {
            case 'message':
              if (data.data) {
                this.callbacks.forEach(callback => callback(data.data!));
              }
              break;
            case 'history':
              // Handle history messages if needed
              break;
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
    });
  }

  joinRoom(roomId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot join room');
      return;
    }
    
    this.ws.send(JSON.stringify({ type: 'join', roomId }));
  }

  sendMessage(content: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not connected, cannot send message');
      return;
    }
    
    this.ws.send(JSON.stringify({ type: 'message', content }));
  }

  onMessage(callback: (message: GroupChatMessage) => void): void {
    this.callbacks.push(callback);
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.callbacks = [];
  }
}

export const groupChatWebSocket = new GroupChatWebSocketService();