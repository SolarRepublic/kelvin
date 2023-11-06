
// every character that doesn't need escaping in JSON except for ":", which is used as a delimiter
const SX_CHARS_BASE92 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!#$%&'()*+,-./;<=>?@[]^_`{|}~ ";

/**
 * Converts an index to base92-encoded string
 */
export const index_to_b92 = (i_index: number): string => {
	// safety
	if(!Number.isSafeInteger(i_index) || i_index < 0) {
		throw Error('Invalid uint passed to index_to_b92: '+i_index);
	}

	// zero-th index
	if(0 === i_index) return SX_CHARS_BASE92[0];

	// prep output string
	let s_out = '';

	// copy value to new variable
	let i_value = i_index;

	// while there is information
	while(i_value > 0) {
		// modulo
		const xc_remainder = i_value % 92;

		// encode
		s_out = SX_CHARS_BASE92[xc_remainder] + s_out;

		// continue
		i_value = Math.floor(i_value / 92);
	}

	// output
	return s_out;
};


/**
 * Converts a base92-encoded string to an index (inverse of {@link index_to_b92})
 */
export const b92_to_index = (sb92_str: string): number => {
	// safety
	if('string' !== typeof sb92_str || !sb92_str.length) {
		throw Error(`Invalid base92 string passed to b92_to_index: ${sb92_str}`);
	}

	// prep output value
	let n_value = 0;

	// each character
	for(const s_char of sb92_str) {
		// decode char
		const i_index = SX_CHARS_BASE92.indexOf(s_char);

		// not in alphabet
		if(i_index < 0) {
			throw Error(`Invalid base92 string; char not in alphabet: "${sb92_str}"`);
		}

		// update value
		n_value = (n_value * 92) + i_index;
	}

	// output
	return n_value;
};
