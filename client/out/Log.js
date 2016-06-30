'use strict';
const vscode = require("vscode");
const fs = require('fs');
class Log {
    static initialize(context) {
        Log.logFilePath = context.asAbsolutePath(Log.logFilePath);
        Log.log("LogFilePath is: " + Log.logFilePath);
        try {
            fs.closeSync(fs.openSync(Log.logFilePath, 'w'));
            fs.accessSync(Log.logFilePath);
            Log.logFile = fs.createWriteStream(Log.logFilePath);
            //make sure the logFile is closed when the extension is closed
            context.subscriptions.push(new Log());
        }
        catch (e) {
            Log.log("cannot write to LogFile, access denied. " + e);
        }
    }
    static log(message) {
        console.log(message);
        let messageNewLine = message + "\n";
        Log.outputChannel.append(messageNewLine);
        if (Log.logFile) {
            Log.logFile.write(messageNewLine);
        }
    }
    static toLogFile(message) {
        let messageNewLine = message + "\n";
        if (Log.logFile) {
            Log.logFile.write(messageNewLine);
        }
    }
    static error(message) {
        console.error(message);
        let messageNewLine = "ERROR: " + message + "\n";
        Log.outputChannel.append(messageNewLine);
        if (Log.logFile) {
            Log.logFile.write(messageNewLine);
        }
    }
    dispose() {
        Log.logFile.close();
    }
    static hint(message) {
        vscode.window.showInformationMessage("Viper: " + message);
    }
}
Log.logFilePath = "./viper_log";
Log.outputChannel = vscode.window.createOutputChannel('Viper');
exports.Log = Log;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiTG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0xvZy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxZQUFZLENBQUM7QUFFYixNQUFZLE1BQU0sV0FBTSxRQUFRLENBQUMsQ0FBQTtBQUVqQyxNQUFZLEVBQUUsV0FBTSxJQUFJLENBQUMsQ0FBQTtBQUV6QjtJQU1JLE9BQWMsVUFBVSxDQUFDLE9BQWdDO1FBQ3JELEdBQUcsQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7UUFDMUQsR0FBRyxDQUFDLEdBQUcsQ0FBQyxrQkFBa0IsR0FBRyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUE7UUFDN0MsSUFBSSxDQUFDO1lBQ0QsRUFBRSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxXQUFXLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQztZQUNoRCxFQUFFLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUMvQixHQUFHLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDcEQsOERBQThEO1lBQzlELE9BQU8sQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUMsQ0FBQztRQUMxQyxDQUFFO1FBQUEsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNULEdBQUcsQ0FBQyxHQUFHLENBQUMsMENBQTBDLEdBQUcsQ0FBQyxDQUFDLENBQUE7UUFDM0QsQ0FBQztJQUNMLENBQUM7SUFFRCxPQUFjLEdBQUcsQ0FBQyxPQUFlO1FBQzdCLE9BQU8sQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDckIsSUFBSSxjQUFjLEdBQUcsT0FBTyxHQUFHLElBQUksQ0FBQztRQUNwQyxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUN6QyxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNkLEdBQUcsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ3RDLENBQUM7SUFDTCxDQUFDO0lBRUQsT0FBYyxTQUFTLENBQUMsT0FBZTtRQUNuQyxJQUFJLGNBQWMsR0FBRyxPQUFPLEdBQUcsSUFBSSxDQUFDO1FBQ3BDLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1lBQ2QsR0FBRyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDdEMsQ0FBQztJQUNMLENBQUM7SUFFRCxPQUFjLEtBQUssQ0FBQyxPQUFlO1FBQy9CLE9BQU8sQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDdkIsSUFBSSxjQUFjLEdBQUcsU0FBUyxHQUFHLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFDaEQsR0FBRyxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDekMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7WUFDZCxHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUN0QyxDQUFDO0lBQ0wsQ0FBQztJQUVNLE9BQU87UUFDVixHQUFHLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDO0lBQ3hCLENBQUM7SUFFRCxPQUFjLElBQUksQ0FBQyxPQUFjO1FBQzdCLE1BQU0sQ0FBQyxNQUFNLENBQUMsc0JBQXNCLENBQUMsU0FBUyxHQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzdELENBQUM7QUFDTCxDQUFDO0FBbERVLGVBQVcsR0FBRyxhQUFhLENBQUM7QUFFNUIsaUJBQWEsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDO0FBSnpELFdBQUcsTUFvRGYsQ0FBQSJ9