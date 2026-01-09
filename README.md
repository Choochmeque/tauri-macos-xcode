# tauri-macos-xcode

[![npm](https://img.shields.io/npm/v/@choochmeque/tauri-macos-xcode.svg)](https://www.npmjs.com/package/@choochmeque/tauri-macos-xcode)
[![codecov](https://codecov.io/gh/Choochmeque/tauri-macos-xcode/branch/main/graph/badge.svg)](https://codecov.io/gh/Choochmeque/tauri-macos-xcode)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Generate Xcode projects for macOS Tauri apps. Similar to `tauri ios init` but for macOS.

## Features

- Open macOS Tauri apps in Xcode
- Build and run from Xcode (Cmd+R)
- Debug with Xcode debugger and Instruments
- Profile performance with Xcode tools

## Requirements

- [XcodeGen](https://github.com/yonaskolb/XcodeGen) - `brew install xcodegen`
- Xcode
- A Tauri v2 project
- [tauri-cli](https://tauri.app/start/prerequisites/#rust) - `cargo install tauri-cli` (required for Archive/Release builds)

## Usage

### 1. Initialize the Xcode project

```bash
npx @choochmeque/tauri-macos-xcode init
```

This will:
- Create the Xcode project in `src-tauri/gen/apple-macos/`
- Generate app icons from `src-tauri/icons/`
- Add `tauri:macos:dev` script to your package.json
- Add this package as a devDependency

### 2. Start development

```bash
npm run tauri:macos:dev
# or
yarn tauri:macos:dev
# or
pnpm tauri:macos:dev
# or
bun tauri:macos:dev
```

This starts the frontend dev server and opens Xcode. Then press Cmd+R in Xcode to build and run.

## What it generates

```
src-tauri/gen/apple-macos/
├── project.yml              # XcodeGen configuration
├── <app>_macOS/
│   ├── Info.plist           # App metadata
│   └── <app>_macOS.entitlements
├── Assets.xcassets/         # App icons (auto-generated from src-tauri/icons/)
├── scripts/
│   ├── build-rust.sh        # Bash wrapper for build script
│   └── build.swift          # Swift build script with Xcode diagnostics
├── Podfile                  # CocoaPods (if needed)
└── .gitignore
```

## How it works

**Debug builds** (Cmd+R):
1. Xcode runs a build script that compiles Rust code with `cargo build`
2. The app connects to your frontend dev server (configured in `tauri.conf.json`)

**Release/Archive builds** (Product → Archive):
1. Xcode runs `cargo tauri build --no-bundle` which builds frontend and embeds it into the binary
2. The app is self-contained and doesn't need a dev server
3. Ready for distribution via App Store or direct download

## Commands

### `init`

```bash
npx @choochmeque/tauri-macos-xcode init [--path <project-path>]
```

Creates the Xcode project structure and generates the `.xcodeproj` using XcodeGen.

### `dev`

```bash
npx tauri-macos-xcode dev [--open] [--path <project-path>]
```

Starts the frontend dev server (reads `build.beforeDevCommand` from tauri.conf.json) and optionally opens Xcode.

## Configuration

The tool reads configuration from your `tauri.conf.json`:

- `productName` - App name
- `identifier` (or `bundle.identifier`) - Bundle identifier
- `version` - App version
- `build.beforeDevCommand` - Command to start dev server
- `bundle.category` - App Store category
- `bundle.copyright` - Copyright string
- `bundle.resources` - Resource files to bundle (supports glob patterns)
- `bundle.fileAssociations` - File type associations
- `bundle.macOS.minimumSystemVersion` - Minimum macOS version (default: 11.0)
- `bundle.macOS.files` - Additional files to copy into the app bundle
- `bundle.macOS.frameworks` - System or custom frameworks to link
- `bundle.macOS.entitlements` - Custom entitlements file path
- `bundle.macOS.infoPlist` - Custom Info.plist to merge

## App Icons

Icons are automatically generated from your Tauri icons during `init`. The tool looks for:
- `src-tauri/icons/icon.png`
- `src-tauri/icons/128x128@2x.png`
- `src-tauri/icons/128x128.png`

If no source icon is found, you can manually add icons to `src-tauri/gen/apple-macos/Assets.xcassets/AppIcon.appiconset/`.

Required sizes:
- 16x16, 16x16@2x
- 32x32, 32x32@2x
- 128x128, 128x128@2x
- 256x256, 256x256@2x
- 512x512, 512x512@2x

## Debugging Rust Code

To debug Rust code in Xcode, use symbolic breakpoints:

1. Go to **Debug → Breakpoints → Create Symbolic Breakpoint**
2. Enter a function name (e.g., `my_function` or `my_module::my_function`)
3. Build and run with Cmd+R

You can also use LLDB commands in the debug console:
```
breakpoint set -f main.rs -l 10
```

Note: Clicking in the gutter doesn't work for `.rs` files since Xcode doesn't natively support Rust. Use symbolic breakpoints or LLDB commands instead.

## Troubleshooting

### XcodeGen not found

Install XcodeGen:
```bash
brew install xcodegen
```

### Cargo not found during Xcode build

The build script sources `~/.cargo/env`. Make sure Rust is installed via rustup.

## License

[MIT](LICENSE)
