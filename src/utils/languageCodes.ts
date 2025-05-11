import raw from "./languages.json";
type LanguageEntry = { code: string[]; name: string };

const languages = raw as LanguageEntry[];
// Forward lookup: name → code[]
export const getLanguageCodes: Record<string, string[]> = Object.fromEntries(
	languages.map(({ name, code }) => [name, code]),
);
// Reverse lookup: code → name
export const getlanguageNameByCode: Record<string, string> = Object.fromEntries(
	languages.flatMap(({ name, code }) => code.map((c) => [c, name])),
);

export type LanguageName = keyof typeof getLanguageCodes;
export type LanguageCode = (typeof getLanguageCodes)[LanguageName][number];
export function getLanguageCodeFromName(
	name: LanguageName,
): string | undefined {
	const codes = getLanguageCodes[name];
	return codes?.[0];
}
