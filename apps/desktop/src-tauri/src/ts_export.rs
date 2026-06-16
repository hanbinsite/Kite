#[cfg(test)]
mod tests {
    use ts_rs::TS;

    // These structs only exist to verify ts-rs pipeline
    #[allow(dead_code)]
    #[derive(TS)]
    #[ts(export, export_to = "../generated/")]
    struct TestHeader {
        key: String,
        value: String,
    }

    #[allow(dead_code)]
    #[derive(TS)]
    #[ts(export, export_to = "../generated/")]
    struct TestRequestConfig {
        id: String,
        method: String,
        url: String,
        headers: Vec<TestHeader>,
    }

    #[test]
    fn ts_rs_export_works() {
        // Export declarations via TS derive macros at compile time
        // Files are written to src-tauri/generated/
        TestHeader::export().unwrap();
        TestRequestConfig::export().unwrap();
        assert!(std::path::Path::new("generated").exists());
    }
}