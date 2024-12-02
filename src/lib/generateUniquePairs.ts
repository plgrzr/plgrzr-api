function generateUniquePairs(files: File[]): [File, File][] {
	const pairs: [File, File][] = [];
	for (let i = 0; i < files.length - 1; i++) {
		for (let j = i + 1; j < files.length; j++) {
			pairs.push([files[i], files[j]]);
		}
	}
	return pairs;
}

export { generateUniquePairs };
