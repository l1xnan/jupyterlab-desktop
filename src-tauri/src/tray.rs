use tauri::{
  AppHandle, CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
};
use tauri::{Manager, State};

use crate::jupyter::ServerManagerState;

pub const MAIN_WIN: &str = "main";

pub fn menu() -> SystemTray {
  let show = CustomMenuItem::new("show".to_string(), "显示");
  let hide = CustomMenuItem::new("hide".to_string(), "隐藏");
  let quit = CustomMenuItem::new("quit".to_string(), "退出");
  let tray_menu = SystemTrayMenu::new()
    .add_item(show)
    .add_item(hide)
    .add_native_item(SystemTrayMenuItem::Separator)
    .add_item(quit);

  #[cfg(target_os = "macos")]
  {
    SystemTray::new()
      .with_menu(tray_menu)
      .with_menu_on_left_click(false)
  }

  #[cfg(not(target_os = "macos"))]
  {
    SystemTray::new().with_menu(tray_menu)
  }
}

pub fn handler(app: &AppHandle, event: SystemTrayEvent) {
  match event {
    SystemTrayEvent::LeftClick {
      position: _,
      size: _,
      ..
    } => {
      if let Some(window) = app.get_window(MAIN_WIN) {
        window.set_focus().unwrap_or(());
        window.unminimize().unwrap_or(());
        window.show().unwrap_or(());
      }
    }
    SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
      "show" => {
        if let Some(window) = app.get_window(MAIN_WIN) {
          window.set_focus().unwrap_or(());
          window.show().unwrap_or(());
        }
      }
      "hide" => {
        if let Some(window) = app.get_window(MAIN_WIN) {
          window.set_focus().unwrap_or(());
          window.unminimize().unwrap_or(());
          window.hide().unwrap_or(());
        }
      }
      "quit" => app.exit(0),
      _ => {}
    },
    _ => {}
  }
}
