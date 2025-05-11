#!/usr/bin/env bun

import { existsSync } from "node:fs";
import { unlink } from "node:fs/promises";
import * as color from "./utils/consoleColors";
import { AdjustFlags } from "./utils/adjustFlags";
import { SubtitleProcessor } from "./utils/subtitleProcessor";
import path, { join, extname, parse, resolve } from "node:path";
import { readdir, readFile, writeFile } from "node:fs/promises";

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
// get language from args
const subLang = args.find((arg) => arg.startsWith("--subLang="));
const audioLang = args.find((arg) => arg.startsWith("--audioLang="));
if (!subLang || !audioLang)
	throw new Error(
		"❌ Language not specified. Use --subLang=<language> --audioLang=<language>",
	);

const subLanguage = subLang.split("=")[1] || "English";
const audioLanguage = audioLang.split("=")[1] || "English";
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

async function safeRename(oldPath: string, newPath: string): Promise<void> {
	try {
		const content = await readFile(oldPath);
		await writeFile(newPath, content);

		if (existsSync(newPath)) {
			try {
				await unlink(oldPath);
			} catch (unlinkError) {
				console.warn(
					`Warning: Could not delete original file ${oldPath}. You may want to delete it manually.`,
				);
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
		// biome-ignore lint/style/useTemplate: <explanation>
		"🛠️  Options:\n" +
			`subtitle Language= ${color.GREEN}${subLanguage}${color.RESET}\n` +
			`audio Language=    ${color.GREEN}${audioLanguage}${color.RESET}\n` +
			`disableSync:       ${color.BLUE}${disableSync}${color.RESET}\n` +
			`disableConvert=    ${color.BLUE}${disableConvert}${color.RESET}\n` +
			`disableClean=      ${color.BLUE}${disableClean}${color.RESET}\n` +
			`keepSubtitle=      ${color.BLUE}${keepSubtitle}${color.RESET}`,
	);
	if (command && commandList.includes(command)) {
		const commands: Record<string, () => Promise<void>> = {
			async help() {
				console.log("Available options:");
				console.log(
					"--adjustFlags: Adjust flags for video files. default Subtitle and Audio language is English",
				);
				console.log(
					"example: mergeSubtitle --adjustFlags --subLang=Persian --audioLang=English",
				);
				console.log(
					"--removeSubtitle: Removes subtitles with a specific language from video files. Must pass --subLang=<language>",
				);
				console.log(
					"example: mergeSubtitle --removeSubtitle --subLang=Persian",
				);
			},

			async adjustFlags() {
				const VideoFiles = await readdir(VIDEO_DIR);
				// sort the files
				VideoFiles.sort((a, b) => a.localeCompare(b));

				for (const file of VideoFiles) {
					console.log("-".repeat(50));

					const filePath = join(VIDEO_DIR, file);
					if (
						extname(file) === ".mkv" &&
						existsSync(filePath) &&
						!file.startsWith("._")
					) {
						console.log(
							`🔄 Processing file: ${color.GRAY}${path.basename(file)}${color.RESET}`,
						);
						const adjustFlags = new AdjustFlags({
							videoPath: parse(filePath).base,
							subLang: subLanguage,
							audioLang: audioLanguage,
						});
						await adjustFlags.adjustFlags();
					}
				}
				process.exit(0);
			},

			async removeSubtitle() {
				// get language from args
				const subLang = args.find((arg) => arg.startsWith("--subLang="));
				if (!subLang)
					throw new Error("❌ Language not specified. Use --lang=<language>");

				const langName = subLang.split("=")[1];
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
			subtitleLang: subLanguage,
			audioLang: audioLanguage,
			keepSubtitle: keepSubtitle,
			shouldConvert: !disableConvert,
			shouldClean: !disableClean,
			shouldSync: !disableSync,
		});
		await processor.process();
	}
}

processSubtitles();
