#define WIN32_LEAN_AND_MEAN

#include <winsock2.h>
#include <windows.h>
#include <shellapi.h>

#define LOCAL_PORT_FIRST 53173
#define LOCAL_PORT_LAST 53272
#define CREATE_HIDDEN (CREATE_NO_WINDOW | CREATE_UNICODE_ENVIRONMENT)

void *memset(void *destination, int value, SIZE_T count) {
  volatile unsigned char *output = (volatile unsigned char *)destination;
  for (SIZE_T index = 0; index < count; index += 1) {
    output[index] = (unsigned char)value;
  }
  return destination;
}

void *memcpy(void *destination, const void *source, SIZE_T count) {
  volatile unsigned char *output = (volatile unsigned char *)destination;
  const volatile unsigned char *input =
    (const volatile unsigned char *)source;
  for (SIZE_T index = 0; index < count; index += 1) {
    output[index] = input[index];
  }
  return destination;
}

static void show_error(const wchar_t *message) {
  MessageBoxW(
    NULL,
    message,
    L"녹픽던 웹 던전 — 실행 오류",
    MB_OK | MB_ICONERROR | MB_SETFOREGROUND
  );
}

static BOOL file_exists(const wchar_t *path) {
  DWORD attributes = GetFileAttributesW(path);
  return attributes != INVALID_FILE_ATTRIBUTES &&
    !(attributes & FILE_ATTRIBUTE_DIRECTORY);
}

static BOOL set_project_directory(void) {
  static wchar_t executable_path[MAX_PATH];
  DWORD length = GetModuleFileNameW(NULL, executable_path, MAX_PATH);
  if (length == 0 || length >= MAX_PATH) {
    return FALSE;
  }

  wchar_t *separator = NULL;
  for (wchar_t *cursor = executable_path; *cursor != L'\0'; cursor += 1) {
    if (*cursor == L'\\') {
      separator = cursor;
    }
  }
  if (separator == NULL) {
    return FALSE;
  }
  *separator = L'\0';
  return SetCurrentDirectoryW(executable_path);
}

static BOOL run_hidden_and_wait(
  wchar_t *command_line,
  const wchar_t *application_name,
  DWORD *exit_code
) {
  STARTUPINFOW startup = {0};
  PROCESS_INFORMATION process = {0};
  startup.cb = sizeof(startup);
  startup.dwFlags = STARTF_USESHOWWINDOW;
  startup.wShowWindow = SW_HIDE;

  BOOL started = CreateProcessW(
    application_name,
    command_line,
    NULL,
    NULL,
    FALSE,
    CREATE_HIDDEN,
    NULL,
    NULL,
    &startup,
    &process
  );
  if (!started) {
    return FALSE;
  }

  WaitForSingleObject(process.hProcess, INFINITE);
  DWORD code = 1;
  GetExitCodeProcess(process.hProcess, &code);
  CloseHandle(process.hThread);
  CloseHandle(process.hProcess);
  if (exit_code != NULL) {
    *exit_code = code;
  }
  return TRUE;
}

static BOOL node_version_is_supported(const wchar_t *node_path) {
  static wchar_t command_line[2048];
  wsprintfW(
    command_line,
    L"\"%ls\" -e \"const v=process.versions.node.split('.').map(Number);"
    L"process.exit(v[0]>22||(v[0]===22&&v[1]>=13)?0:1)\"",
    node_path
  );

  DWORD exit_code = 1;
  return run_hidden_and_wait(command_line, node_path, &exit_code) &&
    exit_code == 0;
}

static BOOL local_server_is_ready(unsigned short port) {
  SOCKET connection = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  if (connection == INVALID_SOCKET) {
    return FALSE;
  }

  struct sockaddr_in address;
  ZeroMemory(&address, sizeof(address));
  address.sin_family = AF_INET;
  address.sin_port = htons(port);
  address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

  BOOL ready = connect(
    connection,
    (const struct sockaddr *)&address,
    sizeof(address)
  ) == 0;
  closesocket(connection);
  return ready;
}

static unsigned short find_available_local_port(void) {
  for (
    unsigned short port = LOCAL_PORT_FIRST;
    port <= LOCAL_PORT_LAST;
    port += 1
  ) {
    SOCKET candidate = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
    if (candidate == INVALID_SOCKET) {
      return 0;
    }

    struct sockaddr_in address;
    ZeroMemory(&address, sizeof(address));
    address.sin_family = AF_INET;
    address.sin_port = htons(port);
    address.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

    BOOL available = bind(
      candidate,
      (const struct sockaddr *)&address,
      sizeof(address)
    ) == 0;
    closesocket(candidate);
    if (available) {
      return port;
    }
  }
  return 0;
}

static BOOL open_local_game(const wchar_t *url) {
  HINSTANCE result = ShellExecuteW(
    NULL,
    L"open",
    url,
    NULL,
    NULL,
    SW_SHOWNORMAL
  );
  return (INT_PTR)result > 32;
}

static BOOL start_local_server(
  const wchar_t *node_path,
  unsigned short port,
  PROCESS_INFORMATION *process
) {
  static wchar_t command_line[MAX_PATH * 2];
  wsprintfW(
    command_line,
    L"\"%ls\" tools\\local-server.mjs --port %u",
    node_path,
    (unsigned int)port
  );
  STARTUPINFOW startup = {0};
  startup.cb = sizeof(startup);
  startup.dwFlags = STARTF_USESHOWWINDOW;
  startup.wShowWindow = SW_HIDE;
  ZeroMemory(process, sizeof(*process));

  return CreateProcessW(
    node_path,
    command_line,
    NULL,
    NULL,
    FALSE,
    CREATE_HIDDEN | CREATE_NEW_PROCESS_GROUP,
    NULL,
    NULL,
    &startup,
    process
  );
}

