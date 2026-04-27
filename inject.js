function flattenNonNull(arr) {
  const result = [];

  function walk(value) {
    if (Array.isArray(value)) {
      for (const item of value) {
        walk(item);
      }
    } else if (value !== null && value !== undefined) {
      result.push(value);
    }
  }

  walk(arr);
  return result;
}

function try_parse_event(flat_arr) {

    function get_index_start(arr) {
        for (let i = 0; i < arr.length - 1; i++) {
            const a = arr[i];
            const b = arr[i + 1];

            if (Number.isInteger(a) && Number.isInteger(b)) {
                let one_day = new Date(0,0,2).getTime() - new Date(0,0,1).getTime();
                let two_thousand = new Date(2000, 0, 1).getTime();

                const date_is_close = (
                  a > two_thousand &&
                  b > two_thousand &&
                  (b - a) <= one_day
                );
                if (date_is_close) return i;
            }
        }
        return -1
    }

    let start_idx = get_index_start(flat_arr);
    if (start_idx == -1) return undefined;
    let cal_id = flat_arr.find(x => typeof x === "string" && x.endsWith("@group.calendar.google.com"));

    console.log("Event:", flat_arr);

    return {
        event_title: flat_arr[start_idx-2],
        event_descriptoin: flat_arr[start_idx-1],
        event_start: flat_arr[start_idx],
        event_end: flat_arr[start_idx+1],
        event_ubication: flat_arr[start_idx+3],
        calendar_id: cal_id,
    };
}

function process_request(body) {

    if (typeof decodeURIComponent(body) !== "string") return null;
    try {
        let decoded = decodeURIComponent(body);
        const params = new URLSearchParams(decoded);
        const fReq = params.get("f.req");
        let decoded_body = JSON.parse(fReq);
        let flatten_array = flattenNonNull(decoded_body);
        return try_parse_event(flatten_array);
    } catch(e) {
        console.log("GEI:", e);
    }
}

// TODO: Attach this function to onChange of the html element of the event 
// and trigger a click on save with a global variable so
// that we know we have to ignore the request.
function send_updated_event(result) {
    console.log("The actual result:", result);
    window.postMessage({
        type: "EVENT_INFO",
        payload: result
    }, "*");
}

(function () {
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    try {
        console.log("we hae a xmlhttprequest", body);
        let result = process_request(body);
        if (result == undefined) {
            return origSend.apply(this, arguments);
        }
        send_updated_event(result);
    } catch (e) {}
    return origSend.apply(this, arguments);
  };

  const origFetch = window.fetch;
  window.fetch = function () {
    try {
        console.log("we have a fetch:", arguments)
    } catch (e) {}
    return origFetch.apply(this, arguments);
  };
})();
