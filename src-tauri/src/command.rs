use std::{fs, io::Write, process::Command};

use tauri::api::path::home_dir;
use tauri::{State, Window};

use crate::{
  jupyter::{Server, ServerManagerState},
  utils::gen_token,
};

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
  let child = Command::new("jupyter")
    .args([
      "lab",
      "--no-browser",
      "--expose-app-in-browser",
      "--ServerApp.port",
      format!("{port}").as_str(),
      // use our token rather than any pre-configured password
      "--ServerApp.password=''",
      "--ServerApp.token",
      token.as_str(),
      "--LabApp.quit_button=False",
      "--ServerApp.tornado_settings={'headers': {'Content-Security-Policy': 'frame-ancestors *'}}",
      "--ServerApp.allow_origin=*",
      "--ServerApp.allow_credentials=True",
      "--ServerApp.root_dir",
      folder,
    ])
    .spawn()
    .expect("failed to execute child");

  println!("1:child.id()={}", child.id());
  let _ = state.manager_mutex.lock().unwrap().start(child);
  format!("http://localhost:{port}/lab?token={token}")
}

#[tauri::command]
pub async fn get_running_servers() -> Vec<Server> {
  let output = Command::new("jupyter")
    .args(["lab", "list"])
    .output()
    .expect("failed to execute child");

  let stdout = String::from_utf8(output.stdout).unwrap();

  let mut res: Vec<Server> = vec![];

  for item in stdout.split("\n") {
    if item.starts_with("http") {
      let servers: Vec<&str> = item.split("::").collect();
      if servers.len() == 2 {
        let link = servers[0].trim();
        let folder = servers[1].trim();
        println!("{:?}, {:?}", link, folder);
        res.push(Server::new(link, folder))
      }
    }
  }
  res
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
