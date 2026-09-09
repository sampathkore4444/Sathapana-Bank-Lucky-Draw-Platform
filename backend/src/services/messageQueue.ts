// Simple in-memory message queue for development
// In production, use RabbitMQ, Redis queues, or AWS SQS

type MessageHandler = (data: any) => Promise<void>;

interface QueueMessage {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

class MessageQueue {
  private queues: Map<string, QueueMessage[]> = new Map();
  private handlers: Map<string, MessageHandler[]> = new Map();
  private processing: Map<string, boolean> = new Map();

  constructor() {
    // Initialize default queues
    this.queues.set('notifications', []);
    this.queues.set('emails', []);
    this.queues.set('draws', []);
    this.queues.set('audit', []);
  }

  async publish(queue: string, type: string, data: any): Promise<string> {
    const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const message: QueueMessage = {
      id: messageId,
      type,
      data,
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3,
    };

    if (!this.queues.has(queue)) {
      this.queues.set(queue, []);
    }

    this.queues.get(queue)!.push(message);
    
    console.log(`[Queue] Published message ${messageId} to ${queue}`);
    
    // Process queue if not already processing
    this.processQueue(queue).catch(() => {});
    
    return messageId;
  }

  subscribe(queue: string, handler: MessageHandler): void {
    if (!this.handlers.has(queue)) {
      this.handlers.set(queue, []);
    }
    this.handlers.get(queue)!.push(handler);
    console.log(`[Queue] Subscribed to ${queue}`);
  }

  private async processQueue(queue: string): Promise<void> {
    if (this.processing.get(queue)) {
      return;
    }

    this.processing.set(queue, true);

    try {
      const messages = this.queues.get(queue) || [];
      const handlers = this.handlers.get(queue) || [];

      while (messages.length > 0) {
        const message = messages.shift()!;
        
        for (const handler of handlers) {
          try {
            await handler(message);
            console.log(`[Queue] Processed message ${message.id}`);
          } catch (error) {
            console.error(`[Queue] Error processing message ${message.id}:`, error);
            
            // Retry logic
            if (message.retryCount < message.maxRetries) {
              message.retryCount++;
              messages.push(message);
            }
          }
        }
      }
    } finally {
      this.processing.set(queue, false);
    }
  }

  async getQueueSize(queue: string): Promise<number> {
    return this.queues.get(queue)?.length || 0;
  }

  async clearQueue(queue: string): Promise<void> {
    this.queues.set(queue, []);
  }
}

export const messageQueue = new MessageQueue();
