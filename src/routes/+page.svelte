<script lang="ts">
    import { onMount } from 'svelte';
    import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
    import { db } from '$lib/firebase/config';
    import TaskCard from '$lib/components/ui/TaskCard.svelte';
    import { Button } from "$lib/components/ui/button";
    import type { Card as CardType, DragItem } from '$lib/types';

    // Store all our cards
    let cards: CardType[] = [];
    let isLoading = true;

    // Load cards when the page loads
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

    // Create a new card
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

    // Handle dropping cards to reorder them
    async function handleDrop(event: CustomEvent<{draggedItem: DragItem; targetCard: CardType}>) {
        const { draggedItem, targetCard } = event.detail;

        if (draggedItem.type === 'CARD') {
            const draggedCard = cards.find(c => c.id === draggedItem.id);
            const targetPosition = cards.findIndex(c => c.id === targetCard.id);
            
            if (draggedCard && targetPosition !== -1) {
                try {
                    // Create new array with updated positions
                    const newCards = [...cards];
                    const draggedPosition = cards.findIndex(c => c.id === draggedCard.id);
                    
                    // Remove card from old position and add to new position
                    newCards.splice(draggedPosition, 1);
                    newCards.splice(targetPosition, 0, draggedCard);
                    
                    // Update all positions in database
                    await Promise.all(newCards.map((card, index) => 
                        updateDoc(doc(db, 'cards', card.id), { position: index })
                    ));
                } catch (error) {
                    console.error('Error updating card positions:', error);
                }
            }
        }
    }

    // Delete a card
    async function handleDeleteCard(event: CustomEvent<{cardId: string}>) {
        const { cardId } = event.detail;
        
        if (!cardId) return;

        try {
            // Delete the card
            await deleteDoc(doc(db, 'cards', cardId));
            
            // Update remaining cards' positions
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
        <div class="flex flex-wrap gap-4" role="list">
            {#each cards as card (card.id)}
                <div class="animate-in fade-in duration-300">
                    <TaskCard 
                        {card} 
                        on:drop={handleDrop}
                        on:delete={handleDeleteCard}
                    />
                </div>
            {/each}
            
            <Button 
                variant="outline" 
                class="h-[50px] w-80 hover:bg-gray-50 transition-colors" 
                on:click={createCard}
            >
                + Add Card
            </Button>
        </div>
    {/if}
</div>