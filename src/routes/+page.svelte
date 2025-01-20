<script lang="ts">
  import { onMount } from 'svelte';
  import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
  import { db } from '$lib/firebase/config';
  import TaskCard from '$lib/components/ui/TaskCard.svelte';
  import { Button } from "$lib/components/ui/button";
  import type { Card as CardType, DragItem } from '$lib/types';

  let cards: CardType[] = [];
  let isLoading = true;

  onMount(() => {
      const q = query(collection(db, 'cards'), orderBy('position'));
      
      return onSnapshot(q, (snapshot) => {
          cards = snapshot.docs.map(doc => ({
              id: doc.id,
              position: doc.data().position || 0,
              title: doc.data().title,
              tasks: doc.data().tasks || [],
              createdAt: doc.data().createdAt?.toDate() || new Date()
          })) as CardType[];
          isLoading = false;
      });
  });

  async function createCard() {
      try {
          const newCard = {
              position: cards.length,
              tasks: [],
              createdAt: new Date()
          };
          
          await addDoc(collection(db, 'cards'), newCard);
      } catch (error) {
          console.error('Error creating card:', error);
      }
  }

  async function handleDrop(event: CustomEvent<{draggedItem: DragItem; targetCard: CardType}>) {
      const { draggedItem, targetCard } = event.detail;

      if (draggedItem.type === 'CARD') {
          const draggedCard = cards.find(c => c.id === draggedItem.id);
          const targetPosition = cards.findIndex(c => c.id === targetCard.id);
          
          if (draggedCard && targetPosition !== -1) {
              try {
                  const newCards = [...cards];
                  const draggedPosition = cards.findIndex(c => c.id === draggedCard.id);
                  
                  newCards.splice(draggedPosition, 1);
                  newCards.splice(targetPosition, 0, draggedCard);
                  
                  await Promise.all(newCards.map((card, index) => 
                      updateDoc(doc(db, 'cards', card.id), { position: index })
                  ));
              } catch (error) {
                  console.error('Error updating card positions:', error);
              }
          }
      }
  }

  async function handleDeleteCard(event: CustomEvent<{cardId: string}>) {
      const { cardId } = event.detail;
      
      if (!cardId) {
          console.error('No card ID provided for deletion');
          return;
      }

      try {
          await deleteDoc(doc(db, 'cards', cardId));
          
          const remainingCards = cards.filter(c => c.id !== cardId);
          await Promise.all(remainingCards.map((card, index) => 
              updateDoc(doc(db, 'cards', card.id), { position: index })
          ));
      } catch (error) {
          console.error('Error deleting card:', error);
      }
  }
</script>

<div class="min-h-screen bg-gray-100 p-8">
  {#if isLoading}
      <div class="flex justify-center items-center h-full">
          <p class="text-lg text-gray-600">Loading cards...</p>
      </div>
  {:else}
      <div 
          class="flex flex-wrap gap-4" 
          role="list"
          aria-label="Board"
      >
          {#each cards as card (card.id)}
              <TaskCard 
                  {card} 
                  on:drop={handleDrop}
                  on:delete={handleDeleteCard}
              />
          {/each}
          
          <div role="listitem">
              <Button 
                  variant="outline" 
                  class="h-[50px] w-72 flex items-center justify-center gap-2" 
                  on:click={createCard}
              >
                  + Add Card
              </Button>
          </div>
      </div>
  {/if}
</div>