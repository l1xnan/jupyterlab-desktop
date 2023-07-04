import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// import "./styles.css";
import { attachConsole } from "tauri-plugin-log-api";
import { MantineProvider } from "@mantine/core";

attachConsole();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {/* <App /> */}
    <MantineProvider
      withGlobalStyles
      withNormalizeCSS
      theme={{
        defaultRadius: "1px",
      }}
    >
      <App />
    </MantineProvider>
  </React.StrictMode>
);
