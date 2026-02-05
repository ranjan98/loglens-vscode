# LogLens VSCode Extension

Advanced log file viewer with filtering, search, and syntax highlighting for Visual Studio Code.

## Features

- **Syntax Highlighting**: Automatic color-coding by log level (ERROR, WARN, INFO, DEBUG)
- **Real-time Tail**: Watch log files for changes in real-time
- **Level Filtering**: Filter logs by severity level
- **Status Bar Stats**: Quick view of error/warning counts
- **Overview Ruler**: See error distribution in the scrollbar

## Commands

- `LogLens: Open Log Viewer` - Browse and open log files in workspace
- `LogLens: Filter by Level` - Show only logs of selected level
- `LogLens: Tail Log File` - Start/stop real-time file tailing
- `LogLens: Clear Highlights` - Remove all highlight decorations

## Configuration

```json
{
  "loglens.errorColor": "#ff6b6b",
  "loglens.warnColor": "#ffd93d",
  "loglens.infoColor": "#6bcb77",
  "loglens.debugColor": "#4d96ff",
  "loglens.autoTail": false
}
```

## Supported Log Formats

- Standard log levels: ERROR, WARN, INFO, DEBUG, TRACE
- Bracketed format: [ERROR], [WARN], [INFO]
- JSON format: level="error", level:error

## Installation

1. Clone this repository
2. Run `npm install`
3. Run `npm run compile`
4. Press F5 in VSCode to test

## License

MIT
