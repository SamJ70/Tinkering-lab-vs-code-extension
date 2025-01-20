
    import * as vscode from 'vscode';
    import * as fs from 'fs';
    import * as path from 'path';
    import { exec } from 'child_process';
    import puppeteer from 'puppeteer';
    
    interface Progress {
        report(value: { message?: string; increment?: number }): void;
    }
    
    export function activate(context: vscode.ExtensionContext) {
        // Register Fetch Test Cases Command
        context.subscriptions.push(
            vscode.commands.registerCommand('cph.fetchTestCases', async () => {
                const problemUrl = await vscode.window.showInputBox({ 
                    prompt: 'Enter the LeetCode problem URL',
                    placeHolder: 'https://leetcode.com/problems/problem-name',
                    validateInput: (url) => {
                        return url.startsWith('https://leetcode.com/problems/') ? null : 'Invalid LeetCode URL';
                    }
                });
                
                if (!problemUrl) { return; }
    
                try {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Fetching test cases...',
                        cancellable: false
                    }, async (progress) => {
                        await fetchTestCases(problemUrl, progress);
                    });
                    
                    vscode.window.showInformationMessage('Test cases fetched successfully!');
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Failed to fetch test cases: ${err.message}`);
                }
            })
        );
    
        // Register Run Test Cases Command
        context.subscriptions.push(
            vscode.commands.registerCommand('cph.runTestCases', async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    vscode.window.showErrorMessage('No active editor found!');
                    return;
                }
    
                const filePath = editor.document.fileName;
                const fileExtension = path.extname(filePath).toLowerCase();
                const languageMap: { [key: string]: string } = {
                    '.cpp': 'cpp',
                    '.py': 'python',
                    '.java': 'java',
                    '.js': 'javascript'
                };
    
                const language = languageMap[fileExtension];
                if (!language) {
                    vscode.window.showErrorMessage('Unsupported file type! Supported types: .cpp, .py, .java, .js');
                    return;
                }
    
                try {
                    await vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: 'Running test cases...',
                        cancellable: false
                    }, async (progress) => {
                        const output = await runTestCases(filePath, language, progress);
                        
                        // Create or show output channel
                        const outputChannel = vscode.window.createOutputChannel('LeetCode Tests');
                        outputChannel.clear();
                        outputChannel.appendLine(output);
                        outputChannel.show();
                    });
                    
                    vscode.window.showInformationMessage('Test execution completed. Check output channel for results.');
                } catch (err: any) {
                    vscode.window.showErrorMessage(`Error running test cases: ${err.message}`);
                }
            })
        );
    }
    
    // Fetch Test Cases
    async function fetchTestCases(url: string, progress: Progress): Promise<void> {
        const browser = await puppeteer.launch({ 
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        try {
            const page = await browser.newPage();
            progress.report({ increment: 30, message: 'Loading problem page...' });
            
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            
            await page.goto(url, { 
                waitUntil: 'networkidle0', 
                timeout: 30000 
            });
    
            // Wait for the content to load
            await page.waitForSelector('.elfjS', { timeout: 10000 });
            
            progress.report({ increment: 30, message: 'Extracting test cases...' });
    
            const testCases = await page.evaluate(() => {
                const inputs: string[] = [];
                const outputs: string[] = [];
    
                // Find the content div
                const contentDiv = document.querySelector('.elfjS');
                if (!contentDiv) return { inputs, outputs };
    
                // Find all pre elements
                const preElements = contentDiv.querySelectorAll('pre');
                
                preElements.forEach(pre => {
                    const text = pre.textContent || '';
                    const lines = text.split('\n');
                    
                    let input = '';
                    let output = '';
                    
                    lines.forEach(line => {
                        // Clean the line and remove labels
                        line = line.replace(/Input:|Output:|Explanation:/, '').trim();
                        
                        if (line.includes('nums =')) {
                            // Extract nums array and target
                            const numsMatch = line.match(/nums = (\[[\d,]+\])/);
                            const targetMatch = line.match(/target = (\d+)/);
                            
                            if (numsMatch && targetMatch) {
                                input = `${numsMatch[1]}\n${targetMatch[1]}`;
                            }
                        } else if (line.match(/^\[[\d,]+\]$/)) {
                            // This is the output line (just the array)
                            output = line;
                        }
                    });
    
                    if (input && output) {
                        inputs.push(input);
                        outputs.push(output);
                    }
                });
    
                return { inputs, outputs };
            });
    
            if (testCases.inputs.length === 0 || testCases.outputs.length === 0) {
                throw new Error('No test cases found! Make sure you\'re using a valid LeetCode problem URL.');
            }
    
            progress.report({ increment: 20, message: 'Saving test cases...' });
    
            // Log the extracted test cases for debugging
            console.log('Extracted test cases:', {
                inputs: testCases.inputs,
                outputs: testCases.outputs
            });
    
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!workspaceFolder) {
                throw new Error('No workspace folder found! Please open a workspace first.');
            }
    
            const testCaseDir = path.join(workspaceFolder, 'testcases');
            if (!fs.existsSync(testCaseDir)) {
                fs.mkdirSync(testCaseDir, { recursive: true });
            }
    
            fs.writeFileSync(path.join(testCaseDir, 'input.txt'), testCases.inputs.join('\n---\n'));
            fs.writeFileSync(path.join(testCaseDir, 'output.txt'), testCases.outputs.join('\n---\n'));
    
            progress.report({ increment: 20, message: 'Completed!' });
        } catch (error) {
            console.error('Error during test case fetching:', error);
            throw error;
        } finally {
            await browser.close();
        }
    }
    async function runTestCases(filePath: string, language: string, progress: Progress): Promise<string> {
        return new Promise((resolve, reject) => {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
            if (!workspaceFolder) {
                reject(new Error('No workspace folder found! Please open a workspace first.'));
                return;
            }
    
            const testCaseDir = path.join(workspaceFolder, 'testcases');
            const inputFile = path.join(testCaseDir, 'input.txt');
            const outputFile = path.join(testCaseDir, 'output.txt');
    
            if (!fs.existsSync(inputFile) || !fs.existsSync(outputFile)) {
                reject(new Error('Test cases not found! Please fetch them first.'));
                return;
            }
    
            progress.report({ increment: 30, message: 'Compiling code...' });
    
            const commands: { [key: string]: string } = {
                cpp: `g++ -std=c++17 "${filePath}" -o "${filePath}.out" && "${filePath}.out" < "${inputFile}"`,
                python: `python "${filePath}" < "${inputFile}"`,
                java: `javac "${filePath}" && java -cp "${path.dirname(filePath)}" "${path.basename(filePath, '.java')}" < "${inputFile}"`,
                javascript: `node "${filePath}" < "${inputFile}"`
            };
    
            const command = commands[language];
            if (!command) {
                reject(new Error(`Unsupported language: ${language}`));
                return;
            }
    
            progress.report({ increment: 40, message: 'Running tests...' });
    
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    reject(new Error(stderr || err.message));
                    return;
                }
    
                const expectedOutput = fs.readFileSync(outputFile, 'utf-8').trim();
                const actualOutput = stdout.trim();
                
                let result = 'Test Results:\n\n';
                const testInputs = fs.readFileSync(inputFile, 'utf-8').split('\n---\n');
                const testOutputs = expectedOutput.split('\n---\n');
                const actualOutputs = actualOutput.split('\n---\n');
    
                let allPassed = true;
                testInputs.forEach((input, index) => {
                    result += `Test Case ${index + 1}:\n`;
                    result += `Input:\n${input}\n\n`;
                    result += `Expected Output:\n${testOutputs[index]}\n\n`;
                    result += `Actual Output:\n${actualOutputs[index] || 'No output'}\n\n`;
                    
                    const passed = testOutputs[index].trim() === (actualOutputs[index] || '').trim();
                    result += `Status: ${passed ? 'PASSED ✓' : 'FAILED ✗'}\n\n`;
                    result += '-'.repeat(50) + '\n\n';
                    
                    if (!passed) {
                        allPassed = false;
                    }
                });
    
                result += `\nOverall Result: ${allPassed ? 'All tests passed! 🎉' : 'Some tests failed. 😢'}`;
                console.log(result);
                resolve(result);
            });
        });
    }
    
    export function deactivate() {}