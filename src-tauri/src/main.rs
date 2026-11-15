// Kiadott változatban ne nyíljon konzolablak a játék mellett.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    kod_koronaja_lib::run()
}
