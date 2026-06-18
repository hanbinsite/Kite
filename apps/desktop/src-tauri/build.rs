fn main() {
    tauri_build::build();
    // TODO(Phase 2): configure tonic-build for proto compilation
    // tonic_build::configure().compile_protos(&["proto/service.proto"], &["proto/"])?;
}