// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use log::info;
use std::io;
use std::sync::Mutex;
use tauri::{Manager, State, Window};
use tauri_plugin_log::LogTarget;

mod command;
mod jupyter;
mod tray;
mod utils;
use crate::command::{
  create_server, get_free_port, get_running_servers, greet, open_devtools, open_window,
};
use crate::jupyter::{ServerManagerState, ServerManger};
use crate::tray::MAIN_WIN;

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

/// fixed webview2 white screen bug
/// ```
/// Windows Registry Editor Version 5.00
///
/// [HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge\WebView2]
/// "RendererCodeIntegrityEnabled"=dword:00000000
///
/// [HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Edge]
/// "RendererCodeIntegrityEnabled"=dword:00000000
/// ```
fn init_reg() -> io::Result<()> {
  init_reg_item(r#"SOFTWARE\Policies\Microsoft\Edge\WebView2"#)?;
  init_reg_item(r#"SOFTWARE\Policies\Microsoft\Edge"#)?;
  Ok(())
}

#[cfg(target_os = "windows")]
fn init_reg_item(path: &str) -> io::Result<()> {
  use winreg::enums::{HKEY_LOCAL_MACHINE, REG_CREATED_NEW_KEY, REG_OPENED_EXISTING_KEY};
  use winreg::RegKey;

  let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
  let (key, disp) = hklm.create_subkey(path)?;

  match disp {
    REG_CREATED_NEW_KEY => println!("A new key has been created"),
    REG_OPENED_EXISTING_KEY => println!("An existing key has been opened"),
  }

  let _ = key.set_value("RendererCodeIntegrityEnabled", &0u32);

  let val: u32 = key.get_value("RendererCodeIntegrityEnabled")?;
  println!("RendererCodeIntegrityEnabled = {}", val);
  Ok(())
}

fn main() {
  #[cfg(target_os = "windows")]
  let _ = init_reg();

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
      open_window,
    ])
    .system_tray(tray::menu())
    .on_system_tray_event(tray::handler)
    .on_window_event(|event| match event.event() {
      tauri::WindowEvent::CloseRequested { api, .. } => {
        let win = event.window();
        info!("close request window title: {}", win.title().unwrap());
        if win.label() == MAIN_WIN {
          win.hide().unwrap();
          api.prevent_close();
        } else {
          let _ = win.close();
        }
      }
      tauri::WindowEvent::Destroyed => {
        let state: State<ServerManagerState> = event.window().state();
        state.manager_mutex.lock().unwrap().kill();
      }
      _ => {}
    })
    .plugin(
      tauri_plugin_log::Builder::default()
        .targets([LogTarget::LogDir, LogTarget::Stdout, LogTarget::Webview])
        .build(),
    )
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
