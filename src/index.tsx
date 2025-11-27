/* @refresh reload */
import { render } from "solid-js/web";
import App from "./App";

// Disable browser-like navigation (back/forward with backspace, alt+arrows, etc.)
// This is a desktop app, not a browser
document.addEventListener('keydown', (e) => {
  // Prevent backspace from navigating back (unless in input/textarea)
  if (e.key === 'Backspace') {
    const target = e.target as HTMLElement;
    const isEditable = target.tagName === 'INPUT' || 
                       target.tagName === 'TEXTAREA' || 
                       target.isContentEditable;
    if (!isEditable) {
      e.preventDefault();
    }
  }
  
  // Prevent Alt+Left/Right from navigating
  if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault();
  }
});

// Disable right-click context menu (optional - desktop app behavior)
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

render(() => <App />, document.getElementById("root") as HTMLElement);
