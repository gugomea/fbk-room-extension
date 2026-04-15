let room_map = null;
let room_availabilities = null;
let token = null;

function getToken() {
  console.log("[getToken] Retrieving token...");

  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, (_token) => {

      if (chrome.runtime.lastError) {
        console.error("[getToken] Auth error:", chrome.runtime.lastError);
        reject(chrome.runtime.lastError);
        return;
      }

      token = _token;

      resolve(token);
    });
  });
}

// Still not using this btw.
function broadcast(data) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: "updateData", data });
    });
  });
}

async function fetch_room_info() {
    try {
        const response = await fetch("https://my.fbk.eu/risorse2/api/resources/2/YES");
        const data = await response.json();
        room_map = data;
    } catch (err) {
        console.error("Error room info:", err);
    }
}

async function fetch_room_calendar() {
    try {
        const response = await fetch("https://my.fbk.eu/risorse2/api/reservations/2?datestart=2026-04-14T00:00:00.000Z&dateend=2026-04-18T00:00:00.000Z&isGoogleLogged=YES");
        const data = await response.json();
        room_availabilities = data;
    } catch (err) {
        console.error("Error fetching rooms:", err);
    }
}

async function book_room(headers, username, room_id, title, start, end) {
    let booking = JSON.stringify({
        "login": username,
        "risorsaId": room_id,
        "ongooglecalendar": "false",
        "dataorainizio": start,
        "dataorafine": end,
        "motivazione": title
    });

    try {
        const createRes = await fetch(
            "https://my.fbk.eu/risorse2/api/form/reservation/",
            {
                method: "POST",
                headers,
                body: booking,
            }
        );
        return await createRes.json();
    } catch(e) {
        console.log("[book_room] Error:", e);
        return {};
    }

}

async function create_google_calendar(calendarName, headers) {
    try {
        const createRes = await fetch(
            "https://www.googleapis.com/calendar/v3/calendars",
            {
                method: "POST",
                headers,
                body: JSON.stringify({
                    summary: calendarName
                })
            }
        );
        return await createRes.json();
    } catch(e) {
        console.log("[create_google_calendar] Error:", e);
        return {};
    }
}

async function get_events_for_calendar(calendar_id, headers) {
    let url = `https://www.googleapis.com/calendar/v3/calendars/${calendar_id}/events`
    console.log("[EVENT LIST] Fetching with url:", url);
    let [events, resp] = [undefined, undefined];
    try {
        events = await fetch(
            url,
            { headers }
        );
    } catch(err) {
        console.log("Error while fetching calendar:", err);
    }
    try {
        resp = await events.json();
    } catch(err) {
        console.log("Error in response:", err);
    }
    return resp.items ? resp.items : []; //TODO: might be truncated?
}

