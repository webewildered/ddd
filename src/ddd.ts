import {Card, Deck, DrawResult, Genus} from './deck.js';
import {GDriveAppData} from './drive.js';

// Fit text in an element by adjusting font size
export function setTextAndFit(
    el: HTMLElement,
    text: string,
    minSize = 10,
    maxSize = 100
): void
{
    el.textContent = text;
    el.style.whiteSpace = 'nowrap';
    el.style.overflow = 'hidden';
    el.style.display = 'inline-block';

    let low = minSize;
    let high = maxSize;
    let best = minSize;

    while (low <= high)
    {
        const mid = Math.floor((low + high) / 2);
        el.style.fontSize = `${mid}rem`;

        const fitsWidth = el.scrollWidth <= el.clientWidth;
        const fitsHeight = el.scrollHeight <= el.clientHeight;

        if (fitsWidth && fitsHeight)
        {
            best = mid;
            low = mid + 1;
        } else
        {
            high = mid - 1;
        }
    }

    el.style.fontSize = `${best}rem`;
}

let genusText = '';
let deck: Deck;
let question: DrawResult;

// Initialize the application
async function init(): Promise<void>
{
    genusText = await fetch('genus.txt').then(res => res.text());
    const stored = localStorage.getItem('ddd') || JSON.stringify({ cards: [] });
    deck = new Deck(genusText, stored);
    draw();
}

function draw(): void
{
    question = deck.draw();
    const wordEl = document.getElementById('word');
    if (wordEl) setTextAndFit(wordEl, question.card.word, 1, 4);
}

document.getElementById('btn-der')?.addEventListener('click', () => chooseAnswer('m'));
document.getElementById('btn-die')?.addEventListener('click', () => chooseAnswer('f'));
document.getElementById('btn-das')?.addEventListener('click', () => chooseAnswer('n'));

let drive = new GDriveAppData();
drive.init()
.then(() => console.log('GDriveAppData initialized'))
.catch((error) =>
{
    console.error('Error initializing GDriveAppData: ', error);
});

document.getElementById('btn-login')?.addEventListener('click', () =>
{
    drive.signIn()
    .then(() => drive.load())
    .then(data =>
    {
        console.log('loaded ' + data);
        return drive.save(data + 'abc\n');
    })
    .then(() => console.log('saved'));
});

function chooseAnswer(answer: Genus): void
{
    let text: string;
    switch (question.answer)
    {
        case 'm': text = 'der'; break;
        case 'f': text = 'die'; break;
        case 'n': text = 'das'; break;
    }
    if (answer === question.answer)
    {
        text = '✔️ ' + text;
        deck.answer(question.card as Card, true);
    } else
    {
        text = '❌ ' + text;
        deck.answer(question.card as Card, false);
    }

    localStorage.setItem('ddd', deck.save());
    const resultEl = document.getElementById('result');
    if (resultEl) resultEl.textContent = text;

    setTimeout(() =>
    {
        if (resultEl) resultEl.textContent = '';
        draw();
    }, 1000);
}

// Start the app on load
window.addEventListener('DOMContentLoaded', init);