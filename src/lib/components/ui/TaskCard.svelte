<script lang="ts">
  import { Card } from "$lib/components/ui/card";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input";
  import { Trash2, Plus, X, GripHorizontal, Pencil } from "lucide-svelte";
  import type { Card as CardType, Task } from '$lib/types';
  import { createEventDispatcher } from 'svelte';
  import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
  import { db } from '$lib/firebase/config';

  // Props and event dispatching
  interface $$Props {
      card: CardType;
  }

  export let card: CardType;
  const dispatch = createEventDispatcher();

  // Reactive statement for tasks
  $: tasks = card?.tasks || [];

  // Component states
  let isAddingTask = false;
  let newTaskContent = '';
  let isDragging = false;
  let isEditingTitle = false;
  let cardTitle = card.title || `Card ${card.position + 1}`;

  // Card drag and drop
  function handleCardDragStart(e: DragEvent) {
      if (!e.dataTransfer) return;
      isDragging = true;
      e.dataTransfer.setData('text/plain', JSON.stringify({
          type: 'CARD',
          id: card.id,
          position: card.position
      }));
  }

  function handleCardDragEnd() {
      isDragging = false;
  }

  function handleCardDragOver(e: DragEvent) {
      e.preventDefault();
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

  // Task management
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

  // Add new task
  function startNewTask() {
    isAddingTask = true;
    // Wait for the input to be rendered
    setTimeout(() => {
        // Find the input element and specify its type
        const input: HTMLInputElement | null = document.querySelector(`#new-task-${card.id}`);
        // Only call focus if we found the input
        if (input !== null) {
            input.focus();
        }
    }, 0);
}

  // Delete task
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

  // Delete card
  async function deleteCard() {
      try {
          dispatch('delete', { cardId: card.id });
      } catch (error) {
          console.error('Error deleting card:', error);
      }
  }

  // Title editing
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

<Card>
  <div
  class="card-content p-4 w-80 bg-white rounded-lg shadow-sm hover:shadow-md transition-all duration-200"
  draggable="true"
  on:dragstart={handleCardDragStart}
  on:dragend={handleCardDragEnd}
  on:dragover={handleCardDragOver}
  on:drop={handleCardDrop}
  class:dragging={isDragging}
  role="listitem" 
  aria-label="Draggable card" 
>
      <!-- Card Header -->
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
                          class="opacity-0 group-hover:opacity-100 hover:text-blue-500 p-1 transition-opacity"
                          on:click={() => isEditingTitle = true}
                      >
                          <Pencil class="h-3 w-3" />
                      </button>
                  </div>
              {/if}
          </div>
          <Button 
              variant="ghost" 
              size="icon" 
              class="h-8 w-8 text-gray-400 hover:text-red-500 transition-colors" 
              on:click={deleteCard}
          >
              <Trash2 class="h-4 w-4" />
          </Button>
      </div>

      <!-- Tasks List -->
      <div 
          class="tasks-container min-h-[50px] max-h-[60vh] overflow-y-auto space-y-2" 
          role="list"
      >
          {#each tasks as task (task.id)}
              <div 
                  class="task bg-gray-50 p-3 rounded-md flex items-center group hover:bg-gray-100 transition-colors"
                  draggable="true"
              >
                  <div class="w-1 h-5 bg-blue-400 rounded mr-3"/>
                  <div class="mr-2 text-gray-400">
                      <GripHorizontal class="h-4 w-4" />
                  </div>
                  <span class="flex-1">{task.content}</span>
                  <button
                      class="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-opacity"
                      on:click={() => deleteTask(task)}
                  >
                      <X class="h-4 w-4" />
                  </button>
              </div>
          {/each}

          <!-- New Task Input -->
          {#if isAddingTask}
              <div class="animate-in fade-in duration-300">
                  <Input
                      id="new-task-{card.id}"
                      type="text"
                      bind:value={newTaskContent}
                      placeholder="Press Enter to save, Escape to cancel"
                      class="mb-2"
                      on:keydown={handleTaskCreate}
                      on:blur={handleTaskBlur}
                  />
              </div>
          {/if}
      </div>
      
      <!-- Add Task Button -->
      <div class="mt-4">
          <Button 
              variant="ghost" 
              class="w-full border border-dashed border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all" 
              on:click={startNewTask}
          >
              <Plus class="h-4 w-4 mr-2" />
              Add Task
          </Button>
      </div>
  </div>
</Card>

<style>
  .dragging {
      opacity: 0.6;
  }

  .tasks-container {
      scrollbar-width: thin;
      scrollbar-color: #cbd5e1 transparent;
  }

  .tasks-container::-webkit-scrollbar {
      width: 5px;
  }

  .tasks-container::-webkit-scrollbar-thumb {
      background: #cbd5e1;
      border-radius: 5px;
  }
</style>