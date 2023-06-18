use rand::distributions::Alphanumeric;
use rand::thread_rng;
use rand::Rng;

/// 生成 token
pub fn gen_token() -> String {
  let rand_string: String = thread_rng()
    .sample_iter(&Alphanumeric)
    .take(48)
    .map(char::from)
    .collect();

  format!("jupyter:{rand_string}")
}
