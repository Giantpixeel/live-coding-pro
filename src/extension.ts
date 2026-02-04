import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// دالة المساعدة للنوم
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// إدارة الجلسة
class LiveCodingSession {
    private panel: vscode.WebviewPanel | undefined;
    private editor: vscode.TextEditor | undefined;
    private highlightDecoration: vscode.TextEditorDecorationType;
    private isPaused: boolean = false;
    private currentLine: number = 0;
    private totalLines: number = 0;

    constructor() {
        this.highlightDecoration = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(86, 156, 214, 0.15)',
            border: '2px solid rgba(86, 156, 214, 0.3)',
            isWholeLine: true
        });
    }

    async start(filePath: string) {
        try {
            // قراءة الملف
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            this.totalLines = lines.length;
            
            // تحميل الإعدادات
            const config = vscode.workspace.getConfiguration('liveCoding');
            const typingSpeed = config.get<number>('typingSpeed', 60);
            const language = config.get<string>('language', 'python');

            // إظهار رسالة البدء
            vscode.window.showInformationMessage(`🚀 بدأ الشرح من: ${path.basename(filePath)}`);

            // إنشاء محرر جديد
            const doc = await vscode.workspace.openTextDocument({
                language: language,
                content: ''
            });

            this.editor = await vscode.window.showTextDocument(doc, {
                viewColumn: vscode.ViewColumn.One,
                preserveFocus: true
            });

            // إنشاء نافذة الشرح
            this.panel = vscode.window.createWebviewPanel(
                'liveCoding',
                'الشرح التفاعلي - Live Coding Pro',
                vscode.ViewColumn.Two,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            this.panel.webview.html = this.getPanelHTML('🚀 ابدأ التعلم!');

            // كتابة الأسطر
            for (let i = 0; i < lines.length; i++) {
                if (this.isPaused) {
                    await this.waitForResume();
                }

                this.currentLine = i + 1;
                const line = lines[i];

                // إذا كان السطر شرح
                if (line.trim().startsWith('# explain:')) {
                    const explanation = line.replace('# explain:', '').trim();
                    this.updatePanelContent(explanation, '🧠 شرح');
                    
                    if (config.get<boolean>('autoPause', true)) {
                        await sleep(1500);
                    }
                    continue;
                }

                // كتابة السطر
                await this.typeLine(line, i, typingSpeed);

                // تسليط الضوء
                this.highlightCurrentLine(i, line.length);

                // تحديث الواجهة
                this.updatePanelStats();

                await sleep(200); // وقت بين الأسطر
            }

            // إكمال الجلسة
            this.completeSession();

        } catch (error) {
            vscode.window.showErrorMessage(`❌ خطأ: ${error}`);
        }
    }

    private async typeLine(line: string, lineIndex: number, speed: number) {
        if (!this.editor) return;

        const position = new vscode.Position(lineIndex, 0);

        // كتابة حرف حرف
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            await this.editor.edit(edit => {
                edit.insert(new vscode.Position(lineIndex, i), char);
            });

            // سرعات مختلفة لأنواع الحروف
            let charDelay = speed;
            if (char === ' ') charDelay = speed * 0.5;
            else if (['.', ',', ';', ':'].includes(char)) charDelay = speed * 2;
            
            await sleep(charDelay);
        }

        // إضافة سطر جديد
        if (lineIndex < this.totalLines - 1) {
            await this.editor.edit(edit => {
                edit.insert(new vscode.Position(lineIndex, line.length), '\n');
            });
        }
    }

    private highlightCurrentLine(lineIndex: number, lineLength: number) {
        if (!this.editor) return;

        const range = new vscode.Range(
            new vscode.Position(lineIndex, 0),
            new vscode.Position(lineIndex, lineLength)
        );

        this.editor.setDecorations(this.highlightDecoration, [range]);
        this.editor.revealRange(range);
    }

    private async waitForResume(): Promise<void> {
        return new Promise(resolve => {
            const interval = setInterval(() => {
                if (!this.isPaused) {
                    clearInterval(interval);
                    resolve();
                }
            }, 100);
        });
    }

    private updatePanelContent(content: string, title: string = 'الشرح') {
        if (!this.panel) return;

        this.panel.webview.postMessage({
            command: 'updateContent',
            content: content,
            title: title
        });
    }

    private updatePanelStats() {
        if (!this.panel) return;

        const progress = Math.round((this.currentLine / this.totalLines) * 100);
        
        this.panel.webview.postMessage({
            command: 'updateStats',
            progress: progress,
            currentLine: this.currentLine,
            totalLines: this.totalLines
        });
    }

    private completeSession() {
        if (this.panel) {
            this.panel.webview.html = this.getCompletionHTML();
        }

        vscode.window.showInformationMessage(
            '🎉 اكتمل الدرس بنجاح!',
            { modal: false },
            '🔄 إعادة التشغيل',
            '❌ إغلاق'
        );
    }

    private getPanelHTML(initialContent: string = ''): string {
        return `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {
                    background: #1e1e1e;
                    color: #ffffff;
                    font-family: 'Segoe UI', sans-serif;
                    padding: 20px;
                    margin: 0;
                }
                .header {
                    color: #4ec9b0;
                    font-size: 24px;
                    margin-bottom: 20px;
                    border-bottom: 2px solid #007acc;
                    padding-bottom: 10px;
                }
                .content {
                    font-size: 18px;
                    line-height: 1.6;
                    margin: 20px 0;
                    padding: 20px;
                    background: rgba(37, 37, 38, 0.8);
                    border-radius: 10px;
                }
                .stats {
                    background: rgba(78, 201, 176, 0.1);
                    padding: 15px;
                    border-radius: 8px;
                    margin-top: 20px;
                }
                .progress-bar {
                    width: 100%;
                    height: 10px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 5px;
                    margin: 10px 0;
                    overflow: hidden;
                }
                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #007acc, #4ec9b0);
                    border-radius: 5px;
                    transition: width 0.3s;
                }
            </style>
        </head>
        <body>
            <h1 class="header">الشرح التفاعلي</h1>
            <div class="content" id="content">${initialContent}</div>
            <div class="stats">
                <div>📊 التقدم: <span id="progress">0%</span></div>
                <div class="progress-bar">
                    <div class="progress-fill" id="progressBar" style="width: 0%"></div>
                </div>
                <div>📝 السطر: <span id="currentLine">0</span> / <span id="totalLines">0</span></div>
            </div>
            <script>
                const vscode = acquireVsCodeApi();
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    
                    if (message.command === 'updateContent') {
                        document.getElementById('content').textContent = message.content;
                    }
                    
                    if (message.command === 'updateStats') {
                        document.getElementById('progress').textContent = message.progress + '%';
                        document.getElementById('progressBar').style.width = message.progress + '%';
                        document.getElementById('currentLine').textContent = message.currentLine;
                        document.getElementById('totalLines').textContent = message.totalLines;
                    }
                });
            </script>
        </body>
        </html>
        `;
    }

    private getCompletionHTML(): string {
        return `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <style>
                body {
                    background: #1e1e1e;
                    color: white;
                    text-align: center;
                    padding: 50px 20px;
                    font-family: 'Segoe UI', sans-serif;
                }
                .celebrate {
                    font-size: 60px;
                    margin-bottom: 20px;
                }
                h1 {
                    color: #4ec9b0;
                    font-size: 28px;
                }
            </style>
        </head>
        <body>
            <div class="celebrate">🎉</div>
            <h1>اكتمل الدرس بنجاح!</h1>
            <p>لقد تعلمت بنجاح. جرب درساً آخر!</p>
        </body>
        </html>
        `;
    }
}

