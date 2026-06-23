# 批量录入助手 (Student Work Recorder)

React Native Android app for batch recording student activities (companionship & talk records) via automated browser control.

## Architecture

```
[Android App] ──HTTPS──> [Cloudflare Tunnel] ──> [Express :3000] ──Playwright──> [xuegong.hitwh.edu.cn]
                              │                        │
                              └── trycloudflare.com    └── MySQL (credentials, tasks)
```

- App authenticates users via WeChat-style `openid`
- Two login methods: password (saved credentials) and QR code scan (SSO page)
- Backend uses Playwright headless Chrome to automate university system web pages
- Tasks execute asynchronously; frontend polls for progress

## Project Structure

```
app/                          # React Native Expo frontend
├── App.js                    # Entry point → AppRegistry
├── src/
│   ├── App.js                # Main app: splash screen, navigation, openid init
│   ├── screens/
│   │   ├── HomeScreen.js     # Home: week display, 4 entry types, credential check
│   │   ├── RecordScreen.js   # Login (password/QR), student list, start recording
│   │   ├── ProgressScreen.js # Task progress polling with exponential backoff
│   │   ├── ResultScreen.js   # Results: per-student breakdown, errors
│   │   ├── SettingsScreen.js # Credential management
│   │   ├── HistoryScreen.js  # Task history
│   │   └── WeekSettingsScreen.js
│   └── utils/
│       ├── api.js            # HTTP client with timeout (15s normal, 45s auth)
│       └── week.js           # Week calculation utilities
└── android/                  # Android native project (bare Expo workflow)
    ├── app/build.gradle      # Build config: hermesFlags, ndk.abiFilters
    └── gradle.properties     # Hermes, ProGuard, GIF/WebP, architectures

server/                       # Node.js Express backend
├── app.js                    # Express entry, routes, health check
├── routes/auth.js            # Auth routes: login, QR, credential, session-status
├── routes/task.js            # Task CRUD, code submission
├── services/
│   ├── browser.js            # Playwright pool (2 contexts, 60s queue timeout)
│   ├── login.js              # Xuegong login automation, pendingLogins Map
│   ├── navigator.js          # Page navigation, student list extraction
│   ├── orchestrator.js       # Task execution engine
│   ├── companion.js          # Companionship record automation
│   └── talk.js               # Talk record automation
├── models/                   # Database models
└── middleware/               # Auth, error handling
```

## Build & Deploy

### APK Build (optimized)

```bash
cd app/android

# Release APK - arm64 only (~21MB)
./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a

# Debug APK - all architectures (for emulator testing)
./gradlew assembleDebug
```

Output: `app/build-final/outputs/apk/release/app-release.apk`

### Size Optimization (73MB → 21MB, -71%)

| Optimization | Location | Saving |
|---|---|---|
| Arm64-v8a only (not all 4 ABIs) | `-PreactNativeArchitectures=arm64-v8a` + `ndk.abiFilters` | ~50MB |
| Hermes `-O` (no source map) | `build.gradle`: `hermesFlags = ["-O"]` | ~2MB |
| GIF/WebP disabled | `gradle.properties`: `expo.gif.enabled=false` | ~5MB |
| ProGuard + shrinkResources | `gradle.properties`: `android.enableProguardInReleaseBuilds=true` | ~2MB |

Note: `react-native-reanimated` must be kept — removing it causes white screen on launch.

### Server Deploy

```bash
# On server (118.190.208.230, path: /root/hit-record/)
node server/app.js

# Safe restart
bash /root/restart-server.sh
```

### Server Maintenance

| Mechanism | Purpose |
|---|---|
| Login session TTL (30min) | Auto-release browser contexts |
| QR session TTL (5min) | Auto-cleanup expired QR scans |
| Browser pool queue timeout (60s) | Prevent indefinite waiting |
| Daily cron restart (4am) | Memory cleanup |
| `/root/restart-server.sh` | Safe restart with `fuser -k` |

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | WeChat openid login |
| GET | `/api/auth/credential` | Check saved credentials |
| POST | `/api/auth/credential` | Save credentials |
| GET | `/api/auth/session-status` | Check active browser session |
| POST | `/api/auth/start-login` | Start password login |
| POST | `/api/auth/submit-captcha` | Submit captcha |
| POST | `/api/auth/submit-code` | Submit MFA code |
| POST | `/api/auth/qrcode-start` | Start QR login |
| POST | `/api/auth/qrcode-wait` | Check QR scan status |
| POST | `/api/auth/qrcode-submit-code` | Submit MFA from QR flow |
| GET | `/api/auth/student-list` | Get student list |

### Task
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/task/create` | Create recording task |
| GET | `/api/task/:uuid` | Get task status + details |
| POST | `/api/task/:uuid/submit-code` | Submit captcha during task |
| POST | `/api/task/:uuid/resend-code` | Resend captcha |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health + memory |

## Recent Fixes

### Session Management (2026-06-23)
- **Bug**: Browser pool exhausted after days of uptime, causing request timeouts
- **Fix**: Added TTL to sessions (30min login, 5min QR), safe restart script, daily cron

### Mobile Page Navigation (2026-06-23)
- **Bug**: Login landing on mobile page (`xg_mobile/jzgHome`) misidentified as work log
- **Fix**: Narrowed URL check to `xg_fdygzrz/rzgl` only

### Client Timeout (2026-06-23)
- **Bug**: Password login took 20-30s but client timeout was 15s
- **Fix**: Split timeouts: 45s for auth endpoints, 15s for regular

### Result Display (2026-06-23)
- **Bug**: Results showed only sequence numbers, not student names
- **Fix**: Added per-student grouped details with name-based aggregation

### Week Selection (2026-06-23)
- **Bug**: Batch and fill-missing modes hid week selector
- **Fix**: Show week multi-select for all entry types

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| White screen on launch | Duplicate `const` in App.js or missing dependency | Check Metro logs |
| Request timeout | Browser pool exhausted | Restart server: `bash /root/restart-server.sh` |
| "Already on work log page" | Mobile page misidentified | Server fix applied 2026-06-23 |
| Student list empty | Session expired or login failed | Re-login via QR code |
| Can't save credentials | openid not initialized | Check network, reinstall app |
| Cloudflare URL changed | Server restart changed tunnel URL | Check `app/src/utils/api.js` BASE_URL |
