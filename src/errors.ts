
const BasicError = (s_prepend: string) => class extends Error {
	constructor(s_msg: string, e_original?: unknown) {
		super(s_prepend+'; '+s_msg+(e_original
			? (e_original as Error).stack
				|| (e_original as Error).message
				|| (e_original as string)+''
			: ''), {
			cause: e_original,
		});
	}
};

export class VaultCorruptedError extends BasicError('CRITICAL ERROR: Vault corrupted') {}

export class InvalidSessionError extends BasicError('Invalid vault session data') {}

export class VaultDamagedError extends BasicError('Vault damaged') {}

export class IntegrityCheckError extends BasicError('Failed to complete round-trip encryption/decryption integrity test') {}

export class RefuseDestructiveActionError extends BasicError('Refusing destructive action') {}

export class NotAuthenticatedError extends Error {}

export class AlreadyRegisteredError extends Error {}

export class InvalidPassphraseError extends Error {}

export class UnregisteredError extends Error {}

export class RecoverableVaultError extends Error {}

export class VaultClosedError extends BasicError('Vault is closed') {}

export class Bug extends BasicError('SOFTWARE BUG: Please report this issue') {}

export class TypeFieldNotWritableError extends BasicError('Cannot modify field that is part of item identity') {}

export class UnparseableSchemaError extends BasicError('Unable to parse schema') {}

export class SchemaError extends BasicError('CRITICAL SCHEMA ERROR') {}

export class SchemaWarning extends BasicError('Schema warning') {}

export class MissingMigrationError extends BasicError('Missing database migration handler') {}

export class MigrationError extends BasicError('Error encountered while attempting to migrate database') {}

export class ClientBehindError extends BasicError('Your client software is older than the version that created the database') {}

export class MissingMigrationRouterError extends BasicError('Missing migration router where expected') {}
