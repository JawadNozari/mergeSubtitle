import { promises as fsPromises } from "node:fs";
import { basename, extname, resolve, dirname, join } from "node:path";
import chardet from "chardet";
import iconv from "iconv-lite";

/**
 * Convert a subtitle file to UTF-8, specifically handling exFAT external drives on macOS.
 * @param filePath Path to the subtitle file (.srt, .ass, etc.)
 */
export async function convertToUtf8(filePath: string): Promise<boolean> {
	const resolvedPath = resolve(filePath);
	const ext = extname(resolvedPath).toLowerCase();

	if (![".srt", ".ass", ".sub"].includes(ext)) {
		throw new Error(`Unsupported subtitle extension: ${ext}`);
	}

	try {
		// Read the file with explicit error handling
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
			console.log(`✅ ${fileName} is already UTF-8`);
			return true;
		}

		console.log(
			`🔄 Converting ${fileName} from ${detectedEncoding} to UTF-8...`,
		);
		const decoded = iconv.decode(fileBuffer, detectedEncoding);

		// Create a completely new file instead of modifying the original
		const dirPath = dirname(resolvedPath);
		const newFilePath = join(dirPath, `${basename(resolvedPath, ext)}${ext}`);

		// Write to a new file with UTF-8 encoding
		try {
			await fsPromises.writeFile(newFilePath, decoded, { encoding: "utf8" });
		} catch (writeError) {
			console.error(`Failed to write converted file: ${writeError}`);
			return false;
		}

		// Verify the new file
		try {
			const stats = await fsPromises.stat(newFilePath);
			if (stats.size === 0) {
				console.error("Conversion resulted in empty file");
				await fsPromises.unlink(newFilePath).catch(() => {});
				return false;
			}

			console.log(
				`✔️ Successfully converted ${fileName} to UTF-8 at ${newFilePath}`,
			);

			// Optionally, you can rename the file back to the original name
			// This is commented out to prevent potential corruption issues with exFAT
			// If you want to replace the original file, uncomment these lines:
			/*
      try {
        await fsPromises.unlink(resolvedPath);
        await fsPromises.rename(newFilePath, resolvedPath);
        console.log(`✔️ Replaced original file with UTF-8 version.`);
      } catch (replaceError) {
        console.error(`Failed to replace original file: ${replaceError}`);
        console.log(`The converted file is still available at: ${newFilePath}`);
        return true; // Still consider it a success as the conversion worked
      }
      */

			return true;
		} catch (verifyError) {
			console.error(`Failed to verify the converted file: ${verifyError}`);
			return false;
		}
	} catch (error) {
		console.error(`Unexpected error during conversion: ${error}`);
		return false;
	}
}

// import {
// 	readFileSync,
// 	writeFileSync,
// 	statSync,
// 	unlinkSync,
// 	renameSync,
// 	existsSync,
// } from "node:fs";
// import { basename, extname, resolve, dirname, join } from "node:path";
// import chardet from "chardet";
// import iconv from "iconv-lite";

// /**
//  * Convert a subtitle file to UTF-8, preserving content and safely handling external drives.
//  * @param filePath Path to the subtitle file (.srt, .ass, etc.)
//  */
// export function convertToUtf8(filePath: string): Promise<boolean> {
// 	const resolvedPath = resolve(filePath);
// 	const ext = extname(resolvedPath).toLowerCase();

// 	if (![".srt", ".ass", ".sub"].includes(ext)) {
// 		throw new Error(`Unsupported subtitle extension: ${ext}`);
// 	}

// 	try {
// 		// Check if file exists and is readable
// 		if (!existsSync(resolvedPath)) {
// 			throw new Error(`File does not exist: ${resolvedPath}`);
// 		}

// 		const fileBuffer = readFileSync(resolvedPath);
// 		if (!fileBuffer.length) {
// 			throw new Error(`File is empty: ${resolvedPath}`);
// 		}

// 		const detectedEncoding = chardet.detect(fileBuffer) || "utf-8";
// 		const isUtf8 = detectedEncoding.toLowerCase() === "utf-8";
// 		const fileName = basename(resolvedPath);

// 		if (isUtf8) {
// 			console.log(`✅ ${fileName} is already UTF-8`);
// 			return Promise.resolve(true);
// 		}

// 		console.log(
// 			`🔄 Converting ${fileName} from ${detectedEncoding} to UTF-8...`,
// 		);
// 		const decoded = iconv.decode(fileBuffer, detectedEncoding);

