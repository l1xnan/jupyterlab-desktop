// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rand::Rng;
use std::{path::Path, process::Command};
use tauri::{Manager, Window};
use window_vibrancy::apply_mica;
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

mod tray;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_free_port() -> u16 {
    portpicker::pick_unused_port().expect("failed to find unused port")
}

#[tauri::command]
fn open_devtools(window: Window) {
    window.open_devtools();
}

fn gen_token() -> String {
    use rand::distributions::Alphanumeric;
    use rand::thread_rng;

    let rand_string: String = thread_rng()
        .sample_iter(&Alphanumeric)
        .take(48)
        .map(char::from)
        .collect();
    rand_string
}

#[tauri::command]
fn create_server(folder: &str) -> String {
    let port = portpicker::pick_unused_port().expect("failed to find unused port");
    let token = gen_token();
    // https://github.com/tauri-apps/tauri/discussions/3273
    let mut child = Command::new("jupyter")
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

    format!("http://localhost:{port}/lab?token={token}")
}

#[derive(Clone, serde::Serialize)]
struct Server {
    link: String,
    folder: String,
    title: String,
}

#[tauri::command]
fn get_running_servers() -> Vec<Server> {
    let output = Command::new("jupyter")
        .args(["lab", "list"])
        .output()
        .expect("failed to execute child");

    let stdout = String::from_utf8(output.stdout).unwrap();

    let mut res: Vec<Server> = vec![];

    for item in stdout.split("\n") {
        println!("{}", item);
        if item.starts_with("http") {
            let servers: Vec<&str> = item.split("::").collect();
            if servers.len() == 2 {
                let link = servers[0].trim().to_string();
                let folder = servers[1].trim();

                let title = Path::new(folder)
                    .file_name()
                    .unwrap()
                    .to_str()
                    .unwrap()
                    .to_string();
                println!("{:?}, {:?}", link, folder);
                res.push(Server {
                    link,
                    folder: folder.to_string(),
                    title,
                })
            }
        }
    }

    println!("{:?}", stdout);
    res
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_window("main").unwrap();

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, None)
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            #[cfg(target_os = "windows")]
            apply_mica(&window)
                .expect("Unsupported platform! 'apply_mica' is only supported on Windows");

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
            _ => {}
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
