import { Card, Deck, DrawResult, Genus } from './deck.js';
import { GDriveAppData } from './drive.js';

const LOCAL_STORAGE_KEY = 'ddd';

const gamePage = document.getElementById('game')!;
const statsPage = document.getElementById('stats')!;
const splashPage = document.getElementById('splash')!;
const definitionList = document.getElementById('definitionList')!;
const definitionMessage = document.getElementById('definitionMessage')!;

const pages = [gamePage, statsPage, splashPage];

let numAnswers = 0;
let numCorrect = 0;
let beginTime: Date = new Date();

function log(text: string)
{
    console.log(text);
    //document.getElementById('log')!.textContent += text + '\n';
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
    el.style.display = 'inline-block';

    let low = minSize;
    let high = maxSize;
    let test = high;
    const res = 0.25;

    while (low <= high - res)
    {
        el.style.fontSize = `${test}rem`;

        const fitsWidth = el.scrollWidth <= el.clientWidth;
        const fitsHeight = el.scrollHeight <= el.clientHeight;

        if (fitsWidth && fitsHeight)
        {
            low = test;
        }
        else
        {
            high = test;
        }
        test = (low + high) / 2;
    }

    console.log('fit: ' + low);
    el.style.fontSize = `${low}rem`;
}

let deck: Deck;
let question: DrawResult | null = null;
let lastWord: string | null = null;
let drive: GDriveAppData = new GDriveAppData();
let genus: string | null = null;

function hideElement(page: HTMLElement)
{
    page.style.display = 'none';
}

function showElement(page: HTMLElement)
{
    page.style.display = 'flex';
}

function showPage(page: HTMLElement)
{
    for (const p of pages)
    {
        if (p === page)
        {
            showElement(p);
        }
        else
        {
            hideElement(p);
        }
    }
}

// Initialize the application
function init()
{
    // Load the app data
    const loadGenus = fetch('genus.txt')
        .then(res => res.text())
        .then(genusText =>
        {
            log('Genus loaded');
            genus = genusText;
        })
        .catch(error => console.error('Error loading genus: ', error));

    // Load the Google Drive API
    const loadDrive = drive.init()
        .then(() => log('GDriveAppData initialized'))
        .catch(error => console.error('Error initializing GDriveAppData: ', error));

    // After everything loads
    Promise.all([loadGenus, loadDrive])
        .then(() =>
        {
            log('All loaded');

            if (drive.isSignedIn())
            {
                setLoggedIn(true);
                begin(); // User is already logged in
            }
            else
            {
                setLoggedIn(false);
                if (drive.wasSignedIn())
                {
                    // User logged in previously but the token expired. They probably want to log in.
                    showPage(splashPage);
                }
                else
                {
                    // User never logged in, start the game and they can log in later if they want.
                    begin();
                }
            }
        });
}

function begin(): void
{
    numAnswers = 0;
    numCorrect = 0;
    beginTime = new Date();

    showPage(gamePage);
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY) || '';
    deck = new Deck(genus!, stored);
    draw();
}

function draw(): void
{
    clearDefinitions();
    question = deck.draw();
    lastWord = question.card.word;
    setTextAndFit(document.getElementById('word')!, question.card.word, 1, 4);
}

document.getElementById('btn-der')?.addEventListener('click', () => chooseAnswer('m'));
document.getElementById('btn-die')?.addEventListener('click', () => chooseAnswer('f'));
document.getElementById('btn-das')?.addEventListener('click', () => chooseAnswer('n'));

const splashLoginButton = document.getElementById('btn-splashLogin')!;
const lateLoginButton = document.getElementById('btn-login')!;
function onLogin()
{
    drive.signIn((error) =>
    {
        if (error)
        {
            log('Sign in error: ' + error.message);
        }
        else
        {
            drive.load()
                .then(data =>
                {
                    log('Loaded');
                    if (data.length > 0)
                    {
                        localStorage.setItem(LOCAL_STORAGE_KEY, data);
                        begin();
                    } // else, probably first login, so keep the local data
                    setLoggedIn(true);
                })
                .catch(error => log('Error loading data: ' + error));
        }
    });
}
splashLoginButton.addEventListener('click', onLogin);
lateLoginButton.addEventListener('click', () =>
{
    closeHamburger();
    onLogin();
});

const logoutButton = document.getElementById('btn-logout')!;
logoutButton.addEventListener('click', () =>
{
    closeHamburger();
    drive.clearSignIn();
    setLoggedIn(false);
});

function setLoggedIn(loggedIn: boolean)
{
    if (loggedIn)
    {
        lateLoginButton.style.display = "none";
        logoutButton.style.display = "block";
    }
    else
    {
        lateLoginButton.style.display = "block";
        logoutButton.style.display = "none";
    }
}

const skipLogin = document.getElementById('btn-skipLogin')!;
skipLogin.addEventListener('click', (event: Event) =>
{
    drive.clearSignIn();
    begin();
});

const statsButton = document.getElementById('btn-stats')!;
const statGroupSession = document.getElementById('statGroup-session')!;
const statGroupSpeed = document.getElementById('statGroup-speed')!;
statsButton.addEventListener('click', () =>
{
    closeHamburger();

    showPage(statsPage);
    document.getElementById('stat-numWords')!.textContent = deck.getNumCards().toString();
    document.getElementById('stat-totalWords')!.textContent = deck.getNumWords().toString();

    if (numAnswers === 0)
    {
        statGroupSession.style.display = 'none';
        statGroupSpeed.style.display = 'none';
    }
    else
    {
        statGroupSession.style.display = 'block';
        statGroupSpeed.style.display = 'block';

        document.getElementById('stat-numCorrect')!.textContent = numCorrect.toString();
        document.getElementById('stat-numAnswers')!.textContent = numAnswers.toString();

        let accuracy = 100 * numCorrect / numAnswers;
        let speed = (new Date().getTime() - beginTime.getTime()) / numAnswers / 1000;
        document.getElementById('stat-accuracy')!.textContent = accuracy.toFixed(0);
        document.getElementById('stat-speed')!.textContent = speed.toFixed(1);
    }
});
const statsOkButton = document.getElementById('btn-statsOk')!;
statsOkButton.addEventListener('click', () =>
{
    showPage(gamePage);
});

