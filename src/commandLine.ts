import { Command } from "commander";
import { spawn } from "node:child_process";
import { timeStamp } from "node:console";
export async function runCommand(cmd: string, args: string[]) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(cmd, args, {
			// stdio: "inherit",
			stdio: "pipe",
			// env: {
			// 	...process.env,
			// 	PYTHONIOENCODING: "utf-8",
			// },
		});
		child.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${cmd} exited with code ${code}`));
		});
		child.on("error", (error) => {
			console.error(
				`[${getCurrentTimestamp()}]-runCommand: Command "${cmd}" error: ${error}`,
			);
			reject(
				new Error(`Catched Error when running command "${cmd}": ${error}`),
			);
		});
		child.on("exit", (code) => {
			if (code !== 0) {
				console.error(
					`[${getCurrentTimestamp()}]-runCommand: Command "${cmd}" exited with code ${code}`,
				);
				reject(new Error(`Command "${cmd}" exited with code ${code}`));
			}
			if (code === 0) resolve();
		});
		child.on("disconnect", () => {
			console.error(
				`[${getCurrentTimestamp()}]-runCommand: Command "${cmd}" disconnected`,
			);
			reject(new Error(`Command "${cmd}" disconnected`));
		});
		// child.on("message", (message) => {
		// 	console.log(
		// 		`[${getCurrentTimestamp()}]-runCommand: Command "${cmd}" message: ${message}`,
		// 	);
		// });
	});
}

// Timestamp
function getCurrentTimestamp() {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
		now.getDate(),
	).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(
		now.getMinutes(),
	).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
}
