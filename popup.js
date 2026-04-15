console.log("popup loaded");

document.getElementById("create").addEventListener("click", () => {
  console.log("CLICKED");

  chrome.runtime.sendMessage(
    { type: "ENTRY_POINT" },
    (response) => {
      console.log("Successfull: ", response);
    }
  );
});
