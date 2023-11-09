import {LocalStorageWrapper} from './local-storage';

export class SessionStorageWrapper extends LocalStorageWrapper {
	constructor() {
		super(sessionStorage);
	}
}
