use std::borrow::BorrowMut;
use std::path::Path;
use std::process::{Child, Command};
use std::sync::Mutex;
use url::Url;

#[derive(Clone, serde::Serialize)]
pub struct Server {
  pub(crate) link: String,
  pub(crate) folder: String,
  pub(crate) title: String,
  pub(crate) port: Option<u16>,
  pub(crate) origin: Option<String>,
  pub(crate) token: Option<String>,
}

impl Server {
  pub fn new(link: &str, folder: &str) -> Self {
    let title = Path::new(folder)
      .file_name()
      .unwrap()
      .to_str()
      .unwrap()
      .to_string();

    let mut token: Option<String> = None;

    let url: Url = Url::parse(link).unwrap();
    for param in url.query_pairs() {
      if param.0 == "token" {
        println!("{}, {}", param.0, param.1);
        token = Some(param.1.to_string())
      }
    }

    let origin = url.origin().unicode_serialization();
    println!("origin={}", origin);
    Server {
      link: link.to_string(),
      folder: folder.to_string(),
      title,
      port: url.port(),
      token,
      origin: Some(origin),
    }
  }

  pub fn stop(&self) {
    if let Some(port) = self.port {
      let output = Command::new("jupyter")
        .args(["lab", "stop", port.to_string().as_str()])
        .output()
        .expect("failed to execute child");

      println!("stop output {:?}", output);
    }
  }
}
pub struct ServerManger {
  // cmd: Command,
  pub(crate) child: Option<Child>,
  pub(crate) servers: Vec<Server>,
}

impl ServerManger {
  pub fn new() -> ServerManger {
    ServerManger {
      child: None,
      servers: vec![],
    }
  }

  pub fn start(&mut self, child: Child) {
    println!("child id={}", child.id());
    self.child = Some(child);
  }

  pub fn kill(&mut self) {
    if let Some(ref mut child) = self.child.borrow_mut() {
      child
        .kill()
        .expect("Some error happened when killing child process");
      self.child = None;
    }
  }

  pub fn stop(&mut self) {
    if let Some(ref mut child) = self.child.borrow_mut() {
      child
        .kill()
        .expect("Some error happened when killing child process");
      self.child = None;
    }
  }
}
pub struct ServerManagerState {
  pub(crate) manager_mutex: Mutex<ServerManger>,
}
