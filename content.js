let room_map = null;
let room_availabilities = null;
let token = null;
let starting_time_event = null;
let ending_time_event = null;

let config = {};

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "updateData") {
    config = msg.data;
      config.room_map = room_map;
      config.room_availabilities = room_availabilities;
      config.token = token;
  }
});

function filterItems() {
    const list = document.querySelector('ul[role="listbox"][aria-label="Lista de calendarios"]');
    if (!list) return;

    const items = list.querySelectorAll('li[role="option"]');

    let n = items.length;
    items.forEach((li, i) => {
        const isInvalid = i != n - 1;
        if (isInvalid) {
            li.style.display = "none";
        }
    });
}

const observer = new MutationObserver(() => filterItems());
observer.observe(document.body, {
    childList: true,
    subtree: true
});

filterItems();

function extractTime(text) {
  const match = text.match(/(\d{1,2}:\d{2}\s?(?:am|pm))\s*to\s*(\d{1,2}:\d{2}\s?(?:am|pm))/i);
  if (!match) return null;

  return {
    start: match[1],
    end: match[2]
  };
}

function getCurrentUIState() {
  const el = document.querySelector('[aria-label*="to"]') ||
             document.body;

  return extractTime(el?.innerText || "");
}

const observer2 = new MutationObserver(() => {
  const state = getCurrentUIState();

  if (state) {
    console.log("Mutation-based live update:", state);
    handleTimeChange(state);
  }
});

observer2.observe(document.body, {
  subtree: true,
  childList: true,
  characterData: true
});

const s = document.createElement("script");
s.src = chrome.runtime.getURL("inject.js");
(document.head || document.documentElement).appendChild(s);
s.onload = () => s.remove();
