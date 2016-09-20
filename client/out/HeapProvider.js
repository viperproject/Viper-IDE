"use strict";
const vscode = require('vscode');
const Log_1 = require('./Log');
const ViperProtocol_1 = require('./ViperProtocol');
const fs = require('fs');
const Helper_1 = require('./Helper');
class HeapProvider {
    constructor() {
        this._onDidChange = new vscode.EventEmitter();
    }
    setState(heapGraph, index) {
        this.heapGraphs[index] = heapGraph;
    }
    // public getHeap(index: number): HeapGraph {
    //     return this.heapGraphs[index];
    // }
    getCurrentHeap() {
        return this.heapGraphs[1 - this.stateVisualizer.nextHeapIndex];
    }
    getPreviousHeap() {
        return this.heapGraphs[this.stateVisualizer.nextHeapIndex];
    }
    resetState() {
        this.heapGraphs = [];
    }
    provideTextDocumentContent(uri) {
        let previousState = "Previous State";
        let currentState = "Current State";
        if (Helper_1.Helper.getConfiguration("simpleMode") === true) {
            previousState = "Selected State";
            currentState = "Error State";
        }
        let table;
        let darkGraphs = Helper_1.Helper.getConfiguration("darkGraphs");
        if (this.heapGraphs.length > 1) {
            table = ` <table style="width:100%">
  <colgroup>
   <col style="width: 50%" />
   <col style="width: 50%" />
  </colgroup>
  <tr><td>
   <h1 class="Hprev">${previousState}</h1>
   ${this.heapGraphToContent(this.stateVisualizer.nextHeapIndex, 1 - this.stateVisualizer.nextHeapIndex)}
  </td><td>
   <h1 class="Hcurr">${currentState}</h1>
   ${this.heapGraphToContent(1 - this.stateVisualizer.nextHeapIndex, this.stateVisualizer.nextHeapIndex)}
  </td></tr>
 </table>`;
        }
        else if (this.heapGraphs.length == 1) {
            table = ` <h1 class="Hcurr">${currentState}</h1>${this.heapGraphToContent(0)}`;
        }
        else {
            table = " <p>No graph to show</p>";
        }
        return `<!DOCTYPE html>
<html lang="en"><head>
<style>
 table td, table td * {
  vertical-align: top;
 }
 svg {
     width:100%;
     height:800px;
     max-height: 800px;
 }
 .Hcurr {
     color:${ViperProtocol_1.StateColors.currentState(darkGraphs)}
 }
 .Hprev {
     color:${ViperProtocol_1.StateColors.previousState(darkGraphs)}
 }
 .ErrorState {
     color:red
 }
</style>
</head>
<body>
 ${table}
 <p><font face="courier">${this.stringToHtml(this.stateVisualizer.globalInfo)}</font></p>
 <a href='${uri}'>view source</a>
</body>
</html>`;
    }
    heapGraphToContent(index, otherIndex) {
        let heapGraph = this.heapGraphs[index];
        if (!heapGraph) {
            Log_1.Log.error("invalid index for heapGraphToContent: " + index);
            return;
        }
        let compareToOther = typeof otherIndex !== 'undefined';
        let otherHeapGraph;
        if (compareToOther) {
            otherHeapGraph = this.heapGraphs[otherIndex];
        }
        let conditions = "";
        if (heapGraph.conditions.length > 0) {
            heapGraph.conditions.forEach(element => {
                //if the condition is new, draw it in bold (non optimized)
                let isNew = compareToOther && otherHeapGraph.conditions.indexOf(element) < 0;
                conditions += `     <tr><td>${isNew ? "<b>" : ""}${element}${isNew ? "</b>" : ""}</td></tr>\n`;
            });
            conditions = `<h3>Path conditions</h3>
    <table border="solid">${conditions}
    </table>`;
        }
        else {
            conditions = `<h3>No path conditions</h3>`;
        }
        let state = this.stateVisualizer.decorationOptions[heapGraph.state];
        let content = `
    <h2>${heapGraph.fileName}<br />${heapGraph.methodType}: ${heapGraph.methodName}<br />${state.hoverMessage}</h2>
    <h3${state.isErrorState ? ' class="ErrorState">Errorstate' : ">State"} ${state.numberToDisplay}</h3>
    ${this.getSvgContent(Log_1.Log.svgFilePath(index))}
    ${conditions}
    <p>${this.stringToHtml(heapGraph.stateInfos)}</p><br />`;
        return content;
    }
    //position: ${heapGraph.position.line + 1}:${heapGraph.position.character + 1}
    //<img src="${Log.svgFilePath(index)}"></img><br />
    getSvgContent(filePath) {
        let content = fs.readFileSync(filePath).toString();
        return content.substring(content.indexOf("<svg"), content.length);
    }
    get onDidChange() {
        //Log.log("PreviewHTML: onDidChange", LogLevel.Debug)
        return this._onDidChange.event;
    }
    update(uri) {
        this._onDidChange.fire(uri);
    }
    errorSnippet(error) {
        return `<body>\n\t${error}\n</body>`;
    }
    stringToHtml(s) {
        return s.replace(/\n/g, "<br />\n    ").replace(/\t/g, "&nbsp;");
    }
}
exports.HeapProvider = HeapProvider;
// ${editor.document.getText(new vscode.Range(editor.selection.start, editor.selection.end))}
// <div style='border:solid;width:100;height:100'>
// </div>
// <form action="demo_form.asp">
//     First name: <input type="text" name="fname"><br>
//     Last name: <input type="text" name="lname"><br>
//     <input type="submit" value="Submit">
// </form>
// external <a href='http://www.google.ch'>link</a>
// <br>
// <a href='command:vscode.previewHtml?"${uri}"'>refresh</a> using internal link
// <br>
// <a href='${uri}'>view source</a>
// <br>
// <a href='command:editor.action.showReferences?"${editor.document.uri}"'>command</a>
// <br>
// <a href='command:editor.action.startDebug?'>start Debug</a> 
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSGVhcFByb3ZpZGVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL0hlYXBQcm92aWRlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsTUFBWSxNQUFNLFdBQU0sUUFBUSxDQUFDLENBQUE7QUFDakMsc0JBQWtCLE9BQU8sQ0FBQyxDQUFBO0FBQzFCLGdDQUF5RCxpQkFBaUIsQ0FBQyxDQUFBO0FBRTNFLE1BQVksRUFBRSxXQUFNLElBQUksQ0FBQyxDQUFBO0FBQ3pCLHlCQUFxQixVQUFVLENBQUMsQ0FBQTtBQUVoQztJQUFBO1FBRVksaUJBQVksR0FBRyxJQUFJLE1BQU0sQ0FBQyxZQUFZLEVBQWMsQ0FBQztJQTJKakUsQ0FBQztJQXhKVSxRQUFRLENBQUMsU0FBb0IsRUFBRSxLQUFhO1FBQy9DLElBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEdBQUcsU0FBUyxDQUFDO0lBQ3ZDLENBQUM7SUFFRCw2Q0FBNkM7SUFDN0MscUNBQXFDO0lBQ3JDLElBQUk7SUFFRyxjQUFjO1FBQ2pCLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFFTSxlQUFlO1FBQ2xCLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDL0QsQ0FBQztJQUVNLFVBQVU7UUFDYixJQUFJLENBQUMsVUFBVSxHQUFHLEVBQUUsQ0FBQztJQUN6QixDQUFDO0lBWU0sMEJBQTBCLENBQUMsR0FBZTtRQUM3QyxJQUFJLGFBQWEsR0FBRyxnQkFBZ0IsQ0FBQztRQUNyQyxJQUFJLFlBQVksR0FBRyxlQUFlLENBQUM7UUFDbkMsRUFBRSxDQUFDLENBQUMsZUFBTSxDQUFDLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDakQsYUFBYSxHQUFHLGdCQUFnQixDQUFDO1lBQ2pDLFlBQVksR0FBRyxhQUFhLENBQUM7UUFDakMsQ0FBQztRQUVELElBQUksS0FBYSxDQUFDO1FBQ2xCLElBQUksVUFBVSxHQUFZLGVBQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNoRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzdCLEtBQUssR0FBRzs7Ozs7O3VCQU1HLGFBQWE7S0FDL0IsSUFBSSxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsYUFBYSxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGFBQWEsQ0FBQzs7dUJBRWpGLFlBQVk7S0FDOUIsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLGFBQWEsRUFBRSxJQUFJLENBQUMsZUFBZSxDQUFDLGFBQWEsQ0FBQzs7VUFFOUYsQ0FBQztRQUNILENBQUM7UUFBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNyQyxLQUFLLEdBQUcsc0JBQXNCLFlBQVksUUFBUSxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztRQUNuRixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDSixLQUFLLEdBQUcsMEJBQTBCLENBQUM7UUFDdkMsQ0FBQztRQUVELE1BQU0sQ0FBQzs7Ozs7Ozs7Ozs7O2FBWUYsMkJBQVcsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDOzs7YUFHcEMsMkJBQVcsQ0FBQyxhQUFhLENBQUMsVUFBVSxDQUFDOzs7Ozs7OztHQVEvQyxLQUFLOzJCQUNtQixJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDO1lBQ2pFLEdBQUc7O1FBRVAsQ0FBQztJQUNMLENBQUM7SUFFTyxrQkFBa0IsQ0FBQyxLQUFhLEVBQUUsVUFBbUI7UUFDekQsSUFBSSxTQUFTLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztRQUN2QyxFQUFFLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUM7WUFDYixTQUFHLENBQUMsS0FBSyxDQUFDLHdDQUF3QyxHQUFHLEtBQUssQ0FBQyxDQUFDO1lBQzVELE1BQU0sQ0FBQztRQUNYLENBQUM7UUFFRCxJQUFJLGNBQWMsR0FBWSxPQUFPLFVBQVUsS0FBSyxXQUFXLENBQUM7UUFDaEUsSUFBSSxjQUF5QixDQUFDO1FBQzlCLEVBQUUsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7WUFDakIsY0FBYyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDakQsQ0FBQztRQUVELElBQUksVUFBVSxHQUFHLEVBQUUsQ0FBQztRQUNwQixFQUFFLENBQUMsQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ2xDLFNBQVMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLE9BQU87Z0JBQ2hDLDBEQUEwRDtnQkFDMUQsSUFBSSxLQUFLLEdBQUcsY0FBYyxJQUFJLGNBQWMsQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFDN0UsVUFBVSxJQUFJLGdCQUFnQixLQUFLLEdBQUcsS0FBSyxHQUFHLEVBQUUsR0FBRyxPQUFPLEdBQUcsS0FBSyxHQUFHLE1BQU0sR0FBRyxFQUFFLGNBQWMsQ0FBQztZQUNuRyxDQUFDLENBQUMsQ0FBQztZQUNILFVBQVUsR0FBRzs0QkFDRyxVQUFVO2FBQ3pCLENBQUE7UUFDTCxDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDSixVQUFVLEdBQUcsNkJBQTZCLENBQUM7UUFDL0MsQ0FBQztRQUVELElBQUksS0FBSyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsaUJBQWlCLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3BFLElBQUksT0FBTyxHQUFHO1VBQ1osU0FBUyxDQUFDLFFBQVEsU0FBUyxTQUFTLENBQUMsVUFBVSxLQUFLLFNBQVMsQ0FBQyxVQUFVLFNBQVMsS0FBSyxDQUFDLFlBQVk7U0FDcEcsS0FBSyxDQUFDLFlBQVksR0FBRyxnQ0FBZ0MsR0FBRyxRQUFRLElBQUksS0FBSyxDQUFDLGVBQWU7TUFDNUYsSUFBSSxDQUFDLGFBQWEsQ0FBQyxTQUFHLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxDQUFDO01BQzFDLFVBQVU7U0FDUCxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsWUFBWSxDQUFDO1FBQ3JELE1BQU0sQ0FBQyxPQUFPLENBQUM7SUFDbkIsQ0FBQztJQUVELDhFQUE4RTtJQUU5RSxtREFBbUQ7SUFFM0MsYUFBYSxDQUFDLFFBQWdCO1FBQ2xDLElBQUksT0FBTyxHQUFHLEVBQUUsQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDbkQsTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsRUFBRSxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDdEUsQ0FBQztJQUVELElBQUksV0FBVztRQUNYLHFEQUFxRDtRQUNyRCxNQUFNLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUM7SUFDbkMsQ0FBQztJQUVNLE1BQU0sQ0FBQyxHQUFlO1FBQ3pCLElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ2hDLENBQUM7SUFFTyxZQUFZLENBQUMsS0FBYTtRQUM5QixNQUFNLENBQUMsYUFBYSxLQUFLLFdBQVcsQ0FBQztJQUN6QyxDQUFDO0lBRU8sWUFBWSxDQUFDLENBQVM7UUFDMUIsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLGNBQWMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDckUsQ0FBQztBQUNMLENBQUM7QUE3Slksb0JBQVksZUE2SnhCLENBQUE7QUFFRCw2RkFBNkY7QUFDN0Ysa0RBQWtEO0FBQ2xELFNBQVM7QUFDVCxnQ0FBZ0M7QUFDaEMsdURBQXVEO0FBQ3ZELHNEQUFzRDtBQUN0RCwyQ0FBMkM7QUFDM0MsVUFBVTtBQUNWLG1EQUFtRDtBQUNuRCxPQUFPO0FBQ1AsZ0ZBQWdGO0FBQ2hGLE9BQU87QUFDUCxtQ0FBbUM7QUFDbkMsT0FBTztBQUNQLHNGQUFzRjtBQUN0RixPQUFPO0FBQ1AsOERBQThEIn0=