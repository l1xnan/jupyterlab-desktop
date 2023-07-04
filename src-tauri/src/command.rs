use lazy_static::lazy_static;
use log::{error, info, warn};
use std::collections::HashMap;
use std::process::Command;
use std::sync::Mutex;
use tauri::ipc::RemoteDomainAccessScope;
use tauri::{AppHandle, Manager, Window};
use url::Url;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use crate::{jupyter::Server, utils::gen_token};

const CREATE_NO_WINDOW: u32 = 0x08000000;

lazy_static! {
  static ref SERVERS: Mutex<HashMap<String, Server>> = Mutex::new(HashMap::new());
}

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
pub fn greet(name: &str) -> String {
  format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
pub async fn get_free_port() -> u16 {
  portpicker::pick_unused_port().expect("failed to find unused port")
}

#[tauri::command]
pub fn open_devtools(window: Window) {
  window.open_devtools();
}

#[tauri::command]
pub async fn create_server(handle: AppHandle, window: Window, folder: &str) -> Result<(), ()> {
  let port = portpicker::pick_unused_port().expect("failed to find unused port");
  let token = gen_token();
  // https://github.com/tauri-apps/tauri/discussions/3273
  let mut command = Command::new("jupyter");

  command.args([
    "lab",
    "--no-browser",
    "--expose-app-in-browser",
    "--ServerApp.port",
    format!("{port}").as_str(),
    // use our token rather than any pre-configured password
    "--ServerApp.password=''",
    "--ServerApp.token",
    token.as_str(),
    "--ServerApp.tornado_settings={'headers': {'Content-Security-Policy': 'frame-ancestors *'}}",
    "--ServerApp.allow_origin=*",
    "--ServerApp.allow_credentials=True",
    "--ServerApp.root_dir",
    folder,
  ]);

  #[cfg(target_os = "windows")]
  command.creation_flags(CREATE_NO_WINDOW);

  let child = command.spawn().expect("failed to execute child");

  // let _ = state.manager_mutex.lock().unwrap().start(child);
  let url = format!("http://localhost:{port}/lab?token={token}");
  info!("child.id={}", child.id());
  info!("url={}", url);

  let server = Server::new(url.as_str(), folder);

  let origin = server.origin.clone().unwrap();
  let _ = tauri::WindowBuilder::new(
    &handle,
    origin.clone(), /* the unique window label */
    tauri::WindowUrl::External(url.parse().unwrap()),
  )
  .title(origin)
  .inner_size(1200.0, 800.0)
  .build()
  .unwrap();

  let mut servers = SERVERS.lock().unwrap();
  servers.insert(server.origin.clone().unwrap(), server.clone());

  if let Some(main_win) = window.get_window("main") {
    main_win.set_focus().unwrap_or(());
    main_win.unminimize().unwrap_or(());
    main_win.hide().unwrap_or(());
  }
  Ok(())
  // url
}

/// parse command output
pub fn parse_output(bytes: Vec<u8>) -> Vec<Server> {
  let content = String::from_utf8(bytes).unwrap();
  info!("output: {}", content);

  let mut data: Vec<Server> = vec![];

  for item in content.split("\n") {
    if item.starts_with("http") || item.starts_with("[JupyterServerListApp]") {
      let servers: Vec<&str> = item.split("::").collect();
      if servers.len() == 2 {
        let mut link = servers[0].trim();
        if let Some(tmp) = link.strip_prefix("[JupyterServerListApp]") {
          link = tmp.trim();
        }
        let folder = servers[1].trim();
        warn!("{:?}, {:?}", link, folder);
        data.push(Server::new(link, folder))
      }
    }
  }
  data
}

#[tauri::command]
pub async fn get_running_servers() -> Result<Vec<Server>, ()> {
  info!("query running server...");
  let mut command = Command::new("jupyter");
  command.args(["lab", "list"]);

  #[cfg(target_os = "windows")]
  command.creation_flags(CREATE_NO_WINDOW);

  let res = command.output();

  match res {
    Ok(output) => {
      let mut data: Vec<Server> = vec![];

      let out_data = parse_output(output.stdout);
      let err_data = parse_output(output.stderr);

      data.extend(out_data);
      data.extend(err_data);

      let mut servers = SERVERS.lock().unwrap();
      for server in &data {
        servers.insert(server.origin.clone().unwrap(), server.clone());
      }
      Ok(data)
    }
    Err(err) => {
      error!("{:?}", err);
      Ok(vec![])
    }
  }
}

#[tauri::command]
pub async fn open_window(handle: AppHandle, window: Window, url: String) {
  let init_script = include_str!("./init.js");

  let href: Url = Url::parse(url.as_str()).unwrap();
  let origin = href.origin().unicode_serialization();

  let _ = tauri::WindowBuilder::new(
    &handle,
    // Window labels must only include alphanumeric characters, `-`, `/`, `:` and `_`.")
    origin.clone().replace(".", "_"), /* the unique window label */
    tauri::WindowUrl::External(url.parse().unwrap()),
  )
  .initialization_script(init_script)
  .title(origin)
  // .decorations(false)
  .inner_size(1200.0, 800.0)
  .build()
  .unwrap();

  if let Some(main_win) = window.get_window("main") {
    main_win.set_focus().unwrap_or(());
    main_win.unminimize().unwrap_or(());
    main_win.hide().unwrap_or(());
  }

  handle.ipc_scope().configure_remote_access(
    RemoteDomainAccessScope::new("localhost")
      .add_window("main")
      .add_window("external")
      .enable_tauri_api(),
  );
}
