#!/usr/bin/env bun
import { readdir, readFile, writeFile } from "node:fs/promises";
import path, { join, extname, parse, resolve } from "node:path";
import { existsSync } from "node:fs";
// Import the unlink function at the top of your file
import { unlink } from "node:fs/promises";
import { SubtitleProcessor } from "./subtitleProcessor";

// Simple CLI args parser
const args = process.argv.slice(2);
function getArg(name: string, fallback: string) {
	const prefix = `--${name}=`;
	const found = args.find((arg) => arg.startsWith(prefix));
	return resolve(found ? found.substring(prefix.length) : fallback);
}

const SUB_DIR = getArg("subs", "./");
const VIDEO_DIR = getArg("videos", "./");

const Regex_Shows = /^(?<title>.*?)S(?<season>\d{1,2})E(?<episode>\d{2,3}|\d)/i;
const Regex_Movies = /^(?<title>.+?)(?:\.|_)(?<year>(?:19|20)\d{2})/i;

function extractMeta(filename: string) {
	const showMatch = filename.match(Regex_Shows);
	if (showMatch?.groups) {
		return {
			type: "show",
			title: showMatch.groups.title?.toLowerCase().replace(/[\W_]+/g, ""),
			season: showMatch.groups.season,
			episode: showMatch.groups.episode,
		};
	}

	const movieMatch = filename.match(Regex_Movies);
	if (movieMatch?.groups) {
		return {
			type: "movie",
			title: movieMatch.groups.title?.toLowerCase().replace(/[\W_]+/g, ""),
			year: movieMatch.groups.year,
		};
	}

	return null;
}

/**
 * Safe rename function that works on exFAT drives
 * This copies the content instead of using the rename operation
 */
async function safeRename(oldPath: string, newPath: string): Promise<void> {
	try {
		// Read the original file
		const content = await readFile(oldPath);

		// Write to the new location
		await writeFile(newPath, content);

		// Verify the new file was written correctly
		if (existsSync(newPath)) {
			// Only delete the original after successful verification
			try {
				await unlink(oldPath);
			} catch (unlinkError) {
				console.warn(
					`Warning: Could not delete original file ${oldPath}. You may want to delete it manually.`,
				);
				// We don't throw here, as the operation essentially succeeded
			}
		} else {
			throw new Error(`Failed to verify new file at ${newPath}`);
		}
	} catch (error) {
		throw new Error(`Safe rename failed: ${error}`);
	}
}

async function processSubtitles() {
	console.log("📂 Reading subtitle and video directories...");
	const subtitleFiles = (await readdir(SUB_DIR))
		.filter(
			(f) => extname(f) === ".srt" && !f.startsWith("._") && !f.startsWith("."),
		)
		.sort((a, b) => a.localeCompare(b));
	const videoFiles = (await readdir(VIDEO_DIR))
		.filter(
			(f) =>
				[".mkv", ".mp4", ".avi"].includes(extname(f)) &&
				!f.startsWith("._") &&
				!f.startsWith("."),
		)
		.sort((a, b) => a.localeCompare(b));

	if (subtitleFiles.length === 0) {
		console.log("No subtitles found in the specified directory.");
		return;
	}
	if (videoFiles.length === 0) {
		console.log("No video files found in the specified directory.");
		return;
	}

	console.log(
		`Found ${subtitleFiles.length} subtitles and ${videoFiles.length} videos.`,
	);

	for (const sub of subtitleFiles) {
		const subMeta = extractMeta(sub);
		if (!subMeta) {
			console.warn(`⚠️ Skipping unmatched subtitle: ${sub}`);
			continue;
		}

		// find matching video file for this subtitle
		const match = videoFiles.find((vid) => {
			const vidMeta = extractMeta(vid);
			if (!vidMeta) return false;

			if (subMeta.type === "show" && vidMeta.type === "show") {
				return (
					vidMeta.title === subMeta.title &&
					vidMeta.season === subMeta.season &&
					vidMeta.episode === subMeta.episode
				);
			}

			if (subMeta.type === "movie" && vidMeta.type === "movie") {
				return vidMeta.title === subMeta.title && vidMeta.year === subMeta.year;
			}

			return false;
		});

		if (!match) {
			console.warn(`❌ No match found for subtitle: ${sub}`);
			continue;
		}

		const videoPath = join(VIDEO_DIR, match);
		const oldSubtitlePath = join(SUB_DIR, sub);
		const newSubtitleBase = parse(match).name;
		const newSubtitlePath = join(SUB_DIR, `${newSubtitleBase}.srt`);

		if (oldSubtitlePath !== newSubtitlePath) {
			console.log(`✏️ Renaming subtitle: ${sub} → ${newSubtitleBase}.srt`);
			// Use safe rename instead of the standard rename
			try {
				await safeRename(oldSubtitlePath, newSubtitlePath);
				console.log("✅ Rename completed safely");
			} catch (error) {
				console.error(`❌ Failed to rename: ${error}`);
				continue;
			}
		}

		// Continue with your SubtitleProcessor
		const processor = new SubtitleProcessor({
			videoPath: videoPath,
			subtitlePath: newSubtitlePath,
		});
		await processor.process();
	}
}