async function create_calendar_event(calendar_id, summary, start_date, end_date, headers) {
    let normalize = (input) => {
        console.log("Input:", input);
        const normalized = input.replace(" ", "T").replace(".0", "");
        const date = new Date(normalized);
        console.log("Output:", date.toISOString());
        return date.toISOString();
    };

    console.log("[DOING] creating calendar event:", summary);
    try {
        const eventRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/${calendar_id}/events`,
            {
                method: "POST",
                headers,
                body: JSON.stringify({
                    summary: summary,
                    start: {
                        dateTime: normalize(start_date),
                        timezone: 'Europe/Rome',
                    },
                    end: {
                        dateTime: normalize(end_date),
                        timezone: 'Europe/Rome',
                    }
                })
            }
        );

        const eventData = await eventRes.json();
        console.log("[DONE]", eventData);

        if (!eventRes.ok) {
            console.log("[ERROR] Event creation failed: " + JSON.stringify(eventData));
            console.log("[ERROR] startdate:", start_date);
            console.log("[ERROR] startdate:", start_date);
            console.log("[ERROR] Summary:", summary);
            return 
        }

    } catch(e) {
        console.log("[create_calendar_event] Error:", e);
    }
}

async function createCalendar() {
    console.log("SyncRoomCalendar started");

    const headers = {
        Authorization: "Bearer " + token,
        "Content-Type": "application/json"
    };

    let calListRes = null;
    try{
         calListRes = await fetch(
            "https://www.googleapis.com/calendar/v3/users/me/calendarList",
            { headers }
        );
    } catch(e) {
        console.log("Error:", e); 
    }

    const calListData = await calListRes.json();

    if (!calListRes.ok) {
        throw new Error(
            "Failed to list calendars: " + JSON.stringify(calListData)
        );
    }

    let google_calendars = calListData.items

    console.log("google calendars:", google_calendars);

    console.log("Room map:", room_map);

    let calendar_creation_list = room_map.map(async (room) => {
            let existing_calendar = google_calendars.find((x) => {
                return x.summary == room.descrizione
            })
            try {
                if(!existing_calendar) {
                    const createData = await create_google_calendar(
                        room.descrizione,
                        headers
                    );
                    calendar = createData;
                    console.log("[OK] Calendar created:", calendar.id);
                }
                console.log(" > Room:", room)
                console.log(" > Calendar:", existing_calendar)
            } catch(e) {
                console.log("[FAIL] Error while creating google calendar: ", e); 
                return false;
            }
            return true;
    });

    try {
        await Promise.all(calendar_creation_list);
    } catch(e) {
        console.log("Error while creating google calendars from rooms:", e);
    }

    console.log("All calendars succesfully created");

    // Fetch all events for each calendar.
    let dict = {};
    google_calendars.forEach(c => dict[c.summary] = []);

    console.log("Length:", google_calendars.length);
    let events_for_calendar = google_calendars.map(async (calendar, i) => {
        try {
            let events = await get_events_for_calendar(calendar.id, headers);
            let event_dict = {};
            console.log("Calendar:", calendar.summary, "Events:", events);
            events.forEach(x => event_dict[x.summary] = x);
            dict[calendar.summary] = event_dict;
            console.log("Event dict:", event_dict);
        } catch(error) {
            console.log("Error:", error);
        }
        console.log("Index:", i);
        return true;
    });

    try {
        await Promise.all(events_for_calendar);
    } catch(e) {
        console.log("Error while creating events for calendars:", e);
    }
    console.log("All events for calendar succesfully created");

    // for each booking entry, check if there is such event.
    // Otherwise Insert it (not yet, on a list of promises)
    console.log("Local Dictionary:", dict);
    let event_creation = room_availabilities.map(async (booking) => {
        let calendar = google_calendars.find((c) => {
            let val = room_map.find(x => x.id == booking.resourceId);
            if (val) {
                return c.summary === val.descrizione;
            }
            return false;
        });
        let google_event = dict[calendar?.summary]?.[booking.title];
        if (calendar && !google_event) {
            await create_calendar_event(
                calendar.id,
                booking.title, booking.start, booking.end, headers
            );
        } else if (google_event) {
            console.log(
                `Cache hit!!\nBooking id: ${booking.title}\nCalenar: ${calendar}\nGoogle Event: ${google_event}`
            );
        }
    });

    try {
        await Promise.all(event_creation);
    } catch(e) {
        console.log("Error while creating events:", e);
    }

    console.log("[Final] Room Availabilities:", room_availabilities);
    console.log("[Final] Room Map", room_map);
    console.log("[Final] Google Calendars:", google_calendars);
    console.log("[FINAL] Dict:", dict);
}

async function main() {

    await Promise.all([
        getToken(),
        fetch_room_info(),
        fetch_room_calendar()
    ]);

    await createCalendar();

    return true;
}

chrome.runtime.onMessage.addListener((msg, _, sendResponse) => {
    if (msg.type !== "ENTRY_POINT") {
        console.log("Returning false?");
        return false;
    }

    return true;

    main()
        .then((result) => {
            sendResponse({ ok: true, result });
        })
        .catch((err) => {
            sendResponse({ ok: false, error: err.toString() });
        });

    return true;
});
