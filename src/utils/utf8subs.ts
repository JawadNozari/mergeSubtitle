import { promises as fsPromises } from "node:fs";
import { basename, extname, resolve, dirname, join } from "node:path";
import chardet from "chardet";
import iconv from "iconv-lite";
import * as color from "./consoleColors";
export async function convertToUtf8(filePath: string): Promise<boolean> {
	const resolvedPath = resolve(filePath);
	const ext = extname(resolvedPath).toLowerCase();

	if (![".srt"].includes(ext)) {
		throw new Error(`Unsupported subtitle extension: ${ext}`);
	}

	try {
		let fileBuffer: Buffer;
		try {
			fileBuffer = await fsPromises.readFile(resolvedPath);
		} catch (readError) {
			console.error(`Failed to read file: ${readError}`);
			return false;
		}

		if (!fileBuffer.length) {
			console.error(`File is empty: ${resolvedPath}`);
			return false;
		}

		const detectedEncoding = chardet.detect(fileBuffer) || "utf-8";
		const isUtf8 = detectedEncoding.toLowerCase() === "utf-8";
		const fileName = basename(resolvedPath);

		if (isUtf8) {
			console.log(`✅ ${color.GRAY}${fileName}${color.RESET} is already UTF-8`);
			return true;
		}

		console.log(
			`🔄 Converting ${color.GRAY}${fileName}${color.RESET} from ${color.PINK}${detectedEncoding}${color.RESET} to UTF-8...`,
		);
		const decoded = iconv.decode(fileBuffer, detectedEncoding);
		const dirPath = dirname(resolvedPath);
		const newFilePath = join(dirPath, `${basename(resolvedPath, ext)}${ext}`);
		try {
			await fsPromises.writeFile(newFilePath, decoded, { encoding: "utf8" });
		} catch (writeError) {
			console.error(`Failed to write converted file: ${writeError}`);
			return false;
		}
		try {
			const stats = await fsPromises.stat(newFilePath);
			if (stats.size === 0) {
				console.error("Conversion resulted in empty file");
				await fsPromises.unlink(newFilePath).catch(() => {});
				return false;
			}

			console.log(
				`✅ Successfully converted ${color.GRAY}${fileName}${color.RESET} to UTF-8`,
			);
			return true;
		} catch (verifyError) {
			console.error(
				`Failed to verify the converted file: ${color.RED}${verifyError}${color.RESET}`,
			);
			return false;
		}
	} catch (error) {
		console.error(`Unexpected error during conversion: ${error}`);
		return false;
	}
}
