const copyButtons = document.querySelectorAll("[data-copy]");

function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

copyButtons.forEach((button) => {
  const originalText = button.textContent;

  function showCopied() {
    button.textContent = "Copied";
    button.classList.add("copied");
    window.setTimeout(() => {
      button.textContent = originalText;
      button.classList.remove("copied");
    }, 1400);
  }

  button.addEventListener("click", async () => {
    const text = button.getAttribute("data-copy") || "";

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }

      showCopied();
    } catch {
      fallbackCopy(text);
      showCopied();
    }
  });
});
