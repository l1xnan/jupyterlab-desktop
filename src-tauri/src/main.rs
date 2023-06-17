// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rand::Rng;

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_free_port() -> u16 {
    portpicker::pick_unused_port().expect("failed to find unused port")
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
fn new_session(folder: &str) -> String {
    use std::process::Command;
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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, new_session, get_free_port])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
