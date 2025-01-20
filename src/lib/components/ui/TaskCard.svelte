<script lang="ts">
  import { Card } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Trash2, Plus, X, GripHorizontal, Pencil } from "lucide-svelte";
  import type { Card as CardType, Task } from '$lib/types';
  import { createEventDispatcher } from 'svelte';
  import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
  import { db } from '$lib/firebase/config';

  interface $$Props {
      card: CardType;
  }

  export let card: CardType;
  
  $: tasks = card?.tasks || [];
  
  const dispatch = createEventDispatcher<{
      drop: { draggedItem: any; targetCard: CardType };
      delete: { cardId: string };
  }>();
  
  let isAddingTask = false;
  let newTaskContent = '';
  let isDragging = false;
  let isEditingTitle = false;
  let cardTitle = card.title || `Card ${card.position + 1}`;

  // Card drag handlers
  function handleCardDragStart(e: DragEvent) {
      if (!e.dataTransfer) return;
      isDragging = true;
      e.dataTransfer.setData('text/plain', JSON.stringify({
          type: 'CARD',
          id: card.id,
          position: card.position
      }));
      e.dataTransfer.effectAllowed = 'move';
  }

  function handleCardDragEnd() {
      isDragging = false;
  }

  function handleCardDragOver(e: DragEvent) {
      e.preventDefault();
      if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
      }
  }

  function handleCardDrop(e: DragEvent) {
      e.preventDefault();
      const data = e.dataTransfer?.getData('text/plain');
      if (!data) return;

      try {
          const draggedItem = JSON.parse(data);
          dispatch('drop', { draggedItem, targetCard: card });
      } catch (error) {
          console.error('Error parsing drop data:', error);
      }
  }

  // Task handlers
  async function handleTaskCreate(event: KeyboardEvent) {
      if (event.key === 'Enter') {
          event.preventDefault();
          if (newTaskContent.trim()) {
              const newTask: Task = {
                  id: crypto.randomUUID(),
                  content: newTaskContent.trim(),
                  cardId: card.id,
                  position: tasks.length,
                  createdAt: new Date()
              };

              try {
                  await updateDoc(doc(db, 'cards', card.id), {
                      tasks: arrayUnion(newTask)
                  });
                  newTaskContent = '';
                  isAddingTask = false;
              } catch (error) {
                  console.error('Error adding task:', error);
              }
          } else {
              newTaskContent = '';
              isAddingTask = false;
          }
      } else if (event.key === 'Escape') {
          newTaskContent = '';
          isAddingTask = false;
      }
  }

  function handleTaskBlur() {
      if (!newTaskContent.trim()) {
          newTaskContent = '';
          isAddingTask = false;
      }
  }

  function startNewTask() {
      isAddingTask = true;
      setTimeout(() => {
          const input = document.querySelector(`#new-task-${card.id}`) as HTMLInputElement;
          if (input) input.focus();
      }, 0);
  }

  function handleTaskDragStart(e: DragEvent, task: Task) {
      if (!e.dataTransfer) return;
      e.dataTransfer.setData('text/plain', JSON.stringify({
          type: 'TASK',
          id: task.id,
          cardId: card.id,
          content: task.content,
          position: task.position
      }));
      e.dataTransfer.effectAllowed = 'move';
  }

  async function handleContainerTaskDrop(e: DragEvent) {
  e.preventDefault();
  const data = e.dataTransfer?.getData('text/plain');
  if (!data) return;

  try {
    const draggedItem = JSON.parse(data);
    
    if (draggedItem.type === 'TASK') {
      if (draggedItem.cardId === card.id) {
        // Reorder within the same card
        const updatedTasks = [...tasks];
        const draggedTaskIndex = updatedTasks.findIndex(t => t.id === draggedItem.id);
        
        // Find the drop position
        const dropY = e.clientY;
        let targetTaskIndex = updatedTasks.findIndex((task, index) => {
          const taskElement = document.querySelector(`#task-${task.id}`);
          if (!taskElement) return false;
          
          const rect = taskElement.getBoundingClientRect();
          const taskMidpoint = rect.top + rect.height / 2;
          
          return dropY < taskMidpoint;
        });

        // If no specific target found, append to the end
        if (targetTaskIndex === -1) {
          targetTaskIndex = updatedTasks.length;
        }

        // Remove the dragged task from its original position
        const [removedTask] = updatedTasks.splice(draggedTaskIndex, 1);
        
        // Insert the task at the new position
        updatedTasks.splice(targetTaskIndex, 0, removedTask);

        // Reindex all tasks
        const reorderedTasks = updatedTasks.map((task, index) => ({
          ...task,
          position: index
        }));

        await updateDoc(doc(db, 'cards', card.id), {
          tasks: reorderedTasks
        });
      } else {
        // Move between cards (existing logic remains the same)
        const sourceCard = doc(db, 'cards', draggedItem.cardId);
        const targetCard = doc(db, 'cards', card.id);
        
        const task = {
          id: draggedItem.id,
          content: draggedItem.content,
          cardId: card.id,
          position: tasks.length,
          createdAt: new Date()
        };

        await updateDoc(sourceCard, {
          tasks: arrayRemove(draggedItem)
        });
        await updateDoc(targetCard, {
          tasks: arrayUnion(task)
        });
      }
    }
  } catch (error) {
    console.error('Error moving task:', error);
  }
}

  async function deleteTask(taskToDelete: Task) {
      try {
          await updateDoc(doc(db, 'cards', card.id), {
              tasks: arrayRemove(taskToDelete)
          });

          const updatedTasks = tasks
              .filter(t => t.id !== taskToDelete.id)
              .map((t, index) => ({
                  ...t,
                  position: index
              }));

          await updateDoc(doc(db, 'cards', card.id), {
              tasks: updatedTasks
          });
      } catch (error) {
          console.error('Error deleting task:', error);
      }
  }

  async function deleteCard() {
      try {
          dispatch('delete', { cardId: card.id });
      } catch (error) {
          console.error('Error deleting card:', error);
      }
  }

  async function updateCardTitle() {
      if (cardTitle.trim()) {
          try {
              await updateDoc(doc(db, 'cards', card.id), {
                  title: cardTitle.trim()
              });
          } catch (error) {
              console.error('Error updating card title:', error);
          }
      } else {
          cardTitle = `Card ${card.position + 1}`;
      }
      isEditingTitle = false;
  }

  function handleTitleKeydown(event: KeyboardEvent) {
      if (event.key === 'Enter') {
          event.preventDefault();
          updateCardTitle();
      } else if (event.key === 'Escape') {
          cardTitle = card.title || `Card ${card.position + 1}`;
          isEditingTitle = false;
      }
  }
