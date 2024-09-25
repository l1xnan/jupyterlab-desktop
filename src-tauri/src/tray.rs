#![cfg(all(desktop, not(test)))]

use tauri::{
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
  Manager, Runtime,
};

use crate::utils::MAIN_WIN;

pub fn create_tray<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
  use sys_locale::get_locale;

  let locale = get_locale().unwrap_or_else(|| String::from("en-US"));

  println!("locale: {}", locale);

  let toggle = if locale != "zh-CN" { "Toggle" } else { "切换" };
  let quit = if locale != "zh-CN" { "Quit" } else { "退出" };
  let show = if locale != "zh-CN" { "Show" } else { "显示" };
  let hide = if locale != "zh-CN" { "Hide" } else { "隐藏" };

  let toggle_i = MenuItem::with_id(app, "toggle", toggle, true, None::<&str>)?;
  let quit_i = MenuItem::with_id(app, "quit", quit, true, None::<&str>)?;

  let menu1 = Menu::with_items(app, &[&toggle_i, &quit_i])?;

  let _ = TrayIconBuilder::with_id("tray-1")
    .tooltip("JupyterLab")
    .icon(app.default_window_icon().unwrap().clone())
    .menu(&menu1)
    .menu_on_left_click(false)
    .on_menu_event(move |app, event| match event.id.as_ref() {
      "quit" => {
        app.exit(0);
      }
      "toggle" => {
        if let Some(window) = app.get_webview_window(MAIN_WIN) {
          let new_title = if window.is_visible().unwrap_or_default() {
            let _ = window.hide();
            show
          } else {
            let _ = window.show();
            let _ = window.set_focus();
            hide
          };
          toggle_i.set_text(new_title).unwrap();
        }
      }
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if let TrayIconEvent::Click {
        button: MouseButton::Left,
        button_state: MouseButtonState::Up,
        ..
      } = event
      {
        let app = tray.app_handle();
        if let Some(window) = app.get_webview_window(MAIN_WIN) {
          let _ = window.show();
          let _ = window.set_focus();
        }
      }
    })
    .build(app);

  Ok(())
}
