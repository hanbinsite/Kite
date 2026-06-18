pub async fn try_stub_call(
    endpoint: &str,
    service_name: &str,
    method_name: &str,
    request_bytes: &[u8],
) -> Result<Option<Vec<u8>>, Box<dyn std::error::Error>> {
    let _ = (endpoint, service_name, method_name, request_bytes);
    Ok(None)
}