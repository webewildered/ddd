// Define possible genders
export type Genus = 'm' | 'f' | 'n';

// Interface for a flashcard
export interface Card
{
    word: string;
    date: Date;
    level: number;
}

// Represents a raw user card in storage
interface StoredCard
{
    word: string;
    date: string;
    level: number;
}

// Structure of saved user data
interface UserData
{
    version?: number;
    cards: StoredCard[];
}

// Result of a draw operation
export interface DrawResult
{
    card: Card;
    answer: Genus;
}

// Entry in the min-heap
interface HeapEntry<T>
{
    score: number;
    entry: T;
}

// --- MinHeap implementation ---
class MinHeap<T>
{
    private data: HeapEntry<T>[] = [];

    size(): number
    {
        return this.data.length;
    }

    peek(): HeapEntry<T> | null
    {
        return this.data[0] ?? null;
    }

    private swap(i: number, j: number): void
    {
        [this.data[i], this.data[j]] = [this.data[j], this.data[i]];
    }

    private parent(i: number): number
    {
        return Math.floor((i - 1) / 2);
    }

    private left(i: number): number
    {
        return 2 * i + 1;
    }

    private right(i: number): number
    {
        return 2 * i + 2;
    }

    push(val: HeapEntry<T>): void
    {
        this.data.push(val);
        let i = this.data.length - 1;
        while (i > 0 && this.data[i].score < this.data[this.parent(i)].score)
        {
            this.swap(i, this.parent(i));
            i = this.parent(i);
        }
    }

    pop(): HeapEntry<T> | null
    {
        if (this.data.length === 0) return null;
        const top = this.data[0];
        const end = this.data.pop()!;
        if (this.data.length > 0)
        {
            this.data[0] = end;
            let i = 0;
            while (true)
            {
                const left = this.left(i);
                const right = this.right(i);
                let smallest = i;
                if (left < this.data.length && this.data[left].score < this.data[smallest].score)
                {
                    smallest = left;
                }
                if (right < this.data.length && this.data[right].score < this.data[smallest].score)
                {
                    smallest = right;
                }
                if (smallest === i) break;
                this.swap(i, smallest);
                i = smallest;
            }
        }
        return top;
    }
}

// --- Deck implementation ---
const halfLifeBase = 30;
const halfLifeGrowth = 5;

export class Deck
{
    private genus = new Map<string, Genus>();
    private newWords: string[] = [];
    private cards: Card[] = [];
    private drawDate = new Date();
    private removedWords = new Set<string>();

    constructor(coreData: string, userData: string | null)
    {
        // Load stored cards
        const seen = new Set<string>();
        if (userData != null && userData.length > 0)
        {
            try
            {
                const obj: UserData = JSON.parse(userData);
                for (const sc of obj.cards)
                {
                    seen.add(sc.word);
                    this.cards.push({ word: sc.word, date: new Date(sc.date), level: sc.level });
                }
                console.log('Loaded ' + this.cards.length + ' cards from user data');
            }
            catch (e)
            {
                console.error('Error parsing user data: ', e);
            }
        }

        // Load core word list
        const lines = coreData.split(/\r?\n/);
        for (const line of lines)
        {
            const [word, g] = line.split(' ');
            const gen = g as Genus;
            this.genus.set(word, gen);
            if (!seen.delete(word))
            {
                this.newWords.push(word);
            }
        }
        this.newWords.reverse();
        this.removedWords = seen;
    }

    save(): string
    {
        const stored = this.cards.map(c => ({ word: c.word, date: c.date.toISOString(), level: c.level }));
        return JSON.stringify({ version: 0, cards: stored });
    }

    static halfLife(level: number): number
    {
        return level * halfLifeGrowth + halfLifeBase;
    }

    static confidence(level: number, elapsed: number): number
    {
        return Math.pow(0.5, elapsed / Deck.halfLife(level));
    }

    draw(): DrawResult
    {
        this.drawDate = new Date();
        const now = this.drawDate.getTime();
        const heap = new MinHeap<Card>();
        const threshold = 0.5;

        // Select cards needing review
        for (const card of this.cards)
        {
            if (this.removedWords.has(card.word)) continue;
            const elapsed = (now - card.date.getTime()) / 1000;
            const score = Deck.confidence(card.level, elapsed);
            if (score < threshold)
            {
                if (heap.size() < 10)
                {
                    heap.push({ score, entry: card });
                } else if (heap.peek() && score < heap.peek()!.score)
                {
                    heap.pop();
                    heap.push({ score, entry: card });
                }
            }
        }

        if (heap.size() > 0)
        {
            const entries = heap['data'];
            const pick = entries[Math.floor(Math.random() * entries.length)].entry;
            return this.drawCard(pick);
        }

        return this.drawNew();
    }

    private drawNew(): DrawResult
    {
        const word = this.newWords.pop()!;
        const card: Card = { word, date: this.drawDate, level: 0 };
        this.cards.push(card);
        return this.drawCard(card);
    }

    private drawCard(card: Card): DrawResult
    {
        return { card, answer: this.genus.get(card.word)! };
    }

    answer(card: Card, correct: boolean): void
    {
        if (correct)
        {
            const elapsedSec = Math.min((this.drawDate.getTime() - card.date.getTime()) / 1000, Deck.halfLife(card.level));
            card.level = Math.min(card.level + elapsedSec, Math.pow(halfLifeGrowth, 5) * halfLifeBase);
        } else
        {
            card.level = card.level / Math.pow(halfLifeGrowth, 3);
        }
        card.date = new Date();
    }
}