fn main() {
    tauri_build::build();
    // Phase 2: Register proto compilation when proto files are placed in proto/
    // tonic_build::configure()
    //     .build_server(false)
    //     .compile_protos(&["proto/helloworld.proto"], &["proto/"])
    //     .unwrap_or_else(|e| eprintln!("proto compilation (non-fatal): {}", e));
}