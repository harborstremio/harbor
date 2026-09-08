use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::{Emitter, Manager};
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2ContextMenuItemCollection, ICoreWebView2ContextMenuRequestedEventArgs,
    ICoreWebView2Deferral, ICoreWebView2_11, COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_SEPARATOR,
    COREWEBVIEW2_CONTEXT_MENU_TARGET_KIND_IMAGE,
};
use webview2_com::{take_pwstr, ContextMenuRequestedEventHandler};
use windows::core::{Interface, BOOL, PWSTR};

thread_local! {
    static FRAME_REQUESTS: RefCell<HashMap<u64, (ICoreWebView2ContextMenuRequestedEventArgs, ICoreWebView2Deferral)>> = RefCell::new(HashMap::new());
}
static NEXT_REQUEST: AtomicU64 = AtomicU64::new(1);

fn complete_frame_request(request_id: u64, handled: bool) -> bool {
    FRAME_REQUESTS.with(|requests| {
        let Some((args, deferral)) = requests.borrow_mut().remove(&request_id) else {
            return false;
        };
        unsafe {
            let selected = args.SetHandled(handled).is_ok();
            let completed = deferral.Complete().is_ok();
            selected && completed
        }
    })
}

pub async fn acknowledge(
    app: tauri::AppHandle,
    request_id: u64,
    handled: bool,
) -> Result<bool, String> {
    let window = app
        .get_webview_window("main")
        .ok_or("The main window is closed.")?;
    let (send, receive) = tokio::sync::oneshot::channel();
    window
        .with_webview(move |_| {
            let _ = send.send(complete_frame_request(request_id, handled));
        })
        .map_err(|error| error.to_string())?;
    receive.await.map_err(|error| error.to_string())
}

fn transferable_url(value: String, image: bool) -> Option<String> {
    if value.len() > if image { 4 * 1024 * 1024 } else { 8192 } {
        return None;
    }
    let url = url::Url::parse(&value).ok()?;
    if !url.username().is_empty() || url.password().is_some() {
        return None;
    }
    if matches!(url.scheme(), "https" | "http") {
        return Some(value);
    }
    if image && value.starts_with("data:image/") {
        return Some(value);
    }
    None
}

unsafe fn offer_frame_context(
    app: &tauri::AppHandle,
    args: &ICoreWebView2ContextMenuRequestedEventArgs,
) -> windows::core::Result<bool> {
    let target = args.ContextMenuTarget()?;
    let mut main_frame = BOOL::default();
    target.IsRequestedForMainFrame(&mut main_frame)?;
    if main_frame.as_bool() {
        return Ok(false);
    }
    let read =
        |get: &dyn Fn(*mut PWSTR) -> windows::core::Result<()>| -> windows::core::Result<String> {
            let mut value = PWSTR::null();
            get(&mut value)?;
            Ok(take_pwstr(value))
        };
    // Some WebView2 builds report false for main-frame synthetic input. URI
    // equality keeps read-only main-page controls on their native editing path.
    if read(&|value| target.FrameUri(value))? == read(&|value| target.PageUri(value))? {
        return Ok(false);
    }
    let mut kind = Default::default();
    target.Kind(&mut kind)?;
    let mut flag = BOOL::default();
    // WebView2 can return HasSourceUri=false with a valid SourceUri. Validate
    // the actual native value; missing/unsupported values keep the native menu.
    let image_src = if kind == COREWEBVIEW2_CONTEXT_MENU_TARGET_KIND_IMAGE {
        read(&|value| target.SourceUri(value)).ok().and_then(|value| transferable_url(value, true))
    } else {
        None
    };
    // Blob URLs owned by an opaque sandbox cannot be loaded by the parent. Keep native image tools.
    if kind == COREWEBVIEW2_CONTEXT_MENU_TARGET_KIND_IMAGE && image_src.is_none() {
        #[cfg(feature = "context-fixture")]
        {
            let _ = app.emit_to(
                "main",
                "harbor:fixture-native-image-fallback",
                "WebView2 did not provide a transferable image source; native image tools retained",
            );
            if std::env::var("HARBOR_CONTEXT_FIXTURE_AUTORUN").as_deref() == Ok("1") {
                args.SetHandled(true)?;
            }
        }
        return Ok(true);
    }
    target.HasLinkUri(&mut flag)?;
    let link_url = if flag.as_bool() {
        transferable_url(read(&|value| target.LinkUri(value))?, false)
    } else {
        None
    };
    target.HasLinkText(&mut flag)?;
    let link_text = if flag.as_bool() {
        Some(
            read(&|value| target.LinkText(value))?
                .chars()
                .take(500)
                .collect::<String>(),
        )
    } else {
        None
    };
    target.HasSelection(&mut flag)?;
    let selection = if flag.as_bool() {
        Some(
            read(&|value| target.SelectionText(value))?
                .chars()
                .take(16_384)
                .collect::<String>(),
        )
    } else {
        None
    };
    if image_src.is_none()
        && link_url.is_none()
        && selection.as_ref().is_none_or(|text| text.is_empty())
    {
        return Ok(true);
    }
    let mut location = Default::default();
    args.Location(&mut location)?;
    let request_id = NEXT_REQUEST.fetch_add(1, Ordering::Relaxed);
    let deferral = args.GetDeferral()?;
    FRAME_REQUESTS.with(|requests| {
        requests
            .borrow_mut()
            .insert(request_id, (args.clone(), deferral));
    });
    let payload = serde_json::json!({ "requestId": request_id, "clientX": location.x, "clientY": location.y, "imageSrc": image_src, "linkUrl": link_url, "linkText": link_text, "selection": selection });
    if app
        .emit_to("main", "harbor:frame-context-menu", payload)
        .is_err()
    {
        complete_frame_request(request_id, false);
        return Ok(true);
    }
    let handle = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(700));
        let _ = handle.run_on_main_thread(move || {
            complete_frame_request(request_id, false);
        });
    });
    Ok(true)
}