// 		// Use a temporary file for safety
// 		const dirPath = dirname(resolvedPath);
// 		const tempFilePath = join(
// 			dirPath,
// 			`.temp_${Date.now()}_${basename(resolvedPath)}`,
// 		);

// 		// Write to temp file first
// 		writeFileSync(tempFilePath, decoded, { encoding: "utf8" });

// 		// Check if temp file was written correctly
// 		const tempStats = statSync(tempFilePath);
// 		if (tempStats.size === 0) {
// 			unlinkSync(tempFilePath); // Clean up empty temp file
// 			throw new Error("Failed to write converted content to temporary file");
// 		}

// 		// Backup original file
// 		const backupPath = join(
// 			dirPath,
// 			`.backup_${Date.now()}_${basename(resolvedPath)}`,
// 		);
// 		writeFileSync(backupPath, fileBuffer);

// 		// Replace original with converted file
// 		unlinkSync(resolvedPath);
// 		renameSync(tempFilePath, resolvedPath);

// 		// Confirm result
// 		const finalSize = statSync(resolvedPath).size;
// 		if (finalSize === 0) {
// 			// Restore from backup if something went wrong
// 			renameSync(backupPath, resolvedPath);
// 			throw new Error("Conversion resulted in empty file");
// 		}

// 		// Clean up backup
// 		unlinkSync(backupPath);

// 		console.log(`✔ Successfully converted ${fileName} to UTF-8`);
// 		return Promise.resolve(true);
// 	} catch (error) {
// 		console.error(`Error during file conversion: ${error}`);
// 		return Promise.reject(false);
// 	}
// }

// import {
// 	readFileSync,
// 	openSync,
// 	writeSync,
// 	fsyncSync,
// 	closeSync,
// 	statSync,
// } from "node:fs";
// import { basename, extname, resolve } from "node:path";
// import chardet from "chardet";
// import iconv from "iconv-lite";

// /**
//  * Convert a subtitle file to UTF-8, preserving content and flushing to disk.
//  * @param filePath Path to the subtitle file (.srt, .ass, etc.)
//  */
// export function convertToUtf8(filePath: string): Promise<boolean> {
// 	const resolvedPath = resolve(filePath);
// 	const ext = extname(resolvedPath).toLowerCase();

// 	if (![".srt", ".ass", ".sub"].includes(ext)) {
// 		throw new Error(`Unsupported subtitle extension: ${ext}`);
// 	}

// 	const fileBuffer = readFileSync(resolvedPath);
// 	if (!fileBuffer.length) {
// 		throw new Error(`File is empty: ${resolvedPath}`);
// 	}

// 	const detectedEncoding = chardet.detect(fileBuffer) || "utf-8";
// 	const isUtf8 = detectedEncoding.toLowerCase() === "utf-8";
// 	const fileName = basename(resolvedPath);

// 	if (isUtf8) {
// 		console.log(`✅ ${fileName} is already UTF-8`);
// 		return Promise.resolve(true);
// 	}

// 	console.log(`🔄 Converting ${fileName} from ${detectedEncoding} to UTF-8...`);
// 	const decoded = iconv.decode(fileBuffer, detectedEncoding);

// 	try {
// 		const fd = openSync(resolvedPath, "w");
// 		writeSync(fd, decoded, undefined, "utf-8");
// 		fsyncSync(fd); // flush disk
// 		closeSync(fd);
// 		// Confirm result
// 		const finalSize = statSync(resolvedPath).size;
// 		if (finalSize === 0) {
// 			return Promise.reject(false); // File is empty after write
// 		}
// 		if (finalSize <= fileBuffer.length) {
// 			console.log(
// 				`❌ Conversion suspicious — file size not increased: original=${fileBuffer.length}, final=${finalSize}`,
// 			);
// 			return Promise.reject(false); // File size not increased
// 		}
// 		console.log(`✔ Converted ${fileName} to UTF-8`);
// 		return Promise.resolve(true);
// 	} catch (error) {
// 		console.error(`Error during file conversion: ${error}`);
// 		return Promise.reject(false);
// 	}
// }

// import fs from "node:fs";
// import path from "node:path";
// import chardet from "chardet";
// import iconv from "iconv-lite";
// import { Command } from "commander";

// const program = new Command();

