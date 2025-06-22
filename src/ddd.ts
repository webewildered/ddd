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

    el.style.fontSize = `${low}rem`;
}

let deck: Deck | null = null;
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
                // User is already logged in
                loadDriveData().then(() =>
                {
                    setLoggedIn(true);
                    begin();
                });
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
    question = deck!.draw();
    lastWord = question.card.word;
    setTextAndFit(document.getElementById('word')!, question.card.word, 1, 4);
}

document.getElementById('btn-der')?.addEventListener('click', () => chooseAnswer('m'));
document.getElementById('btn-die')?.addEventListener('click', () => chooseAnswer('f'));
document.getElementById('btn-das')?.addEventListener('click', () => chooseAnswer('n'));

const splashLoginButton = document.getElementById('btn-splashLogin')!;
const lateLoginButton = document.getElementById('btn-login')!;
function loadDriveData()
{
    return drive.load()
    .then(data =>
    {
        log('Loaded data from drive');
        // Only take the data from drive if it has more cards than the local data, or the same number of cards but a more recent date
        if (data.length > 0)
        {
            let tempDeck = new Deck(genus!, data);
            if (deck === null ||
                tempDeck.getNumCards() >= deck.getNumCards() ||
                (tempDeck.getNumCards() === deck.getNumCards() && tempDeck.getLastUpdate() > deck.getLastUpdate()))
            {
                log('Accepting ' + tempDeck.getNumCards() + ' from drive');
                localStorage.setItem(LOCAL_STORAGE_KEY, data);
                return true;
            }
            else if (deck !== null)
            {
                log('Keeping ' + deck.getNumCards() + ' from local');
            }
        }
        return false;
    })
    .catch(error => log('Error loading data: ' + error));
}
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
            loadDriveData().then((loaded) =>
            {
                setLoggedIn(true);
                if (loaded)
                {
                    begin();
                }
            });
        }
    });
}
splashLoginButton.addEventListener('click', onLogin);
lateLoginButton.addEventListener('click', () =>
{
    onLogin();
});

const logoutButton = document.getElementById('btn-logout')!;
logoutButton.addEventListener('click', () =>
{
    drive.clearSignIn();
    setLoggedIn(false);
});

const saveButton = document.getElementById('btn-save')!;
saveButton.addEventListener('click', () =>
{
    const data = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (data)
    {
        const blob = new Blob([data], { type: 'application/json' });
    
        // Create a link element
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'der-die-das.json';
    
        // Append link, trigger click, then remove link
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});

const loadButton = document.getElementById('btn-load')!;
loadButton.addEventListener('click', () =>
{
    // Create a hidden file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.style.display = 'none';
    input.onchange = () =>
    {
        const file = input.files?.[0];
        if (!file)
        {
            log('No file selected.');
            return;
        }

        const reader = new FileReader();
        reader.onload = () =>
        {
            if (typeof reader.result === 'string')
            {
                try
                {
                    let tempDeck = new Deck(genus!, reader.result);
                    log('Deck loaded successfully with ' + tempDeck.getNumCards() + ' cards.');
                    localStorage.setItem(LOCAL_STORAGE_KEY, reader.result);
                    begin();
                }
                catch (e)
                {
                    log('Error loading deck');
                    return;
                }
            }
            else
            {
                log('File could not be read as text.');
            }
        };

        reader.onerror = () =>
        {
            log('Error reading file.');
        };

        reader.readAsText(file);
    };

    // Trigger file selection
    document.body.appendChild(input);
    input.click();

    // Clean up the input element after use
    input.addEventListener('click', () =>
    {
        setTimeout(() =>
        {
            document.body.removeChild(input);
        }, 0);
    });
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
    showPage(statsPage);
    document.getElementById('stat-numWords')!.textContent = deck!.getNumCards().toString();
    document.getElementById('stat-totalWords')!.textContent = deck!.getNumWords().toString();

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
    deck!.answer(question.card as Card, correct);

    const userData = deck!.save();
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