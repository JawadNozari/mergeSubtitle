import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

export function verifySubtitle(filePath: string): boolean {
	const path = resolve(filePath);

	if (!existsSync(path)) {
		console.error(`❌ File not found: ${path}`);
		return false;
	}

	const stats = statSync(path);
	if (stats.size === 0) {
		console.error(`❌ File is empty: ${path}`);
		return false;
	}

	const content = readFileSync(path, "utf-8");
	const timecodePattern =
		/\d{2}:\d{2}:\d{2},\d{3}\s-->\s\d{2}:\d{2}:\d{2},\d{3}/g;

	const matches = content.match(timecodePattern);
	if (!matches || matches.length < 3) {
		console.warn(
			`⚠️ Subtitle may be invalid or corrupted: found ${matches?.length || 0} timecodes in ${path}`,
		);
		return false;
	}
	return true;
}
