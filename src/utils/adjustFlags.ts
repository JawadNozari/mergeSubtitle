import type { MKVMetadata } from "./types";
import {
	getLanguageCodes,
	type LanguageName,
	type LanguageCode,
} from "./languageCodes";
import { parse, type ParsedPath } from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { runCommand } from "./commandLine";
import { execSync } from "node:child_process";
import * as color from "./consoleColors";
const execPromise = promisify(exec);

type options = [subLang: LanguageName, audioLang: LanguageName];
type TrackType = "audio" | "subtitles" | "video";
export class AdjustFlags {
	private readonly videoPath: string;
	private readonly subLang: LanguageName;
	private readonly audioLang: LanguageName;

	constructor({
		videoPath,
		subLang,
		audioLang,
	}: { videoPath: string; subLang: LanguageName; audioLang: LanguageName }) {
		this.videoPath = videoPath;
		this.subLang = subLang;
		this.audioLang = audioLang;
	}
	async adjustFlags() {
		await this.adjustAudioFlags();
		await this.adjustSubtitleFlags();
		return true;
		// return Promise.all([this.adjustAudioFlags(), this.adjustSubtitleFlags()]);
	}

	async getMKVmetadata(): Promise<MKVMetadata> {
		const path = parse(this.videoPath).base;
		const { stdout } = await execPromise(`mkvmerge -J "${path}"`);
		// Replace all "uid": 1234567890 with "uid": "1234567890" beacause of json 64bit limitations
		const patched = stdout.replace(/"uid"\s*:\s*(\d+)/g, `"uid": "$1"`);
		const metadata = JSON.parse(patched);
		return metadata;
	}

	private async getTracks(query: TrackType) {
		const info = await this.getMKVmetadata().then((info) =>
			info.tracks.filter((t) => t.type === query),
		);
		return info;
	}

	async resolveTrackIdByUid(uid: number): Promise<number | undefined> {
		const metadata = await this.getMKVmetadata(); // or run mkvmerge -J directly
		const track = metadata.tracks.find((t) => t.properties.uid === uid);
		return track?.id;
	}
	async verifyFlags(trackUId: number): Promise<boolean> {
		try {
			// Run mkvmerge with -J (JSON output) to get the track details
			const Output = await this.getMKVmetadata();

			// Find the track by trackId (we assume you have an array of tracks)
			const track = Output.tracks.find(
				(t: { properties: { uid: number } }) => t.properties.uid === trackUId,
			);

			if (!track) {
				console.log(`⚠️ Track with ID ${trackUId} not found in the file.`);
				return false;
			}

			// Check the flags for the track
			const isDefaultTrack = track.properties.default_track === true;
			const isForcedTrack = track.properties.forced_track === true;

			if (isDefaultTrack && isForcedTrack) {
				console.log(
					`✅ Flags for track ${color.PINK}${trackUId}${color.RESET} are correctly set as default & forced.`,
				);
				return true;
			}
			console.log(`⚠️ Flags for track ${trackUId} are not correctly set.`);
			console.log(`- Default Track: ${isDefaultTrack ? "Yes" : "No"}`);
			console.log(`- Forced Track: ${isForcedTrack ? "Yes" : "No"}`);
			return false;
		} catch (error) {
			console.error(`❌ Error verifying flags for track ${trackUId}: ${error}`);
			return false;
		}
	}
	private async editVideo(
		trackUid: number,
		flagDefault: boolean,
		flagForced: boolean,
		name: string,
	) {
		const trackId = await this.resolveTrackIdByUid(trackUid);
		if (trackId === undefined) {
			throw new Error(`❌ Could not resolve track ID for UID: ${trackUid}`);
		}
		const defaulted = flagDefault ? "1" : "0";
		const forced = flagForced ? "1" : "0";
		const args = [
			`${this.videoPath}`,
			"--edit",
			`track:=${trackUid}`,
			"--set",
			`flag-default=${defaulted}`,
			"--set",
			`flag-forced=${forced}`,
			"--set",
			`name=${name}`,
		];
		try {
			// console.log(`Running: mkvpropedit ${args.join(" ")}`);
			await runCommand("mkvpropedit", args, "pipe");

			return true;
		} catch (error) {
			console.error(`❌ Error editing flags for track ${trackId}: ${error}`);
			return false;
		}
	}
	private isLanguageMatch(code: string, desiredLang: string): boolean {
		const normalizedLang = desiredLang.trim();
		const codes = getLanguageCodes[normalizedLang];
		if (!codes) return false;
		return codes.includes(code.toLowerCase());
	}
	private fullLanguageName(code: string): string {
		const lang = Object.entries(getLanguageCodes).find(([_, codes]) =>
			codes.includes(code.toLowerCase()),
		);
		return lang ? lang[0] : "Unknown";
	}
	private isCommentaryTrack(trackName?: string): boolean {
		return trackName?.toLowerCase().includes("commentary") ?? false;
	}