unsafe fn retain_editing_items(
    items: &ICoreWebView2ContextMenuItemCollection,
) -> windows::core::Result<u32> {
    let mut count = 0;
    items.Count(&mut count)?;
    for index in (0..count).rev() {
        let item = items.GetValueAtIndex(index)?;
        let mut kind = Default::default();
        item.Kind(&mut kind)?;
        if kind == COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_SEPARATOR {
            continue;
        }
        let mut name = PWSTR::null();
        item.Name(&mut name)?;
        let name = take_pwstr(name);
        if !crate::native_context_policy::is_editing_command(&name) {
            items.RemoveValueAtIndex(index)?;
        }
    }
    // Native separators have no command name. Remove empty edges after filtering.
    items.Count(&mut count)?;
    let mut previous_separator = true;
    let mut index = 0;
    while index < count {
        let mut kind = Default::default();
        items.GetValueAtIndex(index)?.Kind(&mut kind)?;
        let separator = kind == COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_SEPARATOR;
        if separator && (previous_separator || index + 1 == count) {
            items.RemoveValueAtIndex(index)?;
            count -= 1;
        } else {
            previous_separator = separator;
            index += 1;
        }
    }
    Ok(count)
}

pub fn install(app: &tauri::AppHandle) -> Result<(), tauri::Error> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };
    let app = app.clone();
    window.with_webview(move |webview| unsafe {
        let configure = || -> windows::core::Result<()> {
            let core = webview.controller().CoreWebView2()?;
            let menus: ICoreWebView2_11 = core.cast()?;
            let handler = ContextMenuRequestedEventHandler::create(Box::new(move |_, args| {
                let Some(args) = args else {
                    return Ok(());
                };
                let mut editable = BOOL::default();
                if args
                    .ContextMenuTarget()
                    .and_then(|target| target.IsEditable(&mut editable))
                    .is_err()
                {
                    return Ok(());
                }
                #[cfg(feature = "context-fixture")]
                {
                    let target = args.ContextMenuTarget()?;
                    let mut main = BOOL::default();
                    let mut kind = Default::default();
                    let mut has_source = BOOL::default();
                    let mut has_link = BOOL::default();
                    target.IsRequestedForMainFrame(&mut main)?;
                    target.Kind(&mut kind)?;
                    target.HasSourceUri(&mut has_source)?;
                    target.HasLinkUri(&mut has_link)?;
                    let mut location = Default::default();
                    args.Location(&mut location)?;
                    let mut page = PWSTR::null();
                    let mut frame = PWSTR::null();
                    target.PageUri(&mut page)?;
                    target.FrameUri(&mut frame)?;
                    let mut source = PWSTR::null();
                    let _ = target.SourceUri(&mut source);
                    let source = take_pwstr(source);
                    let _ = app.emit_to("main", "harbor:fixture-native-target", serde_json::json!({ "main": main.as_bool(), "editable": editable.as_bool(), "kind": kind.0, "source": has_source.as_bool(), "sourceGetterLength": source.len(), "sourceScheme": source.split(':').next().unwrap_or(""), "link": has_link.as_bool(), "x": location.x, "y": location.y, "page": take_pwstr(page), "frame": take_pwstr(frame) }));
                }
                if !editable.as_bool() {
                    match offer_frame_context(&app, &args) {
                        Ok(true) => return Ok(()),
                        Err(error) => {
                            eprintln!("[harbor::context-menu] frame metadata unavailable: {error}");
                            return Ok(());
                        }
                        Ok(false) => {}
                    }
                    // Read-only fields are not IsEditable, but still need native
                    // Copy/Select All. Their browser command state remains authoritative.
                }
                match args
                    .MenuItems()
                    .and_then(|items| retain_editing_items(&items))
                {
                    Ok(count) if count > 0 =>
                    {
                        #[cfg(feature = "context-fixture")]
                        if editable.as_bool() {
                            let items = args.MenuItems()?;
                            let mut names = Vec::new();
                            for index in 0..count {
                                let mut kind = Default::default();
                                items.GetValueAtIndex(index)?.Kind(&mut kind)?;
                                if kind == COREWEBVIEW2_CONTEXT_MENU_ITEM_KIND_SEPARATOR { continue; }
                                let mut name = PWSTR::null();
                                items.GetValueAtIndex(index)?.Name(&mut name)?;
                                let name = take_pwstr(name);
                                if !name.is_empty() {
                                    names.push(name);
                                }
                            }
                            let _ = app.emit_to("main", "harbor:fixture-native-edit-menu", names);
                            if std::env::var("HARBOR_CONTEXT_FIXTURE_AUTORUN").as_deref() == Ok("1")
                            {
                                args.SetHandled(true)?;
                            }
                        }
                    }
                    _ => {
                        args.SetHandled(true)?;
                    }
                }
                Ok(())
            }));
            let mut token = 0;
            menus.add_ContextMenuRequested(&handler, &mut token)?;
            // WebView2 retains the event handler for this webview's lifetime.
            core.Settings()?.SetAreDefaultContextMenusEnabled(true)?;
            Ok(())
        };
        if let Err(error) = configure() {
            eprintln!("[harbor::context-menu] native editing filter unavailable: {error}");
        }
    })
}
