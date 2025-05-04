import {Card, Deck, DrawResult, Genus} from './deck.js';
import {GDriveAppData} from './drive.js';

const LOCAL_STORAGE_KEY = 'ddd';

function gapiLoaded()
{
    console.log('gapi loaded');
}

function gsiLoaded()
{
    console.log('gsi loaded');
}

// Fit text in an element by adjusting font size
function setTextAndFit(
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

let deck: Deck;
let question: DrawResult | null = null;
let drive: GDriveAppData = new GDriveAppData();
let genus: string | null = null;

// Initialize the application
function init()
{
    // Load the app data
    fetch('genus.txt')
    .then(res => res.text())
    .then(genusText =>
    {
        genus = genusText;
        begin();
    })
    .catch(error => console.error('Error loading genus: ', error));

    drive.init()
    .then(() => console.log('GDriveAppData initialized'))
    .catch(error => console.error('Error initializing GDriveAppData: ', error));
}

function begin(): void
{
    if (genus)
    {
        const stored = localStorage.getItem(LOCAL_STORAGE_KEY) || '';
        deck = new Deck(genus, stored);
        draw();
    }
}

function draw(): void
{
    question = deck.draw();
    setTextAndFit(document.getElementById('word')!, question.card.word, 1, 4);
}

document.getElementById('btn-der')?.addEventListener('click', () => chooseAnswer('m'));
document.getElementById('btn-die')?.addEventListener('click', () => chooseAnswer('f'));
document.getElementById('btn-das')?.addEventListener('click', () => chooseAnswer('n'));

document.getElementById('btn-login')?.addEventListener('click', () =>
{
    const button = document.getElementById('btn-login') as HTMLButtonElement;
    button.disabled = true;

    drive.signIn()
    .then(() => drive.load())
    .then(data =>
    {
        localStorage.setItem(LOCAL_STORAGE_KEY, data);
        begin();
        button.style.visibility = "hidden";
    })
    .catch(error => console.error('Error signing in or loading data: ', error))
});

function chooseAnswer(answer: Genus): void
{
    if (!question) return;

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
    }
    else
    {
        text = '❌ ' + text;
        deck.answer(question.card as Card, false);
    }

    const userData = deck.save();
    localStorage.setItem(LOCAL_STORAGE_KEY, userData);
    if (drive.isSignedIn())
    {
        drive.save(userData)
        .catch(error => console.error('Error saving data to Google Drive: ', error));
    }

    const resultEl = document.getElementById('result');
    if (resultEl) resultEl.textContent = text;

    setTimeout(() =>
    {
        if (resultEl) resultEl.textContent = '';
        draw();
    }, 1000);

    // Disable the buttons until the next question
    question = null;
}

// Start the app on load
window.addEventListener('DOMContentLoaded', init);