static void stop_process_tree(DWORD process_id) {
  static wchar_t command_line[256];
  wsprintfW(
    command_line,
    L"taskkill.exe /PID %lu /T /F",
    (unsigned long)process_id
  );
  DWORD ignored_exit_code = 0;
  run_hidden_and_wait(command_line, NULL, &ignored_exit_code);
}

static int launcher_main(void) {
  if (
    !set_project_directory() ||
    !file_exists(L"local-dist\\index.html") ||
    !file_exists(L"tools\\local-server.mjs")
  ) {
    show_error(
      L"실행 파일과 압축된 로컬 게임 파일을 찾을 수 없습니다.\n\n"
      L"ZIP 안에서 바로 실행하지 말고, ZIP 전체를 먼저 압축 해제한 뒤 "
      L"프로젝트 폴더의 ShatteredWebDungeon-Local.exe를 실행해 주세요."
    );
    return 1;
  }

  WSADATA winsock_data;
  if (WSAStartup(MAKEWORD(2, 2), &winsock_data) != 0) {
    show_error(L"Windows 네트워크 기능을 시작하지 못했습니다.");
    return 1;
  }

  unsigned short local_port = find_available_local_port();
  if (local_port == 0) {
    show_error(
      L"사용할 수 있는 로컬 실행 포트를 찾지 못했습니다.\n\n"
      L"기존 녹픽던 실행 창을 닫은 뒤 다시 실행해 주세요."
    );
    WSACleanup();
    return 1;
  }

  static wchar_t local_url[128];
  wsprintfW(
    local_url,
    L"http://127.0.0.1:%u/?local=%u",
    (unsigned int)local_port,
    (unsigned int)local_port
  );

  static wchar_t node_path[MAX_PATH];
  DWORD node_length = SearchPathW(
    NULL,
    L"node.exe",
    NULL,
    MAX_PATH,
    node_path,
    NULL
  );
  if (node_length == 0 || node_length >= MAX_PATH) {
    int choice = MessageBoxW(
      NULL,
      L"Node.js가 설치되어 있지 않습니다.\n\n"
      L"Node.js 22.13 이상을 설치한 뒤 이 파일을 다시 실행해 주세요.\n"
      L"공식 다운로드 페이지를 열까요?",
      L"녹픽던 웹 던전 — Node.js 필요",
      MB_YESNO | MB_ICONQUESTION | MB_SETFOREGROUND
    );
    if (choice == IDYES) {
      ShellExecuteW(
        NULL,
        L"open",
        L"https://nodejs.org/ko/download",
        NULL,
        NULL,
        SW_SHOWNORMAL
      );
    }
    WSACleanup();
    return 1;
  }

  if (!node_version_is_supported(node_path)) {
    show_error(
      L"설치된 Node.js 버전이 너무 낮습니다.\n\n"
      L"Node.js 22.13 이상으로 업데이트한 뒤 다시 실행해 주세요."
    );
    WSACleanup();
    return 1;
  }

  PROCESS_INFORMATION server_process;
  if (!start_local_server(node_path, local_port, &server_process)) {
    show_error(
      L"압축된 로컬 게임 서버를 시작하지 못했습니다."
    );
    WSACleanup();
    return 1;
  }
  CloseHandle(server_process.hThread);

  BOOL ready = FALSE;
  for (int attempt = 0; attempt < 300; attempt += 1) {
    if (local_server_is_ready(local_port)) {
      ready = TRUE;
      break;
    }
    if (WaitForSingleObject(server_process.hProcess, 0) == WAIT_OBJECT_0) {
      break;
    }
    Sleep(150);
  }

  if (!ready) {
    stop_process_tree(server_process.dwProcessId);
    CloseHandle(server_process.hProcess);
    show_error(
      L"45초 안에 압축된 로컬 게임 서버가 준비되지 않았습니다."
    );
    WSACleanup();
    return 1;
  }

  if (!open_local_game(local_url)) {
    static wchar_t manual_message[512];
    wsprintfW(
      manual_message,
      L"브라우저를 자동으로 열지 못했습니다.\n\n"
      L"브라우저 주소창에 %ls 을 직접 입력해 주세요.\n"
      L"게임을 끝낸 뒤 이 창의 [확인]을 누르면 로컬 서버가 종료됩니다.",
      local_url
    );
    MessageBoxW(
      NULL,
      manual_message,
      L"녹픽던 웹 던전 — 브라우저 열기",
      MB_OK | MB_ICONWARNING | MB_SETFOREGROUND
    );
    stop_process_tree(server_process.dwProcessId);
    CloseHandle(server_process.hProcess);
    WSACleanup();
    return 1;
  }

  MessageBoxW(
    NULL,
    L"브라우저에서 게임이 실행 중입니다.\n\n"
    L"게임을 끝낼 때 이 창의 [확인]을 누르면 로컬 서버도 함께 종료됩니다.",
    L"녹픽던 웹 던전 — 실행 중",
    MB_OK | MB_ICONINFORMATION | MB_SETFOREGROUND
  );

  stop_process_tree(server_process.dwProcessId);
  CloseHandle(server_process.hProcess);
  WSACleanup();
  return 0;
}

void launcherEntry(void) {
  ExitProcess((UINT)launcher_main());
}