</script>

<Card class="h-full">
  <div
    class="card-content p-4 w-80"
    draggable="true"
    on:dragstart={handleCardDragStart}
    on:dragend={handleCardDragEnd}
    on:dragover={handleCardDragOver}
    on:drop={handleCardDrop}
    class:dragging={isDragging}
    role="listitem"
    aria-label="Card container"
  >
    <div class="flex justify-between items-center mb-4 group">
      <div class="flex items-center gap-2">
        {#if isEditingTitle}
          <input
            type="text"
            bind:value={cardTitle}
            class="text-sm font-medium w-48 p-1 rounded bg-transparent border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            on:keydown={handleTitleKeydown}
            on:blur={updateCardTitle}
            autofocus
          />
        {:else}
          <div class="flex items-center gap-1">
            <h3 class="text-sm font-medium">{cardTitle}</h3>
            <button
              class="opacity-0 group-hover:opacity-100 hover:text-blue-500 p-1"
              on:click={() => isEditingTitle = true}
              aria-label="Edit card title"
            >
              <Pencil class="h-3 w-3" />
            </button>
          </div>
        {/if}
      </div>
      <Button 
        variant="ghost" 
        size="icon" 
        class="h-8 w-8 text-destructive hover:text-destructive" 
        on:click={deleteCard}
      >
        <Trash2 class="h-4 w-4" />
        <span class="sr-only">Delete card</span>
      </Button>
    </div>

    <div 
    class="tasks-container min-h-[50px] max-h-[60vh] overflow-y-auto" 
    role="list" 
    aria-label="Task list"
    on:dragover|preventDefault
    on:drop={handleContainerTaskDrop}
  >
      {#each tasks as task (task.id)}
        <div 
          class="task bg-gray-100 p-2 mb-2 rounded flex items-center group hover:shadow-sm"
          role="listitem"
          draggable="true"
          on:dragstart={(e) => handleTaskDragStart(e, task)}
          aria-label={`Task: ${task.content}`}
        >
          <div class="drag-handle mr-2 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
            <GripHorizontal class="h-4 w-4" />
          </div>
          <span class="flex-1 break-words pr-2">{task.content}</span>
          <button
            class="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:text-destructive"
            on:click={() => deleteTask(task)}
            aria-label="Delete task"
          >
            <X class="h-4 w-4" />
          </button>
        </div>
      {/each}

      {#if isAddingTask}
      <Input
          id="new-task-{card.id}"
          type="text"
          bind:value={newTaskContent}
          placeholder="Press Enter to save, Escape to cancel"
          class="mb-2"
          on:keydown={handleTaskCreate}
          on:blur={handleTaskBlur}
      />
  {/if}
    </div>
    
    <div class="mt-4">
      <Button 
        variant="ghost" 
        class="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 hover:border-gray-400" 
        on:click={startNewTask}
      >
        <Plus class="h-4 w-4" />
        Add Task
      </Button>
    </div>
  </div>
</Card>

<style>
  .dragging {
    opacity: 0.5;
  }
  
  .card-content {
    transition: transform 0.2s ease;
    min-height: 150px;
  }
  
  .card-content:hover {
    transform: translateY(-2px);
  }

  :global(.task) {
    transition: all 0.2s ease;
  }

  :global(.task:hover) {
    background-color: #e5e7eb;
  }

  .drag-handle {
    touch-action: none;
    opacity: 0.5;
  }

  .task:hover .drag-handle {
    opacity: 1;
  }

  .tasks-container {
    scrollbar-width: thin;
    scrollbar-color: #cbd5e1 transparent;
  }

  .tasks-container::-webkit-scrollbar {
    width: 6px;
  }

  .tasks-container::-webkit-scrollbar-track {
    background: transparent;
  }

  .tasks-container::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 3px;
  }
</style>