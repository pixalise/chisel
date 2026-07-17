import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app";
import "./styles.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/query-client";
import { MemoryRouter } from "react-router";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
