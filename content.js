let starting_time_event = null;
let ending_time_event = null;

let config = {
    room_map: [],
    room_availabilities: [],
    token: undefined,
};

chrome.runtime.onMessage.addListener((msg) => {
  console.log("[WASSUP] Message:", msg);
  if (msg.type === "updateData") {
      config.room_map = msg.room_map;
      config.room_availabilities = msg.room_availabilities;
      config.token = msg.token;
  }
});

function filterItems() {
    const list = document.querySelector('ul[role="listbox"][aria-label="Lista de calendarios"]');
    if (!list) return;

    const items = list.querySelectorAll('li[role="option"]');

    let f = (input) => {
        const normalized = input.replace(" ", "T").replace(".0", "");
        const date = new Date(normalized);
        return date.toISOString();
    };

    console.log("Config:", config);
    items.forEach(li => {
        const containerSpan = li.querySelector(':scope > span:nth-of-type(4)');
        const text = containerSpan.querySelector('span').textContent.trim();
        let sala = config.room_map.find(x => x.descrizione == text);
        // could be a calendar that doesn't represent a sala.
        if (sala) {
            let slot = config
                .room_availabilities
                .filter(x => x.resourceId == sala.id)
                .find((x) => {
                    return starting_time_event && ending_time_event && ( f(x.start).getTime() <= starting_time_event.getTime() && f(x.end).getTime() >= ending_time_event.getTime() )
               });
            if (slot) {
                li.style.display = "none";
            }
        }
    });
}

const observer = new MutationObserver(() => filterItems());
observer.observe(document.body, {
    childList: true,
    subtree: true
});

filterItems();

const s = document.createElement("script");
s.src = chrome.runtime.getURL("inject.js");
(document.head || document.documentElement).appendChild(s);
s.onload = () => s.remove();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const msg = event.data;

  if (msg.type === "EVENT_INFO") {
      // This is the creation of the new event.
      chrome.runtime.sendMessage({
          type: "EVENT_INFO",
          payload: msg.payload
      });
  }
});

