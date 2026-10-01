// Pas de console : le compagnon est toute l'interface.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    lumo_lib::run()
}
