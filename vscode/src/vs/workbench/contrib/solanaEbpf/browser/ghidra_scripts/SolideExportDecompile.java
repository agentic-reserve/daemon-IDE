// Ghidra script used by SolIDE headless analysis to export decompiler output.
// Placed under workbench sources so it is available on disk in dev builds.

import java.io.File;
import java.io.FileWriter;
import java.util.Iterator;

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileOptions;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;

public class SolideExportDecompile extends GhidraScript {
	private static String jsonEscape(String value) {
		if (value == null) {
			return "";
		}
		return value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
	}

	@Override
	public void run() throws Exception {
		String[] args = getScriptArgs();
		if (args.length < 1) {
			printerr("Missing output directory argument");
			return;
		}

		File outDir = new File(args[0]);
		outDir.mkdirs();

		File decompileOut = new File(outDir, "decompile.c");
		File functionsOut = new File(outDir, "functions.json");

		DecompInterface decompInterface = new DecompInterface();
		DecompileOptions options = new DecompileOptions();
		decompInterface.setOptions(options);
		decompInterface.toggleCCode(true);
		decompInterface.toggleSyntaxTree(false);
		decompInterface.setSimplificationStyle("decompile");
		decompInterface.openProgram(currentProgram);

		FileWriter cWriter = new FileWriter(decompileOut);
		FileWriter jsonWriter = new FileWriter(functionsOut);
		jsonWriter.write("[\n");

		FunctionIterator functions = currentProgram.getFunctionManager().getFunctions(true);
		boolean first = true;

		while (functions.hasNext()) {
			monitor.checkCancelled();

			Function f = functions.next();
			String name = f.getName();
			String entry = f.getEntryPoint().toString();

			if (!first) {
				jsonWriter.write(",\n");
			}
			first = false;

			jsonWriter.write("  {\"name\":\"" + jsonEscape(name) + "\",\"entry\":\"" + jsonEscape(entry) + "\"}");

			cWriter.write("\n/* === " + name + " @ " + entry + " === */\n");

			DecompileResults results = decompInterface.decompileFunction(f, 60, monitor);
			if (results == null || !results.decompileCompleted()) {
				cWriter.write("/* decompile failed */\n");
				continue;
			}

			String c = results.getDecompiledFunction().getC();
			if (c == null) {
				cWriter.write("/* no C output */\n");
				continue;
			}
			cWriter.write(c);
			if (!c.endsWith("\n")) {
				cWriter.write("\n");
			}
		}

		jsonWriter.write("\n]\n");
		jsonWriter.close();
		cWriter.close();
		decompInterface.dispose();
	}
}

