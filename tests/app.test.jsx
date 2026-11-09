import { describe, it, expect } from "vitest";
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App, Boundary } from "../src/App.jsx";

describe("App component", () => {
  it("evaluates and renders without crashing", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <Boundary>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </Boundary>
      );
    });

    // Verify container has rendered contents and did not fail silently
    expect(container.innerHTML).not.toBe("");
    root.unmount();
    container.remove();
  });
});