processSubtitles();

// // import { convertToUtf8 } from "./utf8subs";
// // import { mergeSubtitle } from "./mergeSubtitle";
// import { readdir, rename } from "node:fs/promises";
// import path, { join, extname, parse, resolve } from "node:path";
// // import { waitForFileToStabilize } from "./waitForFileToStabilize";
// // import { runCommand } from "./commandLine";
// import { SubtitleProcessor } from "./subtitleProcessor";

// // Simple CLI args parser
// const args = process.argv.slice(2);
// function getArg(name: string, fallback: string) {
// 	const prefix = `--${name}=`;
// 	const found = args.find((arg) => arg.startsWith(prefix));
// 	return resolve(found ? found.substring(prefix.length) : fallback);
// }

// const SUB_DIR = getArg("subs", "./");
// const VIDEO_DIR = getArg("videos", "./");

// const Regex_Shows = /^(?<title>.*?)S(?<season>\d{1,2})E(?<episode>\d{2,3}|\d)/i;
// const Regex_Movies = /^(?<title>.+?)(?:\.|_)(?<year>(?:19|20)\d{2})/i;

// function extractMeta(filename: string) {
// 	const showMatch = filename.match(Regex_Shows);
// 	if (showMatch?.groups) {
// 		return {
// 			type: "show",
// 			title: showMatch.groups.title?.toLowerCase().replace(/[\W_]+/g, ""),
// 			season: showMatch.groups.season,
// 			episode: showMatch.groups.episode,
// 		};
// 	}

// 	const movieMatch = filename.match(Regex_Movies);
// 	if (movieMatch?.groups) {
// 		return {
// 			type: "movie",
// 			title: movieMatch.groups.title?.toLowerCase().replace(/[\W_]+/g, ""),
// 			year: movieMatch.groups.year,
// 		};
// 	}

// 	return null;
// }

// async function processSubtitles() {
// 	console.log("📂 Reading subtitle and video directories...");
// 	const subtitleFiles = (await readdir(SUB_DIR))
// 		.filter(
// 			(f) => extname(f) === ".srt" && !f.startsWith("._") && !f.startsWith("."),
// 		)
// 		.sort((a, b) => a.localeCompare(b));
// 	const videoFiles = (await readdir(VIDEO_DIR))
// 		.filter(
// 			(f) =>
// 				[".mkv", ".mp4", ".avi"].includes(extname(f)) &&
// 				!f.startsWith("._") &&
// 				!f.startsWith("."),
// 		)
// 		.sort((a, b) => a.localeCompare(b));
// 	if (subtitleFiles.length === 0) {
// 		console.log("No subtitles found in the specified directory.");
// 		return;
// 	}
// 	if (videoFiles.length === 0) {
// 		console.log("No video files found in the specified directory.");
// 		return;
// 	}

