import { statSync } from "node:fs";

export async function waitForFileToStabilize(
	filePath: string,
	timeout = 3000,
): Promise<void> {
	const interval = 200;
	let stableCount = 0;
	let lastSize = -1;
	let lastMtime = -1;
	const maxChecks = timeout / interval;

	for (let i = 0; i < maxChecks; i++) {
		try {
			const { size, mtimeMs } = statSync(filePath);

			if (size === lastSize && mtimeMs === lastMtime) {
				stableCount++;
				if (stableCount >= 2) return; // Two consecutive matches = stable
			} else {
				stableCount = 0;
			}

			lastSize = size;
			lastMtime = mtimeMs;
		} catch (err) {
			// File might not exist yet
			stableCount = 0;
		}

		await new Promise((r) => setTimeout(r, interval));
	}

	throw new Error(`File ${filePath} did not stabilize within ${timeout}ms`);
}
