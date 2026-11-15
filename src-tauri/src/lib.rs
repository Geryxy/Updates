//! Köd Koronája Launcher – a Windows-alkalmazás natív rétege.
//!
//! Feladata kizárólag a platformfüggő rész: ablakok (launcher és játék),
//! tartós mentések az alkalmazás helyi adatmappájában, közös beállításfájl.
//! A játékszabályok teljes egészében a közös TypeScript-kódban vannak.

use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

const LAUNCHER: &str = "launcher";
const GAME: &str = "game";

fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn saves_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = data_dir(app)?.join("saves");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Csak egyszerű, betűkből és számokból álló mentésnevek engedélyezettek,
/// így a webes réteg nem írhat a mentésmappán kívülre.
fn slot_path(app: &AppHandle, slot: &str) -> Result<PathBuf, String> {
    let valid = !slot.is_empty() && slot.len() <= 32 && slot.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    if !valid {
        return Err("érvénytelen mentési hely".into());
    }
    Ok(saves_dir(app)?.join(format!("{slot}.json")))
}

#[tauri::command]
fn save_write(app: AppHandle, slot: String, data: String) -> Result<(), String> {
    let path = slot_path(&app, &slot)?;
    // Előbb ideiglenes fájlba írunk, hogy egy megszakadt mentés ne rontsa el a meglévőt.
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, data).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_read(app: AppHandle, slot: String) -> Result<Option<String>, String> {
    let path = slot_path(&app, &slot)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_delete(app: AppHandle, slot: String) -> Result<(), String> {
    let path = slot_path(&app, &slot)?;
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn save_list(app: AppHandle) -> Result<Vec<String>, String> {
    let mut out = Vec::new();
    for entry in fs::read_dir(saves_dir(&app)?).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                out.push(stem.to_string());
            }
        }
    }
    Ok(out)
}

#[tauri::command]
fn saves_path(app: AppHandle) -> Result<String, String> {
    Ok(saves_dir(&app)?.to_string_lossy().into_owned())
}

#[tauri::command]
fn open_saves_dir(app: AppHandle) -> Result<(), String> {
    let dir = saves_dir(&app)?;
    #[cfg(target_os = "windows")]
    let program = "explorer";
    #[cfg(target_os = "macos")]
    let program = "open";
    #[cfg(all(unix, not(target_os = "macos")))]
    let program = "xdg-open";
    std::process::Command::new(program).arg(dir).spawn().map(|_| ()).map_err(|e| e.to_string())
}

fn settings_file(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("settings.json"))
}

#[tauri::command]
fn settings_read(app: AppHandle) -> Result<Option<String>, String> {
    let path = settings_file(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    fs::read_to_string(path).map(Some).map_err(|e| e.to_string())
}

#[tauri::command]
fn settings_write(app: AppHandle, data: String) -> Result<(), String> {
    fs::write(settings_file(&app)?, data).map_err(|e| e.to_string())
}

/// A közös beállításfájlból kiolvasott megjelenítési mód: (teljes képernyő, szélesség, magasság).
fn display_settings(app: &AppHandle) -> (bool, f64, f64) {
    let mut result = (false, 1280.0, 720.0);
    let text = settings_file(app).ok().and_then(|p| fs::read_to_string(p).ok());
    if let Some(value) = text.and_then(|t| serde_json::from_str::<serde_json::Value>(&t).ok()) {
        result.0 = value.get("fullscreen").and_then(|v| v.as_bool()).unwrap_or(false);
        if let Some((w, h)) = value.get("windowSize").and_then(|v| v.as_str()).and_then(parse_size) {
            result.1 = w;
            result.2 = h;
        }
    }
    result
}

fn parse_size(size: &str) -> Option<(f64, f64)> {
    let (w, h) = size.split_once('x')?;
    let (w, h) = (w.parse::<f64>().ok()?, h.parse::<f64>().ok()?);
    if (640.0..=7680.0).contains(&w) && (480.0..=4320.0).contains(&h) {
        Some((w, h))
    } else {
        None
    }
}

/// A játék indítása saját ablakban, ugyanazon az alkalmazáson belül (külső böngésző nélkül).
#[tauri::command]
async fn launch_game(app: AppHandle) -> Result<(), String> {
    if let Some(existing) = app.get_webview_window(GAME) {
        existing.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }
    let (fullscreen, width, height) = display_settings(&app);
    WebviewWindowBuilder::new(&app, GAME, WebviewUrl::App("index.html".into()))
        .title("Köd Koronája – A birodalmak felemelkedése")
        .inner_size(width, height)
        .min_inner_size(800.0, 560.0)
        .fullscreen(fullscreen)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    if let Some(launcher) = app.get_webview_window(LAUNCHER) {
        launcher.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Visszatérés a launcherbe: a játékablak bezárul, a launcher újra megjelenik.
#[tauri::command]
fn return_to_launcher(app: AppHandle) -> Result<(), String> {
    show_launcher(&app);
    if let Some(game) = app.get_webview_window(GAME) {
        game.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn show_launcher(app: &AppHandle) {
    if let Some(launcher) = app.get_webview_window(LAUNCHER) {
        let _ = launcher.show();
        let _ = launcher.set_focus();
    }
}

#[tauri::command]
fn set_fullscreen(window: WebviewWindow, on: bool) -> Result<(), String> {
    window.set_fullscreen(on).map_err(|e| e.to_string())
}

#[tauri::command]
fn set_window_size(window: WebviewWindow, size: String) -> Result<(), String> {
    let (w, h) = parse_size(&size).ok_or("érvénytelen ablakméret")?;
    if window.is_fullscreen().unwrap_or(false) {
        return Ok(());
    }
    window.set_size(tauri::LogicalSize::new(w, h)).map_err(|e| e.to_string())?;
    window.center().map_err(|e| e.to_string())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

pub fn run() {
    tauri::Builder::default()
        .on_window_event(|window, event| {
            // Ha a játékablakot bezárják, a launcher kerül vissza előtérbe.
            if window.label() == GAME {
                if let WindowEvent::Destroyed = event {
                    show_launcher(window.app_handle());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            save_write,
            save_read,
            save_delete,
            save_list,
            saves_path,
            open_saves_dir,
            settings_read,
            settings_write,
            launch_game,
            return_to_launcher,
            set_fullscreen,
            set_window_size,
            quit_app
        ])
        .run(tauri::generate_context!())
        .expect("a Köd Koronája Launcher indítása nem sikerült");
}

#[cfg(test)]
mod tests {
    use super::parse_size;

    #[test]
    fn ablakmeret_ertelmezese() {
        assert_eq!(parse_size("1280x720"), Some((1280.0, 720.0)));
        assert_eq!(parse_size("10x10"), None);
        assert_eq!(parse_size("abc"), None);
    }
}
