'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below

import { IPCMessageReader, IPCMessageWriter, createConnection, InitializeResult } from 'vscode-languageserver';
import { Log } from './Log';
import { Settings } from './Settings'
import { StateColors, ExecutionTrace, ViperSettings, Commands, VerificationState, VerifyRequest, LogLevel, ShowHeapParams } from './ViperProtocol'
import { NailgunService } from './NailgunService';
import { VerificationTask } from './VerificationTask';
import { Statement } from './Statement';
import { DebugServer } from './DebugServer';
import { Server } from './ServerClass';
import * as fs from 'fs';
import * as http from 'http';
import * as pathHelper from 'path';
let mkdirp = require('mkdirp');
var DecompressZip = require('decompress-zip');

// Create a connection for the server. The connection uses Node's IPC as a transport
Server.connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
Server.documents.listen(Server.connection);

registerHandlers();

// Listen on the connection
Server.connection.listen();

function registerHandlers() {
    //starting point (executed once)
    Server.connection.onInitialize((params): InitializeResult => {
        try {
            Log.log("Debug Server is initializing", LogLevel.LowLevelDebug);
            DebugServer.initialize();

            Server.refreshEndings();

            //Server.workspaceRoot = params.rootPath;
            Server.nailgunService = new NailgunService();
            return {
                capabilities: {}
            }
        } catch (e) {
            Log.error("Error handling initialize request: " + e);
        }
    });

    Server.connection.onShutdown(() => {
        try {
            Log.log("On Shutdown", LogLevel.Debug);
            Server.nailgunService.stopNailgunServer();
        } catch (e) {
            Log.error("Error handling shutdown: " + e);
        }
    })

    Server.connection.onDidChangeConfiguration((change) => {
        try {
            Log.log('Configuration changed', LogLevel.Info);
            let oldSettings = Settings.settings;
            Settings.settings = <ViperSettings>change.settings.viperSettings;
            if (oldSettings && Settings.settings.nailgunSettings.port == "*") {
                //When the new settings contain a wildcard port, keep using the same
                Settings.settings.nailgunSettings.port = oldSettings.nailgunSettings.port;
            }
            Log.logLevel = Settings.settings.preferences.logLevel; //after this line, Logging works
            Server.refreshEndings();
            checkSettingsAndRestartBackendIfNeeded(oldSettings);
        } catch (e) {
            Log.error("Error handling configuration change: " + e);
        }
    });

    Server.connection.onNotification(Commands.StartBackend, (selectedBackend: string) => {
        try {
            if (!selectedBackend || selectedBackend.length == 0) {
                Log.log("No backend was chosen, don't restart backend", LogLevel.Debug);
            } else {
                //recheck settings upon backend change
                checkSettingsAndRestartBackendIfNeeded(null, selectedBackend);
            }
        } catch (e) {
            Log.error("Error handling select backend request: " + e);
        }
    });

    //returns the a list of all backend names
    Server.connection.onRequest(Commands.RequestBackendNames, () => {
        return new Promise((resolve, reject) => {
            try {
                let backendNames: string[] = Settings.getBackendNames(Settings.settings);
                if (!backendNames) {
                    reject("No backend found");
                }
                else {
                    resolve(backendNames);
                }
            } catch (e) {
                reject("Error handling backend names request: " + e);
            }
        });
    });

    Server.connection.onDidOpenTextDocument((params) => {
        try {
            Server.isViperSourceFile(params.textDocument.uri).then(res => {
                if (res) {
                    let uri = params.textDocument.uri;
                    //notify client;
                    Server.sendFileOpenedNotification(params.textDocument.uri);
                    if (!Server.verificationTasks.has(uri)) {
                        //create new task for opened file
                        let task = new VerificationTask(uri, Server.nailgunService);
                        Server.verificationTasks.set(uri, task);
                    }
                }
            });
        } catch (e) {
            Log.error("Error handling TextDocument openend");
        }
    });

    Server.connection.onDidCloseTextDocument((params) => {
        try {
            Server.isViperSourceFile(params.textDocument.uri).then(res => {
                if (res) {
                    let uri = params.textDocument.uri;
                    //notify client;
                    Server.sendFileClosedNotification(uri);
                    if (Server.verificationTasks.has(uri)) {
                        //remove no longer needed task
                        Server.verificationTasks.get(uri).resetDiagnostics();
                        Server.verificationTasks.delete(uri);
                    }
                }
            });
        } catch (e) {
            Log.error("Error handling TextDocument closed");
        }
    });

    function canVerificationBeStarted(uri: string, manuallyTriggered: boolean): boolean {
        //check if there is already a verification task for that file
        let task = Server.verificationTasks.get(uri);
        if (!task) {
            Log.error("No verification task found for file: " + uri);
            return false;
        } else if (!Server.nailgunService.isReady()) {
            if (manuallyTriggered)
                Log.hint("The verification backend is not ready yet");
            Log.error("The verification backend is not ready yet");
            return false;
        }
        return true;
    }

    Server.connection.onNotification(Commands.Verify, (data: VerifyRequest) => {
        try {
            let verificationstarted = false;
            //it does not make sense to reverify if no changes were made and the verification is already running
            if (canVerificationBeStarted(data.uri, data.manuallyTriggered)) {
                Settings.workspace = data.workspace;
                Log.log("start or restart verification", LogLevel.Info);
                //stop all other verifications because the backend crashes if multiple verifications are run in parallel
                VerificationTask.stopAllRunningVerifications().then(success => {
                    //start verification
                    Server.executedStages = [];
                    verificationstarted = Server.verificationTasks.get(data.uri).verify(data.manuallyTriggered) === true;
                    if (!verificationstarted) {
                        Server.sendVerificationNotStartedNotification(data.uri);
                    }
                }, () => {
                    Server.sendVerificationNotStartedNotification(data.uri);
                });
            } else {
                Log.log("The verification cannot be started.", LogLevel.Info);
                Server.sendVerificationNotStartedNotification(data.uri);
            }
        } catch (e) {
            Log.error("Error handling verify request: " + e);
            Server.sendVerificationNotStartedNotification(data.uri);
        }
    });

    Server.connection.onNotification(Commands.UpdateViperTools, () => {
        try {
            Log.log("Updating Viper Tools ...", LogLevel.Default);
            let filename: string;
            if (Settings.isWin) {
                filename = "ViperToolsWin.zip"
            } else {
                filename = Settings.isLinux ? "ViperToolsLinux.zip" : "ViperToolsMac.zip";
            }
            //check access to download location
            let dir = <string>Settings.settings.paths.viperToolsPath;
            let viperToolsPath = pathHelper.join(dir, filename);

            //this ugly cast is needed because of a bug in typesript:
            //https://github.com/Microsoft/TypeScript/issues/10242
            (<Promise<void>>makeSureFileExistsAndCheckForWritePermission(viperToolsPath).then(error => {
                if (error && Settings.isLinux && error.startsWith("EACCES")) {
                    //change the owner of the location 
                    return makeSureFileExistsAndCheckForWritePermission(viperToolsPath)
                }
                return error;
            }).then(error => {
                if (error) {
                    throw ("The Viper Tools Update failed, change the ViperTools directory to a folder in which you have permission to create files. " + error);
                }
                //download Viper Tools
                let url = <string>Settings.settings.preferences.viperToolsProvider;
                Log.log("Downloading ViperTools from " + url + " ...", LogLevel.Default)
                return download(url, viperToolsPath);
            }).then(success => {
                if (success) {
                    return extract(viperToolsPath);
                } else {
                    throw ("Downloading viper tools unsuccessful.");
                }
            }).then(success => {
                if (success) {
                    Log.log("Extracting ViperTools finished " + (success ? "" : "un") + "successfully", LogLevel.Info);
                    if (success) {
                        //chmod to allow the execution of ng and zg files
                        if (Settings.isLinux || Settings.isMac) {
                            fs.chmodSync(pathHelper.join(dir, "nailgun", "ng"), '755') //755 is for (read, write, execute)
                            fs.chmodSync(pathHelper.join(dir, "z3", "bin", "z3"), '755') //755 is for (read, write, execute)
                            fs.chmodSync(pathHelper.join(dir, "boogie", "Binaries", "Boogie"), '755');
                        }

                        //delete archive
                        fs.unlink(viperToolsPath, (err) => {
                            if (err) {
                                Log.error("Error deleting archive after ViperToolsUpdate: " + err);
                            }
                            Log.log("ViperTools Update completed", LogLevel.Default);
                            Server.connection.sendNotification(Commands.ViperUpdateComplete, true);//success
                        });
                        //trigger a restart of the backend
                        checkSettingsAndRestartBackendIfNeeded(null, null, true);
                    }
                } else {
                    throw ("Extracting viper tools unsuccessful.");
                }
            })).catch(e => {
                Log.error(e);
                Server.connection.sendNotification(Commands.ViperUpdateComplete, false);//update failed
            });
        } catch (e) {
            Log.error("Error updating viper tools: " + e);
            Server.connection.sendNotification(Commands.ViperUpdateComplete, false);//update failed
        }
    });

    Server.connection.onRequest(Commands.Dispose, () => {
        return new Promise((resolve, reject) => {
            try {
                //if there are running verifications, stop related processes
                Server.verificationTasks.forEach(task => {
                    if (task.running && task.verifierProcess) {
                        Log.log("stop verification of " + task.filename, LogLevel.Default);
                        task.nailgunService.killNGAndZ3(task.verifierProcess.pid);
                    }
                });

                //Server.nailgunService.stopNailgunServer();
                console.log("dispose language server");
                Server.nailgunService.killNailgunServer();
                resolve();
            } catch (e) {
                Log.error("Error handling dispose request: " + e);
                reject();
            }
        });
    });

    Server.connection.onRequest(Commands.GetExecutionTrace, (params: { uri: string, clientState: number }) => {
        Log.log("Generate execution trace for client state " + params.clientState, LogLevel.Debug);
        return new Promise((resolve, reject) => {
            let result: ExecutionTrace[] = [];
            try {
                let task = Server.verificationTasks.get(params.uri);
                let serverState = task.clientStepIndexToServerStep[params.clientState];
                let maxDepth = serverState.depthLevel();
                let dark = Settings.settings.advancedFeatures.darkGraphs === true;

                if (!Settings.settings.advancedFeatures.simpleMode) {
                    //ADVANCED MODE ONLY
                    //get stateExpansion states
                    serverState.verifiable.forAllExpansionStatesWithDecoration(serverState, (child: Statement) => {
                        result.push({
                            state: child.decorationOptions.index,
                            color: StateColors.uninterestingState(dark),
                            showNumber: true
                        });
                    });
                    //get top level statements
                    serverState.verifiable.getTopLevelStatesWithDecoration().forEach(child => {
                        result.push({
                            state: child.decorationOptions.index,
                            color: StateColors.uninterestingState(dark),
                            showNumber: true
                        });
                    });
                }
                //BOTH SIMPLE AND ANVANCED MODE
                //get executionTrace of serverState
                while (true) {
                    let depth = serverState.depthLevel();
                    if (serverState.canBeShownAsDecoration && depth <= maxDepth) {
                        maxDepth = depth;
                        result.push({
                            state: serverState.decorationOptions.index,
                            color: StateColors.interestingState(dark),
                            showNumber: true
                        })//push client state
                    }
                    if (serverState.isBranch()) {
                        serverState = serverState.parent;
                    } else if (!serverState.parent) {
                        break;
                    } else {
                        serverState = task.steps[serverState.index - 1];
                    }
                    task.shownExecutionTrace = result;
                }
                resolve(result);
            } catch (e) {
                Log.error("Error handling Execution Trace Request: " + e);
                resolve(result);
            }
        });
    });

    Server.connection.onRequest(Commands.StopVerification, (uri: string) => {
        return new Promise((resolve, reject) => {
            try {
                let task = Server.verificationTasks.get(uri);
                task.abortVerificationIfRunning().then((success) => {
                    Server.sendStateChangeNotification({
                        newState: VerificationState.Ready,
                        verificationCompleted: false,
                        verificationNeeded: false,
                        uri: uri
                    }, task);
                    resolve(success);
                })
            } catch (e) {
                Log.error("Error handling stop verification request (critical): " + e);
                resolve(false);
            }
        });
    });

    Server.connection.onNotification(Commands.StopDebugging, () => {
        try {
            DebugServer.stopDebugging();
        } catch (e) {
            Log.error("Error handling stop debugging request: " + e);
        }
    })

    Server.connection.onRequest(Commands.ShowHeap, (params: ShowHeapParams) => {
        try {
            let task = Server.verificationTasks.get(params.uri);
            if (!task) {
                Log.error("No verificationTask found for " + params.uri);
                return;
            }
            Server.showHeap(task, params.clientIndex, params.isHeapNeeded);
        } catch (e) {
            Log.error("Error showing heap: " + e);
        }
    });

    // Server.connection.onRequest(Commands.GetDotExecutable, params => {
    //     return Settings.settings.paths.dotExecutable;
    // });

    Server.connection.onRequest(Commands.RemoveDiagnostics, (uri: string) => {
        //Log.log("Trying to remove diagnostics from "+ uri);
        return new Promise((resolve, reject) => {
            if (Server.verificationTasks.has(uri)) {
                Server.verificationTasks.get(uri).resetDiagnostics();
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

function download(url, filePath): Thenable<boolean> {
    return new Promise((resolve, reject) => {
        try {
            Log.startProgress();
            let file = fs.createWriteStream(filePath);
            let request = http.get(url, function (response) {
                response.pipe(file);

                //download progress 
                let len = parseInt(response.headers['content-length'], 10);
                let cur = 0;
                response.on("data", function (chunk) {
                    cur += chunk.length;
                    Log.progress("Download Viper Tools", cur, len, LogLevel.Debug);
                });

                file.on('finish', function () {
                    file.close();
                    resolve(true);
                });
                request.on('error', function (err) {
                    fs.unlink(filePath);
                    Log.error("Error downloading viper tools: " + err.message);
                    resolve(false);
                });
            });
        } catch (e) {
            Log.error("Error downloading viper tools: " + e);
        }
    });
};

function extract(filePath: string): Thenable<boolean> {
    return new Promise((resolve, reject) => {
        try {
            //extract files
            Log.log("Extracting files...", LogLevel.Info)
            Log.startProgress();
            let unzipper = new DecompressZip(filePath);

            unzipper.on('progress', function (fileIndex, fileCount) {
                Log.progress("Extracting Viper Tools", fileIndex + 1, fileCount, LogLevel.Debug);
            });

            unzipper.on('error', function (e) {
                if (e.code && e.code == 'ENOENT') {
                    Log.error("Error updating the Viper Tools, missing create file permission in the viper tools directory: " + e);
                } else if (e.code && e.code == 'EACCES') {
                    Log.error("Error extracting " + filePath + ": " + e + " | " + e.message);
                } else {
                    Log.error("Error extracting " + filePath + ": " + e);
                }
                resolve(false);
            });

            unzipper.on('extract', function (log) {
                resolve(true);
            });

            unzipper.extract({
                path: pathHelper.dirname(filePath),
                filter: function (file) {
                    return file.type !== "SymbolicLink";
                }
            });
        } catch (e) {
            Log.error("Error extracting viper tools: " + e);
            resolve(false);
        }
    });
}

function getParentDir(fileOrFolderPath: string): string {
    if (!fileOrFolderPath) return null;
    let obj = pathHelper.parse(fileOrFolderPath);
    if (obj.base) {
        return obj.dir;
    }
    let folderPath = obj.dir;
    let match = folderPath.match(/(^.*)[\/\\].+$/); //the regex retrieves the parent directory
    if (match) {
        return match[1];
    }
    else {
        return null
    }
}

function checkForCreateAndWriteAccess(folderPath: string): Thenable<string> {
    return new Promise((resolve, reject) => {
        if (!folderPath) {
            resolve("No access"); //TODO: when does that happens?
        }
        fs.stat((folderPath), (err, stats) => {
            if (err) {
                if (err.code == 'ENOENT') {
                    //no such file or directory
                    checkForCreateAndWriteAccess(getParentDir(folderPath)).then(err => {
                        //pass along the error
                        resolve(err);
                    });
                }
                else if (err.code == 'EACCES') {
                    resolve("No read permission");
                } else {
                    resolve(err.message);
                }
            }
            let writePermissions = stats.mode & 0x92;
            if (writePermissions) {
                resolve(null);
            } else {
                resolve("No write permission");
            }
        });
    });
}

//Only works for linux
function changeOwnershipToCurrentUser(filePath: string): Thenable<any> {
    return new Promise((resolve, reject) => {
        if (!filePath) {
            resolve("Cannot change ownership");
        }
        else if (!Settings.isLinux) {
            resolve("Change Ownership is currently only supported for Linux.");
        } else {
            let user = process.env["USER"];
            fs.chown(filePath, user, user, (err) => {
                if (err) {
                    changeOwnershipToCurrentUser(getParentDir(filePath)).then(err => {
                        resolve(err);
                    })
                } else {
                    resolve(null);
                }
            });
        }
    });
}

function makeSureFileExistsAndCheckForWritePermission(filePath: string, firstTry = true): Thenable<any> {
    return new Promise((resolve, reject) => {
        try {
            let folder = pathHelper.dirname(filePath);
            mkdirp(folder, (err) => {
                if (err && err.code != 'EEXIST') {
                    resolve(err.code + "Error creating " + folder + " " + err.message);
                } else {
                    fs.open(filePath, 'a', (err, file) => {
                        if (err) {
                            if (firstTry && err && err.code == "EACCES") {
                                Log.log("Try to change the ownership of " + filePath, LogLevel.Debug);
                                changeOwnershipToCurrentUser(pathHelper.dirname(filePath)).then(() => {
                                    return makeSureFileExistsAndCheckForWritePermission(filePath, false)
                                }).then(err => {
                                    resolve(err);
                                })
                            } else {
                                resolve(err.code + ": Error opening " + filePath + " " + err.message)
                            }
                        } else {
                            fs.close(file, err => {
                                if (err) {
                                    resolve(err.code + "Error closing " + filePath + " " + err.message)
                                } else {
                                    fs.access(filePath, 2, (e) => { //fs.constants.W_OK is 2
                                        if (e) {
                                            resolve(e.code + "Error accessing " + filePath + " " + e.message)
                                        } else {
                                            resolve(null);
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        } catch (e) {
            resolve(e);
        }
    });
}

function resetDiagnostics(uri: string) {
    let task = Server.verificationTasks.get(uri);
    if (!task) {
        Log.error("no verification Task for file: " + uri);
        return;
    }
    task.resetDiagnostics();
}

//tries to restart backend, 
function checkSettingsAndRestartBackendIfNeeded(oldSettings: ViperSettings, selectedBackend?: string, viperToolsUpdated: boolean = false) {
    Settings.checkSettings().then(() => {
        if (Settings.valid()) {
            if (selectedBackend) {
                Settings.selectedBackend = selectedBackend;
            }
            let newBackend = Settings.autoselectBackend(Settings.settings);
            if (newBackend) {

                // Log.log("no nailgun ready: " + !Server.nailgunService.isReady());
                // Log.log("backends changed: " + !Settings.backendEquals(Server.backend, newBackend));
                // Log.log("nailgunSettings changed: " + (oldSettings && (newBackend.useNailgun && (!Settings.nailgunEquals(Settings.settings.nailgunSettings, oldSettings.nailgunSettings)))));
                // if (oldSettings) {
                //     Log.log("old:" + JSON.stringify(oldSettings.nailgunSettings));
                //     Log.log("new:" + JSON.stringify(Settings.settings.nailgunSettings));
                // }
                // Log.log("viperToolsUpdated " + viperToolsUpdated);

                //only restart the backend after settings changed if the active backend was affected
                let restartBackend = !Server.nailgunService.isReady() //backend is not ready -> restart
                    || !Settings.backendEquals(Server.backend, newBackend) //change in backend
                    || (oldSettings && (newBackend.useNailgun && (!Settings.nailgunEquals(Settings.settings.nailgunSettings, oldSettings.nailgunSettings))))
                    || viperToolsUpdated; //backend needs nailgun and nailgun settings changed
                if (restartBackend) {
                    Log.log(`Change Backend: from ${Server.backend ? Server.backend.name : "No Backend"} to ${newBackend ? newBackend.name : "No Backend"}`, LogLevel.Info);
                    Server.backend = newBackend;
                    Server.verificationTasks.forEach(task => task.resetLastSuccess());
                    Server.nailgunService.startOrRestartNailgunServer(Server.backend, true);
                } else {
                    //In case the backend does not need to be restarted, retain the port
                    Settings.settings.nailgunSettings.port = oldSettings.nailgunSettings.port;
                    Log.log("No need to restart backend. It is still the same", LogLevel.Debug)
                    Server.backend = newBackend;
                    Server.sendBackendReadyNotification({ name: Server.backend.name, restarted: false });
                }
            } else {
                Log.error("No backend, even though the setting check succeeded.");
            }
        } else {
            Server.nailgunService.stopNailgunServer();
        }
    });
}