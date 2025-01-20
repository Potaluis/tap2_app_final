export interface Task {
  id: string;
  content: string;
  cardId: string;
  position: number;
  createdAt: Date;
}

export interface Card {
  id: string;
  position: number;
  title?: string;
  tasks: Task[];
  createdAt: Date;
}

export type DragItem = {
  type: 'CARD' | 'TASK';
  id: string;
  cardId?: string;
  position: number;
};