	private async resetTrackFlags(trackUId: number): Promise<void> {
		const response = await this.editVideo(trackUId, false, false, "");
		if (!response) {
			console.log(`⚠️ Failed when trying to reset flag for UID: ${trackUId}`);
		}
	}

	private async setTrackAsDefault(trackUId: number): Promise<void> {
		const response = await this.editVideo(trackUId, true, true, "Forced");
		if (!response) {
			console.log(
				`⚠️ Failed when trying to set flag to default for UID: ${trackUId}.`,
			);
		}
	}
	async adjustSubtitleFlags(): Promise<boolean> {
		try {
			const subtitleTracks = await this.getTracks("subtitles");
			// console.log(`🔎 Found ${subtitleTracks.length} subtitle tracks:`);
			if (subtitleTracks.length === 0) {
				return true; // No action needed
			}

			for (const sub of subtitleTracks) {
				const FLN = `${color.GREEN}${this.fullLanguageName(sub.properties.language)}${color.RESET}`;
				const MatchedLang = this.isLanguageMatch(
					sub.properties.language,
					this.subLang,
				);
				const isForced = !!sub.properties.forced_track;
				const isDefault = !!sub.properties.default_track;
				const nameContainsForced =
					sub.properties.track_name?.toLowerCase().includes("forced") ?? false;
				if (!MatchedLang && (isForced || isDefault || nameContainsForced)) {
					console.log(
						`‼️ Subtitle Language ${FLN}\n` +
							`${isForced ? "⚠️ Is set as forced\n" : ""}\n` +
							`${isDefault ? "⚠️ Is set as default" : ""}\n` +
							`${nameContainsForced ? "⚠️ Is set as forced in name" : ""}`,
					);
					console.log(
						`Removing ${FLN} from default & forced Subtitle and setting ${color.GREEN}${this.subLang}${color.RESET} as default and forced`,
					);
					await this.resetTrackFlags(sub.properties.uid);
				}
				if (MatchedLang) {
					if (!isForced || !isDefault) {
						await this.setTrackAsDefault(sub.properties.uid);
						const isSetCorrectly = await this.verifyFlags(sub.properties.uid);
						if (!isSetCorrectly) {
							console.log(
								`⚠️ Failed to set ${color.GREEN}${this.subLang}${color.RESET} as default & forced Subtitle`,
							);
							return false;
						}
						console.log(
							`✅ Language ${FLN} is set as default & forced Subtitle`,
						);
					}
				}
			}

			return true;
		} catch (error) {
			console.error(`🚨 Error adjusting subtitle flags: ${error}`);
			return false;
		}
	}
	async adjustAudioFlags(): Promise<boolean> {
		try {
			const audioTracks = await this.getTracks("audio");
			if (audioTracks.length === 0) {
				console.log("⚠️ No audio tracks found in the video file.");
				return false;
			}
			for (const audio of audioTracks) {
				const FLN = `${color.GREEN}${this.fullLanguageName(audio.properties.language)}${color.RESET}`;
				const MatchedLang = this.isLanguageMatch(
					audio.properties.language,
					this.audioLang,
				);
				const isCommentary = this.isCommentaryTrack(
					audio.properties.track_name,
				);

				const isDefault = !!audio.properties.default_track;
				const isForced = !!audio.properties.forced_track;

				if (isCommentary) {
					console.log(
						`⚠️ Language ${FLN} ` +
							`with id: ${audio.id} is commentary Audio. ` +
							`It ${isDefault ? "is default" : "is not default"} ` +
							`${isForced ? "and it is forced" : "and it is not forced"}`,
					);
				}
				if (!MatchedLang && (isCommentary || isDefault || isForced)) {
					await this.resetTrackFlags(audio.properties.uid).then(() => {
						console.log(
							`✅ Language ${FLN} removed from default & forced Audio`,
						);
					});
				}
				if (MatchedLang && !isCommentary) {
					if (!isDefault || !isForced) {
						await this.setTrackAsDefault(audio.properties.uid);
						const isSetCorrectly = await this.verifyFlags(audio.properties.uid);
						if (!isSetCorrectly) {
							console.log(
								`⚠️ Failed to set ${color.GREEN}${this.audioLang}${color.RESET} as default & forced Audio`,
							);
							return false;
						}
						console.log(`✅ Language ${FLN} is set as default & forced Audio`);
					}
				}
			}
			return true;
		} catch (error) {
			console.error(`❌ Error adjusting audio flags: ${error}`);
			return false;
		}
	}
}
