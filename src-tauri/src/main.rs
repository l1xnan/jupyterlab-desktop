// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use tauri::{Manager, State, Window};

mod command;
mod jupyter;
mod tray;
mod utils;
use crate::command::{create_server, get_free_port, get_running_servers, greet, open_devtools};
use crate::jupyter::{ServerManagerState, ServerManger};

#[cfg(target_os = "macos")]
fn apply_style(window: &Window) {
  use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};
  apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
    .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");
}

#[cfg(target_os = "windows")]
fn apply_style(window: &Window) {
  let info = os_info::get();
  let win11 = os_info::Version::Semantic(11, 0, 0);
  if info.version().to_owned() > win11 {
    use window_vibrancy::apply_mica;
    apply_mica(&window).expect("Unsupported platform! 'apply_mica' is only supported on Windows");
  }
  println!("Version: {}", info.version());
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn apply_style(_window: &Window) {
  // not support!
}

fn main() {
  let manger = ServerManger::new();
  let state = ServerManagerState {
    manager_mutex: Mutex::new(manger),
  };

  tauri::Builder::default()
    .manage(state)
    .setup(|app| {
      let window = app.get_window("main").unwrap();
      apply_style(&window);
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      greet,
      create_server,
      get_free_port,
      open_devtools,
      get_running_servers,
    ])
    .system_tray(tray::menu())
    .on_system_tray_event(tray::handler)
    .on_window_event(|event| match event.event() {
      tauri::WindowEvent::CloseRequested { api, .. } => {
        event.window().hide().unwrap();
        api.prevent_close();
      }
      tauri::WindowEvent::Destroyed => {
        let state: State<ServerManagerState> = event.window().state();
        state.manager_mutex.lock().unwrap().kill();
      }
      _ => {}
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
