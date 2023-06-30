use log::{error, info, warn};
use std::os::windows::process::CommandExt;
use std::{fs, io::Write, process::Command};
use tauri::ipc::RemoteDomainAccessScope;

use tauri::api::path::home_dir;
use tauri::{Manager, State, Window};

use crate::{
  jupyter::{Server, ServerManagerState},
  utils::gen_token,
};

const CREATE_NO_WINDOW: u32 = 0x08000000;

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
pub fn create_server(state: State<ServerManagerState>, folder: &str) -> String {
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

  info!("child.id()={}", child.id());
  let _ = state.manager_mutex.lock().unwrap().start(child);
  format!("http://localhost:{port}/lab?token={token}")
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
pub async fn get_running_servers() -> Vec<Server> {
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
      data
    }
    Err(err) => {
      error!("{:?}", err);
      vec![]
    }
  }
}

/// fixed iframe security access issue:
/// ```python
/// c.ServerApp.tornado_settings = {
///     "headers": {
///       "Content-Security-Policy": "frame-ancestors * 'self' "
///     }
/// }
/// ```
pub fn jupyter_config() {
  let conf = r#"
c.ServerApp.tornado_settings.setdefault("headers", {})
c.ServerApp.tornado_settings["headers"]["Content-Security-Policy"] = "frame-ancestors * 'self'"
"#;

  if let Some(path) = home_dir() {
    println!("Your home directory, probably: {}", path.display());
    let file = path.join(".jupyter/jupyter_lab_config.py");
    if file.exists() {
      let content = fs::read_to_string(file.clone()).unwrap();

      if content.contains(conf) {
        println!("=== included `Content-Security-Policy` config.")
      } else {
        let mut writer = fs::OpenOptions::new()
          .write(true)
          .append(true) // This is needed to append to file
          .open(file.as_path().clone())
          .unwrap();
        let _ = writer.write(conf.as_bytes());
      }
    }
  } else {
    println!("home dir get error!");
  }
}

const INIT_SCRIPT: &str = r#"
window.onload = ()=> {
  var tmp = document.getElementById("jp-top-panel");
  console.log(tmp);
  setTimeout(function(){
      var tmp = document.getElementById("jp-top-panel");
      console.log(tmp);
      tmp.setAttribute("data-tauri-drag-region", "");
    }, 5000);
}
console.log("hello world from js init script");
"#;

#[tauri::command]
pub async fn open_window(handle: tauri::AppHandle, url: String) {
  let _ = tauri::WindowBuilder::new(
    &handle,
    "external", /* the unique window label */
    tauri::WindowUrl::External(url.parse().unwrap()),
  )
  .initialization_script(INIT_SCRIPT)
  .decorations(false)
  .build()
  .unwrap();
  handle.ipc_scope().configure_remote_access(
    RemoteDomainAccessScope::new("localhost")
      .add_window("main")
      .add_window("external")
      .enable_tauri_api(),
  );
}
