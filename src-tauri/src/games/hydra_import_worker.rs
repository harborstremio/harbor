use super::{limits, model::Report, reader, Result};
use std::{
    io::{Read, Write},
    path::Path,
    process::{Child, Command, Stdio},
    sync::mpsc,
    thread::JoinHandle,
    time::{Duration, Instant},
};
use tokio_util::sync::CancellationToken;
pub(super) const ARG: &str = "--harbor-hydra-review-v1";
const MAGIC: &[u8] = b"HARBOR-HYDRA-1\n";
const MAX: usize = 8 * 1024 * 1024;
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(deny_unknown_fields)]
struct Reply {
    report: Option<Report>,
    error: Option<String>,
}
pub(super) fn main() -> i32 {
    limits::worker_started();
    let result = std::panic::catch_unwind(|| -> Result<Report> {
        let mut bytes = Vec::new();
        std::io::stdin()
            .lock()
            .take(16385)
            .read_to_end(&mut bytes)
            .map_err(|_| "hydra_decoder")?;
        if bytes.len() > 16384 {
            return Err("hydra_path");
        }
        let path: String = serde_json::from_slice(&bytes).map_err(|_| "hydra_path")?;
        #[cfg(test)]
        if Path::new(&path).join("fixture-hold").is_file() {
            std::fs::write(
                Path::new(&path).join("fixture-ready"),
                std::process::id().to_string(),
            )
            .map_err(|_| "hydra_read")?;
            loop {
                std::thread::sleep(Duration::from_millis(50));
            }
        }
        reader::read(Path::new(&path))
    })
    .unwrap_or(Err("hydra_database"));
    let reply = match result {
        Ok(report) => Reply {
            report: Some(report),
            error: None,
        },
        Err(error) => Reply {
            report: None,
            error: Some(error.into()),
        },
    };
    let bytes = serde_json::to_vec(&reply).unwrap_or_default();
    let bytes = if bytes.len() > MAX {
        br#"{"report":null,"error":"hydra_limit"}"#.to_vec()
    } else {
        bytes
    };
    let mut stdout = std::io::stdout().lock();
    if stdout
        .write_all(MAGIC)
        .and_then(|_| stdout.write_all(&(bytes.len() as u32).to_le_bytes()))
        .and_then(|_| stdout.write_all(&bytes))
        .and_then(|_| stdout.flush())
        .is_err()
    {
        2
    } else {
        0
    }
}
struct Process {
    child: Child,
    _limits: limits::Limits,
    thread: Option<JoinHandle<()>>,
}
impl Drop for Process {
    fn drop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}
fn read_reply(mut input: impl Read) -> Result<Reply> {
    let mut matched = 0;
    for index in 0..4096 {
        let mut byte = [0];
        input.read_exact(&mut byte).map_err(|_| "hydra_decoder")?;
        matched = if byte[0] == MAGIC[matched] {
            matched + 1
        } else {
            usize::from(byte[0] == MAGIC[0])
        };
        if matched == MAGIC.len() {
            break;
        }
        if index == 4095 {
            return Err("hydra_decoder");
        }
    }
    let mut length = [0; 4];
    input.read_exact(&mut length).map_err(|_| "hydra_decoder")?;
    let length = u32::from_le_bytes(length) as usize;
    if length > MAX {
        return Err("hydra_limit");
    }
    let mut bytes = vec![0; length];
    input.read_exact(&mut bytes).map_err(|_| "hydra_decoder")?;
    serde_json::from_slice(&bytes).map_err(|_| "hydra_decoder")
}
pub(super) fn inspect(
    path: &Path,
    cancel: &CancellationToken,
    deadline: Instant,
) -> Result<Report> {
    super::check(cancel, deadline)?;
    let mut command = Command::new(std::env::current_exe().map_err(|_| "hydra_decoder")?);
    #[cfg(not(test))]
    command.arg(ARG);
    #[cfg(test)]
    {
        let module = module_path!().split_once("::").unwrap().1;
        command.args([
            format!("{module}::tests::worker_entry"),
            "--exact".into(),
            "--ignored".into(),
            "--nocapture".into(),
        ]);
    }
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    limits::configure_with_file_limit(&mut command, 128 * 1024 * 1024);
    let mut child = command.spawn().map_err(|_| "hydra_decoder")?;
    let cap = match limits::Limits::attach(&child) {
        Ok(cap) => cap,
        Err(_) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err("hydra_decoder");
        }
    };
    let mut process = Process {
        child,
        _limits: cap,
        thread: None,
    };
    let stdout = process.child.stdout.take().ok_or("hydra_decoder")?;
    let (sender, receiver) = mpsc::sync_channel(1);
    process.thread = Some(
        std::thread::Builder::new()
            .name("hydra-review-pipe".into())
            .spawn(move || {
                let _ = sender.send(read_reply(stdout));
            })
            .map_err(|_| "hydra_decoder")?,
    );
    let request =
        serde_json::to_vec(path.to_str().ok_or("hydra_path")?).map_err(|_| "hydra_path")?;
    if request.len() > 16384 {
        return Err("hydra_path");
    }
    process
        .child
        .stdin
        .take()
        .ok_or("hydra_decoder")?
        .write_all(&request)
        .map_err(|_| "hydra_decoder")?;
    let reply = loop {
        super::check(cancel, deadline)?;
        match receiver.recv_timeout(Duration::from_millis(40)) {
            Ok(reply) => break reply?,
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(_) => return Err("hydra_decoder"),
        }
    };
    loop {
        super::check(cancel, deadline)?;
        match process.child.try_wait().map_err(|_| "hydra_decoder")? {
            Some(status) if status.success() => break,
            Some(_) => return Err("hydra_decoder"),
            None => std::thread::sleep(Duration::from_millis(10)),
        }
    }
    match (reply.report, reply.error.as_deref()) {
        (Some(report), None) => Ok(report),
        (None, Some("hydra_path")) => Err("hydra_path"),
        (None, Some("hydra_read")) => Err("hydra_read"),
        (None, Some("hydra_limit")) => Err("hydra_limit"),
        (None, Some("hydra_database")) => Err("hydra_database"),
        _ => Err("hydra_decoder"),
    }
}
#[cfg(test)]
mod tests {
    #[test]
    #[ignore]
    fn worker_entry() {
        std::process::exit(super::main());
    }
    #[test]
    fn oversized_or_invalid_worker_output_is_rejected() {
        use std::io::Cursor;
        let mut frame = super::MAGIC.to_vec();
        frame.extend_from_slice(&((super::MAX + 1) as u32).to_le_bytes());
        assert!(matches!(
            super::read_reply(Cursor::new(frame)),
            Err("hydra_limit")
        ));
        assert!(matches!(
            super::read_reply(Cursor::new(vec![0; 4096])),
            Err("hydra_decoder")
        ));
    }
}
