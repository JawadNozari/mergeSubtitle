import { spawn } from "node:child_process";

type stdioType = "inherit" | "pipe" | "ignore";
export async function runCommand(
	cmd: string,
	args: string[],
	stdio: stdioType = "inherit",
) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(cmd, args, {
			stdio: stdio,
		});
		child.on("close", (code) => {
			if (code === 0) resolve();
			else reject(new Error(`${cmd} exited with code ${code}`));
		});
		child.on("error", (error) => {
			console.error(
				`[${getCurrentTimestamp()}] Command ${cmd} error: ${error}`,
			);
			reject(
				new Error(`Catched Error when running command "${cmd}": ${error}`),
			);
		});
		child.on("exit", (code) => {
			if (code !== 0) {
				console.error(
					`[${getCurrentTimestamp()}] Command ${cmd} exited with code ${code}`,
				);
				reject(new Error(`Command "${cmd}" exited with code ${code}`));
			}
			if (code === 0) resolve();
		});
		child.on("disconnect", () => {
			console.error(`[${getCurrentTimestamp()}] Command "${cmd}" disconnected`);
			reject(new Error(`Command "${cmd}" disconnected`));
		});

		// reject(new Error(`Command "${cmd}" failed to start`));
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
