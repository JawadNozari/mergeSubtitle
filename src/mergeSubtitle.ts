import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { copyFile, unlink, rename } from "node:fs/promises";

type MergeOptions = {
	videoPath: string;
	subtitlePath: string;
	language: string;
	title?: string;
	outputPath?: string;
};

export async function mergeSubtitle(options: MergeOptions) {
	// console.log("📂 Started merging subtitle with video...");
	const { videoPath, subtitlePath, language, title, outputPath } = options;

	if (!fs.existsSync(videoPath))
		throw new Error(`❌ Video file not found: ${videoPath}`);
	if (!fs.existsSync(subtitlePath))
		throw new Error(`❌ Subtitle file not found: ${subtitlePath}`);

	const videoExt = path.extname(videoPath);
	const videoBase = path.basename(videoPath, videoExt);
	const subtitleTitle = title || language.toUpperCase();

	const tempOutput =
		outputPath || path.join(path.dirname(videoPath), `${videoBase}_merged.mkv`); // Adjust this path if needed
	// console.log(
	// 	`📂 Merging ${videoPath} with ${subtitlePath} to create ${tempOutput}`,
	// );
	try {
		await copyFile(videoPath, tempOutput);
		// console.log(`✅ Copied video file to temporary location: ${tempOutput}`);
		const cmdArgs = [
			"-o",
			`"${tempOutput}"`, // ✅ Output to a *different* file
			`"${videoPath}"`,
			"--language",
			`0:${language}`,
			"--track-name",
			`0:${subtitleTitle}`,
			"--default-track",
			"0:yes",
			"--forced-track",
			"0:yes",
			`"${subtitlePath}"`,
		];
		// const cmdArgs2 = [
		// 	"-o",
		// 	tempOutput,
		// 	videoPath,
		// 	"--language",
		// 	`0:${language}`,
		// 	"--track-name",
		// 	`0:${title}`,
		// 	"--default-track",
		// 	"0:yes",
		// 	"--forced-track",
		// 	"0:yes",
		// 	subtitlePath
		//   ];
		// console.log("🛠️ Running mkvmerge:", "mkvmerge", cmdArgs.join(" "));
		return new Promise<void>((resolve, reject) => {
			const proc = spawn("mkvmerge", cmdArgs, {
				shell: true,
			});

			// proc.stdout.on("data", (data) => console.log("stdout:", data.toString()));
			// proc.stderr.on("data", (data) =>
			// 	console.error("stderr:", data.toString()),
			// );

			proc.on("error", (err) => {
				console.error("❌ Failed to start mkvmerge:", err.message);
				reject(err);
			});

			proc.on("close", async (code) => {
				if (code !== 0) {
					return reject(new Error(`❌ mkvmerge exited with code ${code}`));
				}

				try {
					await unlink(videoPath);
					await rename(tempOutput, videoPath);
					await unlink(subtitlePath);
					console.log(`✅ Successfully merged: ${videoPath}`);
					resolve();
				} catch (err: unknown) {
					if (err instanceof Error) {
						reject(
							new Error(`❌ Failed to finalize merged video: ${err.message}`),
						);
					} else {
						reject(
							new Error(
								"❌ An unknown error occurred while finalizing the merged video.",
							),
						);
					}
				}
			});
		});
	} catch (err: unknown) {
		if (err instanceof Error) {
			throw new Error(`❌ Failed to copy video file: ${err.message}`);
		}
	}
}
