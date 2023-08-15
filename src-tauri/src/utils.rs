use std::fs;
use std::io::Write;

use rand::distributions::Alphanumeric;
use rand::thread_rng;
use rand::Rng;

pub const MAIN_WIN: &str = "main";

/// 生成 token
pub fn gen_token() -> String {
  let rand_string: String = thread_rng()
    .sample_iter(&Alphanumeric)
    .take(48)
    .map(char::from)
    .collect();

  format!("jupyter:{rand_string}")
}

/// fixed iframe security access issue:
/// ```python
/// c.ServerApp.tornado_settings = {
///     "headers": {
///       "Content-Security-Policy": "frame-ancestors * 'self' "
///     }
/// }
/// ```
#[allow(unused)]
pub fn jupyter_config() {
  let conf = r#"
c.ServerApp.tornado_settings.setdefault("headers", {})
c.ServerApp.tornado_settings["headers"]["Content-Security-Policy"] = "frame-ancestors * 'self'"
"#;

  if let Some(path) = dirs::home_dir() {
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