function clearDefinitions()
{
    definitionMessage.innerText = '';
    while (definitionList.firstChild)
    {
        definitionList.removeChild(definitionList.firstChild);
    }
}

const dictButton = document.getElementById('btn-dict')!;
dictButton.addEventListener('click', () =>
{
    clearDefinitions();
    closeHamburger();
    if (!question)
    {
        return;
    }

    const word = question.card.word
    const apiUrl = `https://de.wiktionary.org/w/api.php`;
    const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        prop: 'revisions',
        titles: word,
        rvprop: 'content',
        rvslots: 'main',
        origin: '*' // Allows CORS
    });
    fetch(`${apiUrl}?${params}`)
    .then(response =>
    {
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        return response.json();
    })
    .then(data =>
    {
        const pages = data?.query?.pages;
        const pageId = Object.keys(pages)[0];
        const page = pages[pageId];
        if (page?.revisions)
        {
            const content = page.revisions[0].slots.main['*'];
            let inBedeutungen = false;
            for (const line of content.split('\n'))
            {
                if (inBedeutungen)
                {
                    const re = /^:\[\d+\]\s*(.+)/;
                    let matches = line.match(re);
                    if (matches)
                    {
                        let text = matches[1].trim();

                        // Convert '''bold''' to <b>...</b>
                        text = text.replace(/'''(.*?)'''/g, '<b>$1</b>');

                        // Convert ''italic'' to <i>...</i>
                        text = text.replace(/''(.*?)''/g, '<i>$1</i>');

                        // Remove links [[word|display]] -> display, [[word]] -> word
                        text = text.replace(/\[\[([^|\]]*?\|)?([^\]]+?)\]\]/g, '$2');

                        // Remove superscripts <sup>...</sup>
                        text = text.replace(/<sup>.*?<\/sup>/g, '');

                        // Remove templates {{template|param}} -> param or just remove entirely
                        text = text.replace(/\{\{([^}]+)\}\}/g, (_: any, content: string) =>
                        {
                            // Split by | and keep the last param or first if single
                            const parts = content.split('|');
                            return parts.length > 1 ? parts.slice(-1)[0] : parts[0];
                        });

                        const li = document.createElement("li");
                        li.innerHTML = text;
                        definitionList.appendChild(li);
                    }
                    else
                    {
                        break;
                    }
                }
                if (line === '{{Bedeutungen}}')
                {
                    inBedeutungen = true;
                }
            }

            definitionMessage.innerHTML = `Quelle: <a href="https://de.wiktionary.org/wiki/${encodeURIComponent(word)}" target="_blank">Wiktionary</a>`;
        }
        else
        {
            throw new Error('Lookup failed');
        }
    })
    .catch(error =>
    {
        definitionMessage.innerText = `Error fetching definitions: ${error.message}`;
    });
});

const hamburgerButton = document.getElementById('btn-hamburger')!;
const hamburgerIcon = document.getElementById('hamburgerIcon')!;
let hamburgerOpen = false;
function openHamburger()
{
    hamburgerOpen = true;
    hamburgerIcon.textContent = 'close'
    for (const item of document.getElementsByClassName('hamburger-item'))
    {
        (item as HTMLElement).style.display = 'block';
    }
}
function closeHamburger()
{
    hamburgerOpen = false;
    hamburgerIcon.textContent = 'menu'
    for (const item of document.getElementsByClassName('hamburger-item'))
    {
        (item as HTMLElement).style.display = 'none';
    }
}
hamburgerButton.addEventListener('click', () =>
{
    if (hamburgerOpen)
    {
        closeHamburger();
    }
    else
    {
        openHamburger();
    }
});

function chooseAnswer(answer: Genus): void
{
    if (!question) return;
    numAnswers++;

    let article: string;
    switch (question.answer)
    {
        case 'm': article = 'der'; break;
        case 'f': article = 'die'; break;
        case 'n': article = 'das'; break;
    }
    const resultArticle = document.getElementById('resultArticle')!;
    resultArticle.textContent = article;

    const resultIcon = document.getElementById('resultIcon')!;
    const correct = answer === question.answer;
    if (correct)
    {
        numCorrect++;
        resultIcon.textContent = 'check';
        resultIcon.style.color = 'green';
    }
    else
    {
        resultIcon.textContent = 'close';
        resultIcon.style.color = 'red';
    }
    deck.answer(question.card as Card, correct);

    const userData = deck.save();
    localStorage.setItem(LOCAL_STORAGE_KEY, userData);
    if (drive.isSignedIn())
    {
        drive.save(userData)
            .catch(error => console.error('Error saving data to Google Drive: ', error));
    }
    else if (drive.wasSignedIn())
    {
        showPage(splashPage);
    }

    setTimeout(() =>
    {
        resultIcon.textContent = '';
        resultArticle.textContent = '';
        draw();
    }, 1000);

    // Disable the buttons until the next question
    question = null;
}

// Start the app on load
window.addEventListener('DOMContentLoaded', init);