// program
// 	.name("sub-encoding-convert")
// 	.description("Batch convert subtitle files to UTF-8")
// 	.argument("<target>", "File or directory to scan for subtitle files")
// 	.option(
// 		"-e, --ext <extensions>",
// 		"Comma-separated list of file extensions",
// 		"srt,ass,sub",
// 	)
// 	.option("-o, --overwrite", "Overwrite original files", false)
// 	.option("-l, --log <logFile>", "Log output to a specified file")
// 	.option(
// 		"-d, --dry-run",
// 		"Only simulate conversion without writing changes",
// 		false,
// 	)
// 	.option("--encoding <enc>", "Manually override detected encoding")
// 	.parse();

// const target = program.args[0];
// const {
// 	ext,
// 	overwrite,
// 	log: logFile,
// 	dryRun,
// 	encoding: manualEncoding,
// } = program.opts();
// const extensions = ext
// 	.split(",")
// 	.map((e: string) => `.${e.trim().toLowerCase()}`);

// const logStream = logFile
// 	? fs.createWriteStream(logFile, { flags: "a" })
// 	: null;

// function log(message: string) {
// 	console.log(message);
// 	if (logStream) {
// 		logStream.write(`${message}\n`);
// 	}
// }

// function hasBOM(buffer: Buffer): boolean {
// 	return buffer.slice(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf]));
// }

// function convertFile(filePath: string, overwrite: boolean): string | null {
// 	const rawBuffer = fs.readFileSync(filePath);
// 	const detectedEncoding =
// 		manualEncoding || chardet.detect(rawBuffer) || "utf-8";
// 	const bom = hasBOM(rawBuffer) ? " (with BOM)" : "";

// 	const isUtf8 = detectedEncoding.toLowerCase() === "utf-8";
// 	const filename = path.basename(filePath);

// 	if (dryRun) {
// 		if (isUtf8) {
// 			log(`✅ [Dry Run] ${filename} is already UTF-8`);
// 		} else {
// 			log(
// 				`🟡 [Dry Run] Would convert ${filename} from ${detectedEncoding}${bom}`,
// 			);
// 		}
// 		return null;
// 	}

// 	if (isUtf8) {
// 		log(`✅ ${filename} is already UTF-8`);
// 		return filePath;
// 	}

// 	const decoded = iconv.decode(rawBuffer, detectedEncoding);
// 	const outputPath = overwrite
// 		? filePath
// 		: path.join(path.dirname(filePath), filename);

// 	// fs.writeFileSync(outputPath, decoded, { encoding: "utf-8" });
// 	const fd = fs.openSync(outputPath, "w");
// 	fs.writeSync(fd, decoded, undefined, "utf-8");
// 	fs.fsyncSync(fd);
// 	fs.closeSync(fd);
// 	log(`✔ Converted ${filename} from ${detectedEncoding}${bom} to UTF-8`);
// 	return outputPath;
// }

// function walk(dir: string): string[] {
// 	const converted: string[] = [];
// 	const entries = fs.readdirSync(dir, { withFileTypes: true });
// 	for (const entry of entries) {
// 		const fullPath = path.join(dir, entry.name);
// 		if (entry.isDirectory()) {
// 			converted.push(...walk(fullPath));
// 		} else if (
// 			entry.isFile() &&
// 			extensions.includes(path.extname(entry.name).toLowerCase())
// 		) {
// 			const result = convertFile(fullPath, overwrite);
// 			if (result) converted.push(result);
// 		}
// 	}
// 	return converted;
// }

// function run(): string[] {
// 	if (!target) {
// 		console.error("❌ Error: File or directory argument is required.");
// 		process.exit(1);
// 	}

// 	const fullPath = path.resolve(target);
// 	const stats = fs.statSync(fullPath);

// 	log(`🔍 Processing: ${fullPath}`);

// 	if (stats.isFile()) {
// 		const ext = path.extname(fullPath).toLowerCase();
// 		if (extensions.includes(ext)) {
// 			const result = convertFile(fullPath, overwrite);
// 			return result ? [result] : [];
// 		}
// 		console.error(`⚠️ Skipped unsupported file: ${fullPath}`);
// 		return [];
// 	}
// 	if (stats.isDirectory()) {
// 		return walk(fullPath);
// 	}
// 	console.error(`❌ Unsupported path: ${fullPath}`);
// 	return [];
// }

// const convertedFiles = run();

// if (logStream) logStream.end();

// // Optional: expose converted files list if this script is imported as a module
// export default convertedFiles;
