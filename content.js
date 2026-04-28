let observer = null;
let observed = null;
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

function filter_the_stuff(items) {

    let f = (input) => {
        // NOTE: THIS INPUT IS GIVEN IN ITALIAN TIME (btw).
        const normalized = input.replace(" ", "T").replace(".0", "");
        const date = new Date(normalized);
        return date;
    };

    console.log("filtering items..");
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
                    return starting_time_event && ending_time_event && ( f(x.start).getTime() <= starting_time_event.getTime() && f(x.end).getTime() >= ending_time_event.getTime() );
               });
            if (slot) {
                li.style.display = "none";
            }
        }
    });
}

function filterItems() {

    const targetText = "Sala Bondone - Edificio Nord Primo Piano";

    const list = Array.from(document.querySelectorAll('ul[role="listbox"]'))
        .find(ul =>
            Array.from(ul.querySelectorAll('li'))
            .some(li => li.textContent.trim().includes(targetText))
        );

    if (!list) return;

    if (observed == list) {
    } else {
        observed = list;
        observed.addEventListener('focusin', () => {
            filter_the_stuff(list.querySelectorAll('li[role="option"]') || []);
        });
    }
}

const s = document.createElement("script");
s.src = chrome.runtime.getURL("inject.js");
(document.head || document.documentElement).appendChild(s);
s.onload = () => s.remove();

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const msg = event.data;

  if (msg.type === "EVENT_INFO") {
      starting_time_event = new Date(msg.payload.event_start);
      ending_time_event = new Date(msg.payload.event_end);
      // This is the creation of the new event.
      chrome.runtime.sendMessage({
          type: "EVENT_INFO",
          payload: msg.payload
      });
  }
});

window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  const msg = event.data;

  if (msg.type === "CREATING_EVENT") {
      console.log("CREATINGEVENT");
      starting_time_event = msg.payload.start
      ending_time_event = msg.payload.end
      filterItems();
  }
});
