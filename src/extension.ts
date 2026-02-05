import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface LogLevel {
  name: string;
  patterns: RegExp[];
  decorationType: vscode.TextEditorDecorationType;
}

let logLevels: LogLevel[] = [];
let tailWatchers: Map<string, fs.FSWatcher> = new Map();
let outputChannel: vscode.OutputChannel;
let statusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {
  console.log('LogLens activated');

  outputChannel = vscode.window.createOutputChannel('LogLens');
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(outputChannel, statusBarItem);

  // Initialize log levels with decorations
  initializeLogLevels();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('loglens.openViewer', openLogViewer),
    vscode.commands.registerCommand('loglens.filterByLevel', filterByLevel),
    vscode.commands.registerCommand('loglens.tailFile', tailFile),
    vscode.commands.registerCommand('loglens.clearHighlights', clearHighlights)
  );

  // Apply highlights when opening/changing log files
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor && isLogFile(editor.document)) {
        applyHighlights(editor);
        updateStatusBar(editor.document);
      } else {
        statusBarItem.hide();
      }
    })
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && editor.document === event.document && isLogFile(event.document)) {
        applyHighlights(editor);
        updateStatusBar(event.document);
      }
    })
  );

  // Apply to current editor if it's a log file
  if (vscode.window.activeTextEditor && isLogFile(vscode.window.activeTextEditor.document)) {
    applyHighlights(vscode.window.activeTextEditor);
    updateStatusBar(vscode.window.activeTextEditor.document);
  }

  // Cleanup on deactivate
  context.subscriptions.push({
    dispose: () => {
      tailWatchers.forEach((watcher) => watcher.close());
      tailWatchers.clear();
    }
  });
}

function initializeLogLevels() {
  const config = vscode.workspace.getConfiguration('loglens');

  logLevels = [
    {
      name: 'ERROR',
      patterns: [
        /\b(ERROR|FATAL|CRITICAL|SEVERE)\b/gi,
        /\[ERROR\]/gi,
        /level[=:]"?error"?/gi
      ],
      decorationType: vscode.window.createTextEditorDecorationType({
        backgroundColor: config.get('errorColor', '#ff6b6b') + '33',
        overviewRulerColor: config.get('errorColor', '#ff6b6b'),
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        isWholeLine: true
      })
    },
    {
      name: 'WARN',
      patterns: [
        /\b(WARN|WARNING)\b/gi,
        /\[WARN(ING)?\]/gi,
        /level[=:]"?warn(ing)?"?/gi
      ],
      decorationType: vscode.window.createTextEditorDecorationType({
        backgroundColor: config.get('warnColor', '#ffd93d') + '33',
        overviewRulerColor: config.get('warnColor', '#ffd93d'),
        overviewRulerLane: vscode.OverviewRulerLane.Right,
        isWholeLine: true
      })
    },
    {
      name: 'INFO',
      patterns: [
        /\b(INFO)\b/gi,
        /\[INFO\]/gi,
        /level[=:]"?info"?/gi
      ],
      decorationType: vscode.window.createTextEditorDecorationType({
        backgroundColor: config.get('infoColor', '#6bcb77') + '22',
        isWholeLine: true
      })
    },
    {
      name: 'DEBUG',
      patterns: [
        /\b(DEBUG|TRACE|VERBOSE)\b/gi,
        /\[DEBUG\]/gi,
        /level[=:]"?debug"?/gi
      ],
      decorationType: vscode.window.createTextEditorDecorationType({
        backgroundColor: config.get('debugColor', '#4d96ff') + '22',
        isWholeLine: true
      })
    }
  ];
}

function isLogFile(document: vscode.TextDocument): boolean {
  const fileName = document.fileName.toLowerCase();
  return fileName.endsWith('.log') ||
         fileName.endsWith('.logs') ||
         document.languageId === 'log';
}

function applyHighlights(editor: vscode.TextEditor) {
  const document = editor.document;
  const text = document.getText();

  for (const level of logLevels) {
    const decorations: vscode.DecorationOptions[] = [];

    for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
      const line = document.lineAt(lineNum);
      const lineText = line.text;

      for (const pattern of level.patterns) {
        pattern.lastIndex = 0;
        if (pattern.test(lineText)) {
          decorations.push({
            range: line.range,
            hoverMessage: `Log Level: ${level.name}`
          });
          break;
        }
      }
    }

    editor.setDecorations(level.decorationType, decorations);
  }
}