// ============================
// المدير الرئيسي
// ============================

class LiveCodingManager {
    private currentSession: LiveCodingSession | undefined;

    async startSession() {
        try {
            const file = await vscode.window.showOpenDialog({
                canSelectMany: false,
                filters: {
                    'Python': ['py'],
                    'JavaScript': ['js'],
                    'Text': ['txt']
                },
                openLabel: 'اختر ملف للشرح التفاعلي'
            });

            if (!file || file.length === 0) {
                return;
            }

            this.currentSession = new LiveCodingSession();
            await this.currentSession.start(file[0].fsPath);

        } catch (error) {
            vscode.window.showErrorMessage(`❌ خطأ: ${error}`);
        }
    }

    async quickStart() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('❌ افتح ملفاً أولاً!');
            return;
        }

        this.currentSession = new LiveCodingSession();
        await this.currentSession.start(editor.document.fileName);
    }

    openSettings() {
        vscode.commands.executeCommand('workbench.action.openSettings', 'liveCoding');
    }
}

// ============================
// تفعيل الامتداد
// ============================

export function activate(context: vscode.ExtensionContext) {
    console.log('🚀 Live Coding Pro مفعل!');
    
    const manager = new LiveCodingManager();

    // تسجيل الأوامر
    const commands = [
        vscode.commands.registerCommand('liveCoding.start', () => {
            console.log('✅ liveCoding.start تم تنفيذه');
            manager.startSession();
        }),
        
        vscode.commands.registerCommand('liveCoding.quickStart', () => {
            console.log('✅ liveCoding.quickStart تم تنفيذه');
            manager.quickStart();
        }),
        
        vscode.commands.registerCommand('liveCoding.settings', () => {
            console.log('✅ liveCoding.settings تم تنفيذه');
            manager.openSettings();
        })
    ];

    context.subscriptions.push(...commands);

    // شريط الحالة
    const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBar.text = "$(play) ابدأ الشرح";
    statusBar.tooltip = 'Live Coding Pro - ابدأ شرحاً تفاعلياً';
    statusBar.command = 'liveCoding.start';
    statusBar.show();
    context.subscriptions.push(statusBar);

    // رسالة ترحيبية
    vscode.window.showInformationMessage(
        '🚀 Live Coding Pro جاهز للاستخدام!',
        { modal: false },
        'ابدأ الآن',
        'الإعدادات'
    );
}

export function deactivate() {
    console.log('👋 Live Coding Pro مغلق');
}