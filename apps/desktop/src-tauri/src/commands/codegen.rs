use serde::{Deserialize, Serialize};
use crate::commands::http::HttpRequestConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeGenResult {
    pub code: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum CodeLanguage {
    Curl,
    PythonRequests,
    JavascriptFetch,
    JavascriptAxios,
    TypescriptFetch,
    GoNetHttp,
    JavaHttpurlconnection,
    PhpCurl,
    RubyNetHttp,
    CsharpHttpclient,
    KotlinOkhttp,
    SwiftUrlsession,
    DartHttp,
    NodeUndici,
}

fn generate_curl(config: &HttpRequestConfig) -> String {
    let mut parts = vec![format!("curl -X {}", config.method)];
    parts.push(format!("'{}'", config.url));

    for h in &config.headers {
        if !h.disabled && !h.key.is_empty() {
            parts.push(format!("-H '{}: {}'", h.key, h.value));
        }
    }

    if let Some(body) = &config.body {
        if let Some(content) = &body.content {
            if !content.is_empty() {
                parts.push(format!("-d '{}'", content.replace('\'', "'\\''")));
            }
        }
    }

    parts.join(" \\\n  ")
}

fn generate_python(config: &HttpRequestConfig) -> String {
    let mut lines = vec!["import requests".to_string(), String::new()];

    lines.push(format!("url = '{}'", config.url));

    if !config.headers.is_empty() {
        let headers: Vec<String> = config.headers.iter()
            .filter(|h| !h.disabled && !h.key.is_empty())
            .map(|h| format!("    '{}': '{}'", h.key, h.value))
            .collect();
        if !headers.is_empty() {
            lines.push("headers = {".to_string());
            lines.push(headers.join(",\n"));
            lines.push("}".to_string());
        }
    }

    let mut params = vec![];
    params.push("headers=headers".to_string());

    if let Some(body) = &config.body {
        if let Some(content) = &body.content {
            if !content.is_empty()
                && body.mode == "raw" {
                    lines.push(format!("data = '{}'", content.replace('\'', "\\'")));
                    params.push("data=data".to_string());
                }
        }
    }

    lines.push(format!("response = requests.{}(url, {})", config.method.to_lowercase(), params.join(", ")));
    lines.push("print(response.status_code)".to_string());
    lines.push("print(response.text)".to_string());

    lines.join("\n")
}

fn generate_js_fetch(config: &HttpRequestConfig) -> String {
    let mut opts = vec![format!("method: '{}'", config.method)];

    if !config.headers.is_empty() {
        let headers: Vec<String> = config.headers.iter()
            .filter(|h| !h.disabled && !h.key.is_empty())
            .map(|h| format!("    '{}': '{}'", h.key, h.value))
            .collect();
        if !headers.is_empty() {
            opts.push("headers: {".to_string());
            opts.push(headers.join(",\n"));
            opts.push("}".to_string());
        }
    }

    if let Some(body) = &config.body {
        if let Some(content) = &body.content {
            if !content.is_empty() {
                opts.push(format!("body: JSON.stringify({})", content));
            }
        }
    }

    format!("fetch('{}', {{\n  {}\n}})\n  .then(response => response.json())\n  .then(data => console.log(data))\n  .catch(error => console.error(error));", config.url, opts.join(",\n  "))
}

fn generate_go(config: &HttpRequestConfig) -> String {
    let mut lines = vec!["package main".to_string(), String::new(), "import (".to_string(), "    \"fmt\"".to_string(), "    \"io\"".to_string(), "    \"net/http\"".to_string(), ")".to_string(), String::new(), "func main() {".to_string()];

    lines.push(format!("    url := \"{}\"", config.url));
    lines.push(format!("    method := \"{}\"", config.method));

    let has_body = config.body.as_ref().and_then(|b| b.content.as_ref()).map(|c| !c.is_empty()).unwrap_or(false);
    if has_body {
        lines.push("    body := strings.NewReader(`...`)".to_string());
        lines.insert(4, "    \"strings\"".to_string());
        lines.push("    req, err := http.NewRequest(method, url, body)".to_string());
    } else {
        lines.push("    req, err := http.NewRequest(method, url, nil)".to_string());
    }

    lines.push("    if err != nil {".to_string());
    lines.push("        panic(err)".to_string());
    lines.push("    }".to_string());

    for h in &config.headers {
        if !h.disabled && !h.key.is_empty() {
            lines.push(format!("    req.Header.Set(\"{}\", \"{}\")", h.key, h.value));
        }
    }

    lines.push("    client := &http.Client{}".to_string());
    lines.push("    resp, err := client.Do(req)".to_string());
    lines.push("    if err != nil {".to_string());
    lines.push("        panic(err)".to_string());
    lines.push("    }".to_string());
    lines.push("    defer resp.Body.Close()".to_string());
    lines.push("    b, _ := io.ReadAll(resp.Body)".to_string());
    lines.push("    fmt.Println(string(b))".to_string());
    lines.push("}".to_string());

    lines.join("\n")
}

fn generate_java(config: &HttpRequestConfig) -> String {
    let mut lines = vec!["import java.net.http.*;".to_string(), "import java.net.URI;".to_string(), "import java.net.http.HttpRequest;".to_string(), "import java.net.http.HttpResponse;".to_string(), String::new()];

    lines.push("HttpClient client = HttpClient.newHttpClient();".to_string());

    let mut builder_lines = vec![format!("HttpRequest request = HttpRequest.newBuilder()\n    .uri(URI.create(\"{}\"))", config.url)];

    let method_upper = config.method.to_uppercase();
    match method_upper.as_str() {
        "GET" => builder_lines.push("    .GET()".to_string()),
        "DELETE" => builder_lines.push("    .DELETE()".to_string()),
        _ => {
            if let Some(body) = &config.body {
                if let Some(content) = &body.content {
                    builder_lines.push(format!("    .{}(HttpRequest.BodyPublishers.ofString(\"{}\"))", method_upper.chars().next().unwrap_or('P'), content.replace('"', "\\\"")));
                } else {
                    builder_lines.push(format!("    .{}(HttpRequest.BodyPublishers.noBody())", method_upper));
                }
            } else {
                builder_lines.push(format!("    .{}(HttpRequest.BodyPublishers.noBody())", method_upper));
            }
        }
    }

    for h in &config.headers {
        if !h.disabled && !h.key.is_empty() {
            builder_lines.push(format!("    .header(\"{}\", \"{}\")", h.key, h.value.replace('"', "\\\"")));
        }
    }

    builder_lines.push("    .build();".to_string());
    lines.extend(builder_lines);

    lines.push(String::new());
    lines.push("HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());".to_string());
    lines.push("System.out.println(response.statusCode());".to_string());
    lines.push("System.out.println(response.body());".to_string());

    lines.join("\n")
}

fn generate_csharp(config: &HttpRequestConfig) -> String {
    let mut lines = vec!["using System.Net.Http;".to_string(), String::new()];

    lines.push("using var client = new HttpClient();".to_string());
    lines.push(format!("var request = new HttpRequestMessage(HttpMethod.{}, \"{}\");", capitalize_first(&config.method), config.url));

    for h in &config.headers {
        if !h.disabled && !h.key.is_empty() {
            lines.push(format!("request.Headers.Add(\"{}\", \"{}\");", h.key, h.value.replace('"', "\\\"")));
        }
    }

    if let Some(body) = &config.body {
        if let Some(content) = &body.content {
            if !content.is_empty() {
                lines.push(format!("request.Content = new StringContent(\"{}\");", content.replace('"', "\\\"")));
            }
        }
    }

    lines.push(String::new());
    lines.push("var response = await client.SendAsync(request);".to_string());
    lines.push("Console.WriteLine(await response.Content.ReadAsStringAsync());".to_string());

    lines.join("\n")
}

fn capitalize_first(s: &str) -> String {
    let mut c = s.chars();
    match c.next() {
        None => String::new(),
        Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
    }
}

#[tauri::command]
pub async fn generate_code(
    config: HttpRequestConfig,
    language: CodeLanguage,
) -> Result<CodeGenResult, crate::error::AppError> {
    let code = match language {
        CodeLanguage::Curl => generate_curl(&config),
        CodeLanguage::PythonRequests => generate_python(&config),
        CodeLanguage::JavascriptFetch | CodeLanguage::TypescriptFetch => generate_js_fetch(&config),
        CodeLanguage::JavascriptAxios => {
            let fetch = generate_js_fetch(&config);
            fetch.replace("fetch(", "axios(").replace(".then(response => response.json())", ".then(response => response.data)")
        }
        CodeLanguage::GoNetHttp => generate_go(&config),
        CodeLanguage::JavaHttpurlconnection => generate_java(&config),
        CodeLanguage::CsharpHttpclient => generate_csharp(&config),
        CodeLanguage::PhpCurl => format!("<?php\n$ch = curl_init('{}');\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n$response = curl_exec($ch);\ncurl_close($ch);\necho $response;\n?>", config.url),
        CodeLanguage::RubyNetHttp => format!("require 'net/http'\nrequire 'uri'\n\nuri = URI('{}')\nhttp = Net::HTTP.new(uri.host, uri.port)\nrequest = Net::HTTP::{}.new(uri.request_uri)\nresponse = http.request(request)\nputs response.body", config.url, capitalize_first(&config.method)),
        CodeLanguage::KotlinOkhttp => format!("val client = OkHttpClient()\nval request = Request.Builder()\n    .url(\"{}\")\n    .{}()\n    .build()\nclient.newCall(request).execute().use {{ response ->\n    println(response.body?.string())\n}}", config.url, config.method.to_lowercase()),
        CodeLanguage::SwiftUrlsession => format!("let url = URL(string: \"{}\")!\nvar request = URLRequest(url: url)\nrequest.httpMethod = \"{}\"\nURLSession.shared.dataTask(with: request) {{ data, response, error in\n    if let data = data {{ print(String(data: data, encoding: .utf8)!) }}\n}}.resume()", config.url, config.method),
        CodeLanguage::DartHttp => format!("import 'package:http/http.dart' as http;\n\nfinal response = await http.{}(Uri.parse('{}'));\nprint(response.body);", config.method.to_lowercase(), config.url),
        CodeLanguage::NodeUndici => format!("const {{ request }} = require('undici')\n\nconst {{ statusCode, body }} = await request('{}', {{ method: '{}' }})\nconsole.log(statusCode)\nfor await (const data of body) console.log(data.toString())", config.url, config.method),
    };

    let lang_str = serde_json::to_value(&language)
        .ok()
        .and_then(|v| v.as_str().map(|s| s.to_string()))
        .unwrap_or_else(|| "unknown".to_string());

    Ok(CodeGenResult { code, language: lang_str })
}