// 	console.log(
// 		`Found ${subtitleFiles.length} subtitles and ${videoFiles.length} videos.`,
// 	);
// 	for (const sub of subtitleFiles) {
// 		const subMeta = extractMeta(sub);
// 		if (!subMeta) {
// 			console.warn(`⚠️ Skipping unmatched subtitle: ${sub}`);
// 			continue;
// 		}
// 		// find matching video file for this subtitle
// 		const match = videoFiles.find((vid) => {
// 			const vidMeta = extractMeta(vid);
// 			if (!vidMeta) return false;

// 			if (subMeta.type === "show" && vidMeta.type === "show") {
// 				return (
// 					vidMeta.title === subMeta.title &&
// 					vidMeta.season === subMeta.season &&
// 					vidMeta.episode === subMeta.episode
// 				);
// 			}

// 			if (subMeta.type === "movie" && vidMeta.type === "movie") {
// 				return vidMeta.title === subMeta.title && vidMeta.year === subMeta.year;
// 			}

// 			return false;
// 		});

// 		if (!match) {
// 			console.warn(`❌ No match found for subtitle: ${sub}`);
// 			continue;
// 		}

// 		const videoPath = join(VIDEO_DIR, match);
// 		const oldSubtitlePath = join(SUB_DIR, sub);
// 		const newSubtitleBase = parse(match).name;
// 		const newSubtitlePath = join(SUB_DIR, `${newSubtitleBase}.srt`);

// 		if (oldSubtitlePath !== newSubtitlePath) {
// 			console.log(`✏️ Renaming subtitle: ${sub} → ${newSubtitleBase}.srt`);
// 			await rename(oldSubtitlePath, newSubtitlePath);
// 		}

// 		const processor = new SubtitleProcessor({
// 			videoPath: videoPath,
// 			subtitlePath: newSubtitlePath,
// 		});
// 		await processor.process();
// 		// try {

// 		// 	console.log(`\n🎬 Processing "${newSubtitleBase}"...`);
// 		// 	console.log("🔤 Converting subtitle to UTF-8...");
// 		// 	await convertToUtf8(newSubtitlePath);
// 		// 	console.log("✅ Conversion done!");
// 		// 	console.log("⌛ Waiting for file to stabilize...");
// 		// 	await waitForFileToStabilize(newSubtitlePath);
// 		// 	console.log("📁 File is stable!. Waiting 8s to be sure");
// 		// 	await new Promise((r) => setTimeout(r, 8000)); // 👈 delay
// 		// 	console.log("🧹 Cleaning ads from subtitle...");
// 		// 	await runCommand("subcleaner.py", [newSubtitlePath]);
// 		// 	console.log("✅ Cleaning done!");
// 		// 	console.log("⌛ Waiting for file to stabilize...");
// 		// 	await waitForFileToStabilize(newSubtitlePath);
// 		// 	console.log("📁 File is stable!. Waiting 8s to be sure");
// 		// 	await new Promise((r) => setTimeout(r, 8000)); // 👈 delay
// 		// 	console.log("🕓 Syncing subtitle with video...");
// 		// 	await runCommand("ffsubsync", [
// 		// 		videoPath,
// 		// 		"-i",
// 		// 		newSubtitlePath,
// 		// 		"-o",
// 		// 		newSubtitlePath,
// 		// 	]);
// 		// 	console.log("✅ Syncing done!");
// 		// 	console.log("🎞️ Merging subtitle into video...");
// 		// 	await mergeSubtitle({
// 		// 		videoPath,
// 		// 		subtitlePath: newSubtitlePath,
// 		// 		language: "fa",
// 		// 		title: "Farsi",
// 		// 	});
// 		// 	console.log("🎥 Merging done!");
// 		// 	console.log(`✅ Processed: ${newSubtitleBase}`);
// 		// } catch (err) {
// 		// 	console.error(
// 		// 		`❌ Error processing ${newSubtitleBase}:`,
// 		// 		(err as Error).message,
// 		// 	);
// 		// }
// 	}
// }
// processSubtitles();
