
const BasicError = (s_prepend: string) => class extends Error {
	constructor(s_msg: string, e_original?: Error) {
		super(s_prepend+'; '+s_msg+(e_original? e_original.message: ''), {
			cause: e_original,
		});
	}
};

export class VaultCorruptedError extends BasicError('CRITICAL ERROR: Vault corrupted') {}

export class InvalidSessionError extends BasicError('Invalid vault session data') {}

export class VaultDamagedError extends BasicError('Vault damaged') {}

export class IntegrityCheckError extends BasicError('Failed to complete round-trip encryption/decryption integrity test') {}

export class NotAuthenticatedError extends Error {}

export class AlreadyRegisteredError extends Error {}

export class InvalidPassphraseError extends Error {}

export class UnregisteredError extends Error {}

export class RecoverableVaultError extends Error {}

export class VaultClosedError extends BasicError('Vault is closed') {}

export class Bug extends BasicError('SOFTWARE BUG: Please report this issue') {}

