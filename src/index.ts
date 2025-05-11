#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { AdjustFlags } from "./utils/adjustFlags";
import path, { join, extname, parse, resolve } from "node:path";
import { SubtitleProcessor } from "./utils/subtitleProcessor";
import { readdir, readFile, writeFile } from "node:fs/promises";
import * as color from "./utils/consoleColors";
import { env } from "node:process";

// Simple CLI args parser
const args = process.argv.slice(2);
function getArg(name: string, fallback: string) {
	const prefix = `--${name}=`;
	const found = args.find((arg) => arg.startsWith(prefix));
	return resolve(found ? found.substring(prefix.length) : fallback);
}
// Extract the command flag like --adjustFlags or --convertUtf8
const command = args.find((arg) => arg.startsWith("--"))?.replace(/^--/, "");
const commandList = ["adjustFlags", "removeSubtitle"];

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
	// get --option=disable [sync, convert, clean]
	const disableSync = !!args.find((arg) => arg.startsWith("--disableSync"));
	const disableConvert = !!args.find((arg) =>
		arg.startsWith("--disableConvert"),
	);
	const disableClean = !!args.find((arg) => arg.startsWith("--disableClean"));
	const keepSubtitle = !!args.find((arg) => arg.startsWith("--keepSubtitle"));
	console.debug(
		`🛠️  Options: disableSync=${disableSync}, disableConvert=${disableConvert}, disableClean=${disableClean}, keepSubtitle=${keepSubtitle}`,
	);
	if (command && commandList.includes(command)) {
		const commands: Record<string, () => Promise<void>> = {
			async help() {
				console.log("Available options:");
				console.log("--convertUtf8: Convert all subtitles to UTF-8");
				console.log("--merge: Merge subtitles with videos");
				console.log("--adjustFlags: Adjust flags for video files");
			},

			async adjustFlags() {
				const VideoFiles = await readdir(VIDEO_DIR);
				// sort the files
				VideoFiles.sort((a, b) => a.localeCompare(b));

				for (const file of VideoFiles) {
					console.log("-".repeat(50));
					console.log(
						`🔄 Processing file: ${color.GRAY}${path.basename(file)}${color.RESET}`,
					);
					const filePath = join(VIDEO_DIR, file);
					if (
						extname(file) === ".mkv" &&
						existsSync(filePath) &&
						!file.startsWith("._")
					) {
						const adjustFlags = new AdjustFlags({
							videoPath: parse(filePath).base,
							subLang: "Persian",
							audioLang: "English",
						});
						await adjustFlags.adjustFlags();
					}
				}
				process.exit(0);
			},

			async removeSubtitle() {
				// get language from args
				const lang = args.find((arg) => arg.startsWith("--lang="));
				if (!lang) {
					console.error("❌ Language not specified. Use --lang=<language>");
					process.exit(1);
				}

				const langName = lang.split("=")[1];
				const VideoFiles = await readdir(VIDEO_DIR);
				console.log(
					`This will remove all subtitles with the language "${langName}" from all video files in ${VIDEO_DIR}`,
				);
				// sort the files

				VideoFiles.sort((a, b) => a.localeCompare(b));

				for (const file of VideoFiles) {
					console.log("-".repeat(50));
					console.log(
						`🔄 Processing file: ${color.GRAY}${path.basename(file)}${color.RESET}`,
					);
					const filePath = join(VIDEO_DIR, file);
					if (
						extname(file) === ".mkv" &&
						existsSync(filePath) &&
						!file.startsWith("._")
					) {
						if (langName) {
							const SubtitleProcessorInstance = new SubtitleProcessor({
								videoPath: filePath,
								subtitlePath: "",
								subtitleLang: "",
								audioLang: "",
							});
							await SubtitleProcessorInstance.removeSubtitleByLanguage(
								filePath,
								langName,
							);
						} else {
							console.error("❌ Language name is undefined.");
						}
					}
				}
				process.exit(0);
			},
		};

		const fn = command ? commands[command] : undefined;
		if (!fn) {
			console.error(`❌ Unknown command: --${command}`);
			return;
		}
		fn()
			.then(() => {
				console.log(`✅ Finished --${command}`);
				// exit gracefully so process doesn't continue
				// process.exit(0);
			})
			// biome-ignore lint/suspicious/noExplicitAny: <explanation>
			.catch((err: any) => {
				console.error(`❌ Error while running --${command}:`, err);
				process.exit(1);
			})
			.finally(() => {
				// exit gracefully so process doesn't continue
				process.exit(0);
			});
		return;
	}
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
		console.log("⚠️ No subtitles found in the specified directory.");
		return;
	}
	if (videoFiles.length === 0) {
		console.log("⚠️ No video files found in the specified directory.");
		return;
	}

	for (const sub of subtitleFiles) {
		const subMeta = extractMeta(sub);
		if (!subMeta) {
			console.warn(`⚠️ Skipping unmatched subtitle: ${sub}`);
			continue;
		}

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
			console.warn(
				`❌ No match found for subtitle: ${color.GRAY}${sub}${color.RESET}`,
			);
			continue;
		}

		const videoPath = join(VIDEO_DIR, match);
		const oldSubtitlePath = join(SUB_DIR, sub);
		const newSubtitleBase = parse(match).name;
		const newSubtitlePath = join(SUB_DIR, `${newSubtitleBase}.srt`);

		if (oldSubtitlePath !== newSubtitlePath) {
			console.log(`✏️  Renaming subtitle: ${sub} → ${newSubtitleBase}.srt`);
			// Use safe rename instead of the standard rename
			try {
				await safeRename(oldSubtitlePath, newSubtitlePath);
			} catch (error) {
				console.error(`❌ Failed to rename: ${error}`);
				continue;
			}
		}

		// Continue with your SubtitleProcessor
		const processor = new SubtitleProcessor({
			videoPath: videoPath,
			subtitlePath: newSubtitlePath,
			subtitleLang: "Persian",
			audioLang: "English",
			keepSubtitle: keepSubtitle,
			shouldConvert: !disableConvert,
			shouldClean: !disableClean,
			shouldSync: !disableSync,
		});
		await processor.process();
	}
}

processSubtitles();
