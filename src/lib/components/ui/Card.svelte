<script lang="ts">
    import { Card as CardUI } from "$lib/components/ui/card";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import type { Card as CardType, Task } from '$lib/types';
    import { createEventDispatcher } from 'svelte';
    import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
    import { db } from '$lib/firebase/config';
  
    interface $$Props {
      card: CardType;
    }
  
    export let card: CardType;
    
    $: tasks = card?.tasks || [];
    
    const dispatch = createEventDispatcher<{
      drop: { draggedItem: any; targetCard: CardType };
    }>();
    
    let newTaskContent = '';
    let isDragging = false;
  
    async function addTask() {
      if (!newTaskContent.trim()) return;
  
      const newTask: Task = {
        id: crypto.randomUUID(),
        content: newTaskContent,
        cardId: card.id,
        position: tasks.length,
        createdAt: new Date()
      };
  
      try {
        await updateDoc(doc(db, 'cards', card.id), {
          tasks: arrayUnion(newTask)
        });
        newTaskContent = '';
      } catch (error) {
        console.error('Error adding task:', error);
      }
    }
  
    function handleDragStart(e: DragEvent) {
      if (!e.dataTransfer) return;
      isDragging = true;
      e.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'CARD',
        id: card.id,
        position: card.position
      }));
    }
  
    function handleDragEnd() {
      isDragging = false;
    }
  
    function handleDragOver(e: DragEvent) {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'move';
      }
    }
  
    function handleDrop(e: DragEvent) {
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
  </script>
  
  <CardUI>
    <div
      class="card-content p-4"
      draggable="true"
      on:dragstart={handleDragStart}
      on:dragend={handleDragEnd}
      on:dragover={handleDragOver}
      on:drop={handleDrop}
      class:dragging={isDragging}
      role="listitem"
      aria-label="Card container"
    >
      <div class="tasks-container min-h-[50px]" role="list" aria-label="Task list">
        {#each tasks as task (task.id)}
          <div 
            class="task bg-gray-100 p-2 mb-2 rounded cursor-move" 
            role="listitem"
            draggable="true"
            aria-label={`Task: ${task.content}`}
          >
            {task.content}
          </div>
        {/each}
      </div>
      
      <div class="add-task-form mt-4">
        <Input
          type="text"
          placeholder="Add a task..."
          bind:value={newTaskContent}
          class="mb-2"
        />
        <Button variant="secondary" class="w-full" on:click={addTask}>
          + Add Task
        </Button>
      </div>
    </div>
  </CardUI>
  
  <style>
    .dragging {
      opacity: 0.5;
    }
    
    .card-content {
      transition: transform 0.2s ease;
    }
    
    .card-content:hover {
      transform: translateY(-2px);
    }
  </style>