"use strict";

const blessed = require("blessed");

function createPrompt({ screen }) {
  const container = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: 60,
    height: 5,
    border: {
      type: "line"
    },
    style: {
      border: { fg: "blue" },
      bg: "black",
      fg: "white"
    },
    hidden: true,
    tags: true,
    shadow: true
  });

  const label = blessed.text({
    parent: container,
    top: 0,
    left: 1,
    height: 1,
    content: "",
    style: {
      bg: "black",
      fg: "white",
      bold: true
    }
  });

  const input = blessed.textbox({
    parent: container,
    top: 2,
    left: 1,
    width: 56,
    height: 1,
    keys: true,
    inputOnFocus: true,
    style: {
      bg: "blue",
      fg: "white",
      focus: { bg: "blue" }
    }
  });

  function destroy() {
    container.detach();
  }

  function ask(question, options = {}) {
    return new Promise((resolve) => {
      container.show();
      label.setContent(question);
      
      input.setValue(options.initial || "");
      input.show();
      input.focus();
      screen.render();

      let resolved = false;

      const finish = (value) => {
        if (resolved) return;
        resolved = true;
        
        input.removeListener("submit", onSubmit);
        input.removeListener("cancel", onCancel);
        input.removeListener("keypress", onKeypress);
        
        container.hide();
        screen.render();
        resolve(value);
      };

      const onSubmit = (value) => finish(value);
      const onCancel = () => finish(null);
      
      const onKeypress = (ch, key) => {
        if (key.name === "escape") {
          finish(null);
        }
      };

      input.on("submit", onSubmit);
      input.on("cancel", onCancel);
      input.on("keypress", onKeypress);
    });
  }

  function confirm(question) {
    return new Promise((resolve) => {
      container.show();
      label.setContent(question + " (y/n/esc)");
      
      input.hide();
      container.focus();
      screen.render();

      let resolved = false;

      const finish = (value) => {
        if (resolved) return;
        resolved = true;
        
        container.removeListener("keypress", onKeypress);
        
        container.hide();
        screen.render();
        resolve(value);
      };

      const onKeypress = (ch, key) => {
        const name = key.full || key.name;
        if (name === "escape") {
          finish("cancel");
        } else if (name === "y" || name === "Y") {
          finish("yes");
        } else if (name === "n" || name === "N") {
          finish("no");
        }
      };

      container.on("keypress", onKeypress);
    });
  }

  return {
    ask,
    confirm,
    destroy
  };
}

module.exports = { createPrompt };
