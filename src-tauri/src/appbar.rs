// Enregistre la fenêtre comme « barre d'application » Windows (comme la barre des tâches),
// accrochée en haut de l'écran : le bureau utilisable commence sous elle.

#[cfg(windows)]
pub fn set(hwnd: isize, enable: bool, rect: (i32, i32, i32, i32)) {
    use std::sync::atomic::{AtomicBool, Ordering};
    use windows_sys::Win32::Foundation::RECT;
    use windows_sys::Win32::UI::Shell::{
        SHAppBarMessage, ABE_TOP, ABM_NEW, ABM_QUERYPOS, ABM_REMOVE, ABM_SETPOS, APPBARDATA,
    };

    static REGISTERED: AtomicBool = AtomicBool::new(false);

    let mut data: APPBARDATA = unsafe { std::mem::zeroed() };
    data.cbSize = std::mem::size_of::<APPBARDATA>() as u32;
    data.hWnd = hwnd as _;
    data.uEdge = ABE_TOP;
    data.rc = RECT { left: rect.0, top: rect.1, right: rect.2, bottom: rect.3 };
    let height = rect.3 - rect.1;

    unsafe {
        if !enable {
            if REGISTERED.swap(false, Ordering::SeqCst) {
                SHAppBarMessage(ABM_REMOVE, &mut data);
            }
            return;
        }
        if !REGISTERED.swap(true, Ordering::SeqCst) {
            SHAppBarMessage(ABM_NEW, &mut data);
        }
        SHAppBarMessage(ABM_QUERYPOS, &mut data);
        data.rc.bottom = data.rc.top + height;
        SHAppBarMessage(ABM_SETPOS, &mut data);
    }
}

#[cfg(not(windows))]
pub fn set(_hwnd: isize, _enable: bool, _rect: (i32, i32, i32, i32)) {}
