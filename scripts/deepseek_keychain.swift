import Foundation
import Security

let service = "huawei-ima.deepseek"
let account = "DEEPSEEK_API_KEY"
let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                           kSecAttrService as String: service,
                           kSecAttrAccount as String: account]
func fail(_ message: String) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8)); exit(1)
}
let action = CommandLine.arguments.dropFirst().first ?? ""
if action == "save" {
    let data = FileHandle.standardInput.readDataToEndOfFile()
    guard !data.isEmpty else { fail("未收到密钥。") }
    let changes = [kSecValueData as String: data]
    var status = SecItemUpdate(query as CFDictionary, changes as CFDictionary)
    if status == errSecItemNotFound {
        var item = query
        item[kSecValueData as String] = data
        status = SecItemAdd(item as CFDictionary, nil)
    }
    guard status == errSecSuccess else { fail("钥匙串保存失败，请检查系统授权。") }
    print("已保存到 macOS 钥匙串。")
} else if action == "run" {
    let args = Array(CommandLine.arguments.dropFirst(2))
    guard !args.isEmpty else { fail("缺少要启动的命令。") }
    var lookup = query
    lookup[kSecReturnData as String] = true
    lookup[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    let status = SecItemCopyMatching(lookup as CFDictionary, &result)
    guard status == errSecSuccess, let data = result as? Data,
          let key = String(data: data, encoding: .utf8), !key.isEmpty else {
        fail("无法读取密钥。请先运行 python3 scripts/configure_deepseek.py 并完成系统授权。")
    }
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/env")
    process.arguments = args
    var environment = ProcessInfo.processInfo.environment
    environment["DEEPSEEK_API_KEY"] = key
    process.environment = environment
    do { try process.run(); process.waitUntilExit(); exit(process.terminationStatus) }
    catch { fail("无法启动命令。") }
} else {
    fail("支持 save 或 run 操作。")
}
