
export type MKVMetadata = {
	attachments: [];
	chapters: {
		num_entries: number;
	}[];
	container: {
		properties: {
			container_type: number;
			date_local: string;
			date_utc: string;
			duration: number;
			is_providing_timestamps: boolean;
			muxing_application: string;
			segment_uid: string;
			timestamp_scale: number;
			writing_application: string;
		};
		recognized: boolean;
		supported: boolean;
		type: string;
	};
	errors: unknown[] | null;
	file_name: string;
	global_tags: [];
	identification_format_version: number;
	track_tags: [];
	tracks: {
		codec: string;
		id: number;
		type: 'video' | 'audio' | 'subtitles';
		properties: {
			codec_id: string;
			codec_private_data?: string;
			codec_private_length: number;
			default_duration?: number;
			default_track: boolean;
			display_dimensions?: string;
			display_unit?: number;
			enabled_track: boolean;
			forced_track: boolean;
			language: string;
			language_ietf: string;
			minimum_timestamp?: number;
			num_index_entries: number;
			number: number;
			packetizer?: string;
			pixel_dimensions?: string;
			tag__statistics_tags: string;
			tag__statistics_writing_app: string;
			tag__statistics_writing_date_utc: string;
			tag_bps: string;
			tag_duration: string;
			tag_number_of_bytes: string;
			tag_number_of_frames: string;
			uid: number;
			track_name?: string;
			audio_bits_per_sample?: number;
			audio_channels?: number;
			audio_sampling_frequency?: number;
			encoding?: string;
			text_subtitles?: boolean;
			content_encoding_algorithms?: string;
		};
	}[];
	warnings: unknown[];
};
