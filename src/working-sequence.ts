
export class WorkingSequence<w_item, w_key extends number=number> {
	constructor(protected _a_backing: w_item[]) {

	}

	encode(w_item: w_item): w_key {
		return this._a_backing.indexOf(w_item) as w_key;
	}

	encodeOrThrow(w_item: w_item): w_key {
		const i_key = this._a_backing.indexOf(w_item);

		// not found
		if(-1 === i_key) {
			throw Error(`Failed to encode sequence member "${w_item}"`);
		}

		return i_key as w_key;
	}
}
