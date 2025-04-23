import path, { parse } from "node:path";
import { runCommand } from "./commandLine";
import { convertToUtf8 } from "./utf8subs";
import { execSync } from "node:child_process";
import { mergeSubtitle } from "./mergeSubtitle";
import { verifySubtitle } from "./verifySubtitle";
import { waitForFileToStabilize } from "./waitForFileToStabilize";
type SubtitleProcessorOptions = {
	videoPath: string;
	subtitlePath: string;
	maxRetries?: number;
};
interface SubtitleTrack {
	id: number;
	language: string;
	isDefault: boolean;
	isForced: boolean;
	name?: string;
}

export class SubtitleProcessor {
	private readonly videoPath: string;
	private readonly subtitlePath: string;
	private readonly subtitleBase: string;
	private readonly maxRetries: number;

	constructor({
		videoPath,
		subtitlePath,
		maxRetries = 3,
	}: SubtitleProcessorOptions) {
		this.videoPath = videoPath;
		this.subtitlePath = subtitlePath;
		this.subtitleBase = path.basename(subtitlePath);
		this.maxRetries = maxRetries;
	}

	async process() {
		console.log(`\n🎬 Processing "${this.subtitleBase}"...`);

		const Converted = await this.convertSubToUtf8();
		if (!Converted) {
			console.error("❌ Conversion failed. Skipping subtitle.");
			return;
		}

		const Cleaned = await this.cleanAds();
		if (!Cleaned) {
			console.error("❌ Cleaning failed. Skipping subtitle.");
			return;
		}

		const Synced = await this.syncWithVideo();
		if (!Synced) {
			console.error("❌ Syncing failed. Skipping subtitle.");
			return;
		}

		await this.merge();
		console.log("✅ Merging done.");

		// await this.adjustSubtitleFlags();
		// console.log(`✅ Processed: ${this.subtitleBase}`);
	}
	/**
	 * Gets detailed information about subtitle tracks in an MKV file
	 * @param videoPath Path to the MKV file
	 * @returns Array of subtitle track information
	 */
	private async getSubtitleTracksInfo(): Promise<SubtitleTrack[]> {
		try {
			// Use mkvmerge with JSON output to get detailed track information
			const jsonOutput = await execSync(
				`mkvmerge -J "${this.videoPath}"`,
			).toString();
			const videoInfo = JSON.parse(jsonOutput);

			const subtitleTracks: SubtitleTrack[] = [];

			for (const track of videoInfo.tracks) {
				if (track.type === "subtitles") {
					subtitleTracks.push({
						id: track.id,
						language: track.properties.language || "und", // 'und' is used for undefined language
						isDefault: !!track.properties.default_track,
						isForced: !!track.properties.forced_track,
						name: track.properties.track_name,
					});
				}
			}

			return subtitleTracks;
		} catch (error) {
			console.error(`Error getting subtitle information: ${error}`);
			return [];
		}
	}
	/**
	 * Removes English subtitles and makes specified language subtitle the default and forced one
	 * @param videoPath Path to the MKV video file
	 * @param subtitleLanguage Language code of your subtitle (e.g., "fa" for Farsi)
	 * @param removeEnglish Whether to remove English subtitles (default: true)
	 * @returns Promise<boolean> Success status
	 */
	private async adjustSubtitleFlags(): Promise<boolean> {
		console.log("📁 Adjusting subtitle flags...");
		try {
			const videoInfo = parse(this.videoPath);
			console.log(`📊 Analyzing subtitle tracks for ${videoInfo.base}...`);
			// Get detailed subtitle track information
			const subtitleTracks = await this.getSubtitleTracksInfo();
			if (subtitleTracks.length === 0) {
				console.log("⚠️ No subtitle tracks found in the video file.");
				return false;
			}
			console.log(`Found ${subtitleTracks.length} subtitle tracks:`);
			for (const sub of subtitleTracks) {
				if (
					sub.language.toLowerCase() !== "fa" ||
					sub.language.toLowerCase() !== "per"
				) {
					const args = [
						`"${this.videoPath}"`,
						"--edit",
						`track:${sub.id}`,
						"--set",
						"flag-default=0",
						"--set",
						"flag-forced=0",
					];
					await runCommand("mkvpropedit", args);
				}
			}
			console.log("✅ Successfully set subtitle flags!");
			return true;
		} catch (error) {
			console.error(`❌ Error adjusting subtitle flags: ${error}`);
			return false;
		}
	}

	private async convertSubToUtf8(): Promise<boolean> {
		if (this.subtitleBase.startsWith("._")) {
			throw new Error(
				`Skipping Apple resource fork file: ${this.subtitleBase}`,
			);
		}
		try {
			await convertToUtf8(this.subtitlePath);

			console.log("✅ UTF-8 conversion done.");
			await verifySubtitle(this.subtitlePath);
			console.log("✅ Subtitle verified.");
			// await this.waitStabilization();
			return true;
		} catch (error) {
			console.error("❌ UTF-8 conversion failed:", error);
			return false;
		}
	}

	private async cleanAds(): Promise<boolean> {
		console.log("🧹 Cleaning ads from subtitle...");
		return await runCommand("subcleaner.py", [this.subtitlePath])
			.then(() => {
				verifySubtitle(this.subtitlePath);
				console.log("✅ Ad cleaning done.");
				console.log("✅ Subtitle verified.");
				// this.waitStabilization();
				return true;
			})
			.catch((err) => {
				console.error("❌ Ad cleaning failed:", err);
				return false;
			});
	}

	private async syncWithVideo(): Promise<boolean> {
		console.log("🕓 Syncing subtitle with video...");
		return await runCommand("ffsubsync", [
			this.videoPath,
			"-i",
			this.subtitlePath,
			"-o",
			this.subtitlePath,
		])
			.then(() => {
				console.log("✅ Subtitle synced.");
				verifySubtitle(this.subtitlePath);
				console.log("✅ Subtitle verified.");
				return true;
			})
			.catch((err) => {
				console.error("❌ Subtitle syncing failed:", err);
				return false;
			});
	}

	private async merge() {
		console.log("🎞️ Merging subtitle into video...");
		await mergeSubtitle({
			videoPath: this.videoPath,
			subtitlePath: this.subtitlePath,
			language: "fa",
			title: "Farsi",
		});
		console.log("✅ Merging done.");
	}

	private async waitStabilization() {
		console.log("⌛ Waiting for file to stabilize...");
		await waitForFileToStabilize(this.subtitlePath);
		console.log("📁 File is stable. Waiting extra 8s just in case...");
		await this.delay(3000); // 👈 delay
	}

	private delay(ms: number) {
		return new Promise((res) => setTimeout(res, ms));
	}
}
