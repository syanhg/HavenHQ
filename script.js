(function () {
  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var messages = document.querySelectorAll(".message[data-reveal]");
  var typingMessage = document.querySelector("[data-typing-until]");

  if (prefersReducedMotion || !messages.length) {
    if (typingMessage) {
      typingMessage.querySelector(".typing-dots").style.display = "none";
      typingMessage.querySelector(".final-text").style.display = "block";
    }
    return;
  }

  messages.forEach(function (message) {
    message.classList.add("is-hidden");
  });

  messages.forEach(function (message, index) {
    setTimeout(function () {
      message.classList.remove("is-hidden");
      message.classList.add("is-revealed");
    }, 260 * index + 200);
  });

  if (typingMessage) {
    var revealDelay = 260 * (messages.length - 1) + 200;
    setTimeout(function () {
      var dots = typingMessage.querySelector(".typing-dots");
      var finalText = typingMessage.querySelector(".final-text");
      dots.style.display = "none";
      finalText.style.display = "block";
    }, revealDelay + 1500);
  }
})();