function updateStatusBar(document: vscode.TextDocument) {
  const text = document.getText();
  let errorCount = 0;
  let warnCount = 0;
  let infoCount = 0;

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;
    if (/\b(ERROR|FATAL|CRITICAL)\b/i.test(line)) errorCount++;
    else if (/\b(WARN|WARNING)\b/i.test(line)) warnCount++;
    else if (/\bINFO\b/i.test(line)) infoCount++;
  }

  statusBarItem.text = `$(bug) E:${errorCount} W:${warnCount} I:${infoCount}`;
  statusBarItem.tooltip = `LogLens: ${errorCount} errors, ${warnCount} warnings, ${infoCount} info`;
  statusBarItem.show();
}

async function openLogViewer() {
  const files = await vscode.workspace.findFiles('**/*.log', '**/node_modules/**', 20);

  if (files.length === 0) {
    vscode.window.showInformationMessage('No log files found in workspace');
    return;
  }

  const items = files.map(file => ({
    label: path.basename(file.fsPath),
    description: vscode.workspace.asRelativePath(file),
    uri: file
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a log file to open'
  });

  if (selected) {
    const document = await vscode.workspace.openTextDocument(selected.uri);
    await vscode.window.showTextDocument(document);
  }
}

async function filterByLevel() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !isLogFile(editor.document)) {
    vscode.window.showWarningMessage('Open a log file first');
    return;
  }

  const level = await vscode.window.showQuickPick(
    ['ERROR', 'WARN', 'INFO', 'DEBUG', 'All Levels'],
    { placeHolder: 'Select log level to filter' }
  );

  if (!level) return;

  const document = editor.document;
  const filteredLines: string[] = [];

  for (let i = 0; i < document.lineCount; i++) {
    const line = document.lineAt(i).text;

    if (level === 'All Levels') {
      filteredLines.push(line);
    } else {
      const patterns = logLevels.find(l => l.name === level)?.patterns || [];
      for (const pattern of patterns) {
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          filteredLines.push(`[${i + 1}] ${line}`);
          break;
        }
      }
    }
  }

  outputChannel.clear();
  outputChannel.appendLine(`=== Filtered: ${level} (${filteredLines.length} lines) ===\n`);
  filteredLines.forEach(line => outputChannel.appendLine(line));
  outputChannel.show();
}

async function tailFile() {
  const editor = vscode.window.activeTextEditor;
  if (!editor || !isLogFile(editor.document)) {
    vscode.window.showWarningMessage('Open a log file first');
    return;
  }

  const filePath = editor.document.uri.fsPath;

  if (tailWatchers.has(filePath)) {
    tailWatchers.get(filePath)?.close();
    tailWatchers.delete(filePath);
    vscode.window.showInformationMessage(`Stopped tailing ${path.basename(filePath)}`);
    return;
  }

  let lastSize = fs.statSync(filePath).size;

  const watcher = fs.watch(filePath, (eventType) => {
    if (eventType === 'change') {
      const stats = fs.statSync(filePath);
      if (stats.size > lastSize) {
        const fd = fs.openSync(filePath, 'r');
        const buffer = Buffer.alloc(stats.size - lastSize);
        fs.readSync(fd, buffer, 0, buffer.length, lastSize);
        fs.closeSync(fd);

        const newContent = buffer.toString('utf-8');
        outputChannel.append(newContent);
        lastSize = stats.size;
      } else if (stats.size < lastSize) {
        // File was truncated
        lastSize = stats.size;
        outputChannel.appendLine('\n--- Log file was truncated ---\n');
      }
    }
  });

  tailWatchers.set(filePath, watcher);
  outputChannel.clear();
  outputChannel.appendLine(`=== Tailing ${path.basename(filePath)} ===\n`);
  outputChannel.show();
  vscode.window.showInformationMessage(`Tailing ${path.basename(filePath)}. Run command again to stop.`);
}

function clearHighlights() {
  const editor = vscode.window.activeTextEditor;
  if (editor) {
    for (const level of logLevels) {
      editor.setDecorations(level.decorationType, []);
    }
    vscode.window.showInformationMessage('LogLens: Highlights cleared');
  }
}

export function deactivate() {
  tailWatchers.forEach((watcher) => watcher.close());
  tailWatchers.clear();
  logLevels.forEach(level => level.decorationType.dispose());
}
