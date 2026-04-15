(function () {
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (body) {
    try {
        console.log("Intercepted:", body);
    } catch (e) {}
    return origSend.apply(this, arguments);
  };

  const origFetch = window.fetch;
  window.fetch = function () {
    try {
        console.log("Intercepted:", body);
    } catch (e) {}
    return origFetch.apply(this, arguments);
  };
})();
